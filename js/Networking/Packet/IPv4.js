/**
 * jemul8 - JavaScript x86 Emulator
 * http://jemul8.com/
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*global DataView, define, Uint8Array */
define([
    "js/util",
    "js/Exception",
    "js/Networking/Segment/ICMP",
    "js/Networking/Address/IPv4"
], function (
    util,
    Exception,
    ICMPSegment,
    IPv4Address
) {
    "use strict";

    var ETHERTYPE_IPV4 = 0x0800;

    function IPv4Packet(buffer, offset, length) {
        this.buffer = buffer;
        this.dataView = new DataView(buffer, offset, length);
        this.length = length;
        this.offset = offset;
    }

    util.extend(IPv4Packet, {
        ETHERTYPE: ETHERTYPE_IPV4,

        // Wraps a segment in an IPv4 packet, eg. a TCP or UDP data segment or ICMP message
        wrapSegment: function (segment) {
            var buffer,
                packet,
                packetLength,
                pointer = segment.getPointer();

            // Add 20 bytes for the header
            packetLength = 20 + pointer.length;

            buffer = new Uint8Array(packetLength);
            // Copy segment payload into packet's buffer
            buffer.set(new Uint8Array(pointer.buffer, pointer.offset, pointer.length), 20);

            packet = new IPv4Packet(buffer.buffer, 0, packetLength);
            packet.setVersion(4);
            packet.setHeaderLength(20);
            packet.setDSCP(0);
            packet.setECN(0);
            packet.updateTotalLength();
            packet.setProtocol(segment.getProtocol());
            packet.updateChecksum();

            return packet;
        }
    });

    util.extend(IPv4Packet.prototype, {
        getDestinationIP: function () {
            var packet = this;

            return new IPv4Address(packet.buffer, packet.offset + 16);
        },
        // Differentiated Services Code Point
        getDSCP: function () {
            /*jshint bitwise: false */

            // Get high 2 bits of octet
            return this.dataView.getUint8(1) >> 6;
        },
        // Explicit Congestion Notification
        getECN: function () {
            /*jshint bitwise: false */

            // Get low 6 bits of octet
            return this.dataView.getUint8(1) & 0x3f;
        },
        getEtherType: function () {
            return ETHERTYPE_IPV4;
        },
        getFragmentOffset: function () {
            /*jshint bitwise: false */

            // Ethernet octets are big-endian, and only return the low 13 bits (high 3 are Flags)
            return this.dataView.getUint16(5, false) & 0x1fff;
        },
        getID: function () {
            /*jshint bitwise: false */

            // Ethernet octets are big-endian
            return this.dataView.getUint16(4, false);
        },
        getHeaderLength: function () {
            /*jshint bitwise: false */

            // Get low 4-bit nibble of octet
            var numberOf32BitWords = this.dataView.getUint8(0) & 0xF;

            // Return the number of bytes
            return numberOf32BitWords * 4;
        },
        getPointer: function () {
            var packet = this;

            return {
                buffer: packet.buffer,
                length: packet.length,
                offset: packet.offset
            };
        },
        // Protocol number, eg. 1 (ICMP), 6 (TCP) or 17 (UDP)
        getProtocol: function () {
            /*jshint bitwise: false */

            return this.dataView.getUint8(9);
        },
        getSegment: function () {
            var packet = this,
                protocol = packet.getProtocol(),
                // Data is immediately after the header
                offset = packet.getHeaderLength(),
                length = packet.getTotalLength() - offset;

            switch (protocol) {
            case ICMPSegment.PROTOCOL_NUMBER:
                return new ICMPSegment(packet.buffer, packet.offset + offset, length);
            default:
                return null;
            }
        },
        getSourceIP: function () {
            var packet = this;

            return new IPv4Address(packet.buffer, packet.offset + 12);
        },
        getTotalLength: function () {
            // Ethernet octets are big-endian
            return this.dataView.getUint16(2, false);
        },
        // Time to Live: in practice this is the max. number of hops the packet can take
        getTTL: function () {
            return this.dataView.getUint8(8);
        },
        getVersion: function () {
            /*jshint bitwise: false */

            // Get high 4-bit nibble of octet
            return this.dataView.getUint8(0) >> 4;
        },
        isFragmentable: function () {
            /*jshint bitwise: false */

            // Get bit 6 (and invert, because packet is fragmentable if bit is not set)
            return !((this.dataView.getUint8(6) >> 6) & 1);
        },
        // Validates an IP packet by checking its header against the header checksum
        isValid: function () {
            /*jshint bitwise: false */

            // For the purposes of the checksum, the checksum field value is zero
            var index,
                packet = this,
                length = packet.getHeaderLength(),
                sum = 0;

            for (index = 0; index < length; index += 2) {
                // Ethernet octets are big-endian
                sum += packet.dataView.getUint16(index, false);
            }

            // Add the carry (above lower 16 bits) to the rest of the sum
            sum = (sum >>> 16) + (sum & 0xffff);

            // Calculate one's complement and drop higher bits (for 16-bit)
            sum = (~sum) & 0xffff;

            // Result will be zero if valid
            return (sum === 0);
        },
        makeFragmentable: function () {
            /*jshint bitwise: false */
            var packet = this;

            // Clear bit 6
            packet.dataView.setUint8(6, packet.dataView.getUint8(6) & 0xbf);
        },
        makeNonFragmentable: function () {
            /*jshint bitwise: false */
            var packet = this;

            // Set bit 6
            packet.dataView.setUint8(6, packet.dataView.getUint8(6) | 0x40);
        },
        setDestinationIP: function (ip) {
            var packet = this;

            new Uint8Array(packet.buffer, packet.offset + 16, 4).set(new Uint8Array(ip.toBuffer()));
        },
        // Differentiated Services Code Point
        setDSCP: function (value) {
            /*jshint bitwise: false */
            var packet = this;

            // Set high 2 bits of octet
            packet.dataView.setUint8(1, (packet.dataView.getUint8(1) & 0x3f) | (value << 6));
        },
        // Explicit Congestion Notification
        setECN: function (value) {
            /*jshint bitwise: false */
            var packet = this;

            // Set low 6 bits of octet
            packet.dataView.setUint8(1, (packet.dataView.getUint8(1) & 0xc0) | (value & 0x3f));
        },
        setHeaderLength: function (length) {
            /*jshint bitwise: false */
            var numberOf32BitWords = length / 4,
                packet = this;

            // Set low 4-bit nibble of octet
            packet.dataView.setUint8(0, (packet.dataView.getUint8(0) & 0xf0) | (numberOf32BitWords & 0xf));
        },
        setID: function (id) {
            // Ethernet octets are big-endian
            this.dataView.setUint16(4, id, false);
        },
        // Protocol number, eg. 1 (ICMP), 6 (TCP) or 17 (UDP)
        setProtocol: function (protocol) {
            this.dataView.setUint8(9, protocol);
        },
        setSourceIP: function (ip) {
            var packet = this;

            new Uint8Array(packet.buffer, packet.offset + 12, 4).set(new Uint8Array(ip.toBuffer()));
        },
        // Time to Live: in practice this is the max. number of hops the packet can take
        setTTL: function (hops) {
            this.dataView.setUint8(8, hops);
        },
        setVersion: function (version) {
            /*jshint bitwise: false */
            var packet = this;

            // Set high 4-bit nibble of octet
            packet.dataView.setUint8(0, (packet.dataView.getUint8(0) & 0xf) | (version << 4));
        },
        updateChecksum: function () {
            /*jshint bitwise: false */
            var index,
                packet = this,
                length = packet.getHeaderLength(),
                sum = 0;

            // For the purposes of the checksum, the checksum field value is zero
            packet.dataView.setUint16(10, 0, false);

            for (index = 0; index < length; index += 2) {
                // Ethernet octets are big-endian
                sum += packet.dataView.getUint16(index, false);
            }

            // Add the carry (above lower 16 bits) to the rest of the sum
            sum = (sum >>> 16) + (sum & 0xffff);

            // Calculate one's complement and drop higher bits (for 16-bit)
            sum = (~sum) & 0xffff;

            // Ethernet octets are big-endian
            packet.dataView.setUint16(10, sum, false);
        },
        updateTotalLength: function () {
            var packet = this;

            // Ethernet octets are big-endian
            packet.dataView.setUint16(2, packet.length, false);
        }
    });

    return IPv4Packet;
});
