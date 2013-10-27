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
    "js/Networking/Packet/ARP",
    "js/Exception",
    "js/Networking/Packet/IPv4",
    "js/Networking/Address/MAC"
], function (
    util,
    ARPPacket,
    Exception,
    IPv4Packet,
    MACAddress
) {
    "use strict";

    function EthernetFrame(buffer, offset, length) {
        this.buffer = buffer;
        this.dataView = new DataView(buffer, offset, length);
        this.length = length;
        this.offset = offset;
    }

    util.extend(EthernetFrame, {
        wrapPacket: function (packet) {
            var buffer,
                frame,
                frameLength,
                pointer = packet.getPointer();

            // Add 4 bytes for the Frame check sequence CRC
            // Automatically add zero-byte padding if less than 46 bytes long
            frameLength = 14 + Math.max(46, pointer.length + 4);

            buffer = new Uint8Array(frameLength);
            // Copy packet payload into frame's buffer
            buffer.set(new Uint8Array(pointer.buffer, pointer.offset, pointer.length), 14);

            frame = new EthernetFrame(buffer.buffer, 0, frameLength);
            frame.setEtherType(packet.getEtherType());

            return frame;
        }
    });

    util.extend(EthernetFrame.prototype, {
        getDestinationMAC: function () {
            var frame = this;

            return new MACAddress(frame.buffer, frame.offset);
        },
        getEtherType: function () {
            // Ethernet octets are big-endian
            return this.dataView.getUint16(12, false);
        },
        getPacket: function () {
            var frame = this,
                etherType = frame.getEtherType(),
                // Subtract 4 bytes for the Frame check sequence CRC
                length = frame.length - 14 - 4,
                offset = frame.offset + 14;

            switch (etherType) {
            case ARPPacket.ETHERTYPE:
                return new ARPPacket(frame.buffer, offset, length);
            case IPv4Packet.ETHERTYPE:
                return new IPv4Packet(frame.buffer, offset, length);
            default:
                return null;
            }
        },
        getPointer: function () {
            var frame = this;

            return {
                buffer: frame.buffer,
                length: frame.length,
                offset: frame.offset
            };
        },
        getSourceMAC: function () {
            var frame = this;

            return new MACAddress(frame.buffer, frame.offset + 6);
        },
        setDestinationMAC: function (address) {
            var frame = this;

            if (!(address instanceof MACAddress)) {
                throw new Exception("EthernetFrame.setDestinationMAC() :: Expected address to be a MACAddress");
            }

            new Uint8Array(frame.buffer, frame.offset, 6).set(new Uint8Array(address.toBuffer()));
        },
        setEtherType: function (type) {
            // Ethernet octets are big-endian
            this.dataView.setUint16(12, type, false);
        },
        setSourceMAC: function (address) {
            var frame = this;

            if (!(address instanceof MACAddress)) {
                throw new Exception("EthernetFrame.setSourceMAC() :: Expected address to be a MACAddress");
            }

            new Uint8Array(frame.buffer, frame.offset + 6, 6).set(new Uint8Array(address.toBuffer()));
        },
        updateChecksum: function () {

        }
    });

    return EthernetFrame;
});
