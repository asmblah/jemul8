/**
 * jemul8 - JavaScript x86 Emulator
 * http://jemul8.com/
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*
 * See http://www.tcpipguide.com/free/t_ARPMessageFormat.htm
 */

/*global ArrayBuffer, DataView, define, Uint8Array */
define([
    "js/util",
    "js/Exception",
    "js/Networking/Address/IPv4",
    "js/Networking/Address/MAC"
], function (
    util,
    Exception,
    IPv4Address,
    MACAddress
) {
    "use strict";

    var ETHERNET_HARDWARE_TYPE = 1,
        ETHERTYPE_ARP = 0x0806,
        IPV4_PROTOCOL_TYPE = 0x0800,
        REPLY_OPCODE = 2,
        REQUEST_OPCODE = 1;

    function ARPPacket(buffer, offset, length) {
        this.buffer = buffer;
        this.dataView = new DataView(buffer, offset, length);
        this.length = length;
        this.offset = offset;
    }

    util.extend(ARPPacket, {
        ETHERTYPE: ETHERTYPE_ARP,

        createEthernetIPv4: function () {
            var packet = new ARPPacket(new ArrayBuffer(28), 0, 28);

            packet.setHardwareType(ETHERNET_HARDWARE_TYPE);
            packet.setHardwareAddressLength(6);
            packet.setProtocolType(IPV4_PROTOCOL_TYPE);
            packet.setProtocolAddressLength(4);

            return packet;
        }
    });

    util.extend(ARPPacket.prototype, {
        getEtherType: function () {
            return ETHERTYPE_ARP;
        },
        getHardwareAddressLength: function () {
            return this.dataView.getUint8(4);
        },
        getHardwareType: function () {
            // Ethernet octets are big-endian
            return this.dataView.getUint16(0, false);
        },
        getOpcode: function () {
            // Ethernet octets are big-endian
            return this.dataView.getUint16(6, false);
        },
        getPointer: function () {
            var packet = this;

            return {
                buffer: packet.buffer,
                length: packet.length,
                offset: packet.offset
            };
        },
        getProtocolAddressLength: function () {
            return this.dataView.getUint8(5);
        },
        getProtocolType: function () {
            // Ethernet octets are big-endian
            return this.dataView.getUint16(2, false);
        },
        getSenderHardwareAddress: function () {
            var packet = this,
                hardwareAddressLength = packet.getHardwareAddressLength();

            if (!packet.isEthernet()) {
                throw new Exception("ARPPacket.getSenderHardwareAddress() :: Expected hardwareType to be Ethernet");
            }

            if (hardwareAddressLength !== 6) {
                throw new Exception("ARPPacket.getSenderHardwareAddress() :: Expected hardwareAddressLength to be 6");
            }

            return new MACAddress(packet.buffer, packet.offset + 8);
        },
        getSenderProtocolAddress: function () {
            var packet = this,
                protocolAddressLength = packet.getProtocolAddressLength();

            if (!packet.isIPv4()) {
                throw new Exception("ARPPacket.getSenderProtocolAddress() :: Expected protocolType to be IPv4");
            }

            if (protocolAddressLength !== 4) {
                throw new Exception("ARPPacket.getSenderProtocolAddress() :: Expected protocolAddressLength to be 4");
            }

            return new IPv4Address(packet.buffer, packet.offset + 14);
        },
        getTargetHardwareAddress: function () {
            var packet = this,
                hardwareAddressLength = packet.getHardwareAddressLength();

            if (!packet.isEthernet()) {
                throw new Exception("ARPPacket.getTargetHardwareAddress() :: Expected hardwareType to be Ethernet");
            }

            if (hardwareAddressLength !== 6) {
                throw new Exception("ARPPacket.getTargetHardwareAddress() :: Expected hardwareAddressLength to be 6");
            }

            return new MACAddress(packet.buffer, packet.offset + 18);
        },
        getTargetProtocolAddress: function () {
            var packet = this,
                protocolAddressLength = packet.getProtocolAddressLength();

            if (!packet.isIPv4()) {
                throw new Exception("ARPPacket.getTargetProtocolAddress() :: Expected protocolType to be IPv4");
            }

            if (protocolAddressLength !== 4) {
                throw new Exception("ARPPacket.getTargetProtocolAddress() :: Expected protocolAddressLength to be 4");
            }

            return new IPv4Address(packet.buffer, packet.offset + 24);
        },
        isEthernet: function () {
            return this.getHardwareType() === ETHERNET_HARDWARE_TYPE;
        },
        isIPv4: function () {
            return this.getProtocolType() === IPV4_PROTOCOL_TYPE;
        },
        makeReply: function () {
            this.setOpcode(REPLY_OPCODE);
        },
        makeRequest: function () {
            this.setOpcode(REQUEST_OPCODE);
        },
        setHardwareAddressLength: function (length) {
            this.dataView.setUint8(4, length);
        },
        setHardwareType: function (type) {
            // Ethernet octets are big-endian
            this.dataView.setUint16(0, type, false);
        },
        setOpcode: function (opcode) {
            // Ethernet octets are big-endian
            this.dataView.setUint16(6, opcode, false);
        },
        setProtocolAddressLength: function (length) {
            this.dataView.setUint8(5, length);
        },
        setProtocolType: function (type) {
            // Ethernet octets are big-endian
            this.dataView.setUint16(2, type, false);
        },
        setSenderHardwareAddress: function (address) {
            var packet = this;

            if (!(address instanceof MACAddress)) {
                throw new Exception("ARPPacket.setSenderHardwareAddress() :: Expected address to be a MACAddress");
            }

            new Uint8Array(packet.buffer, packet.offset + 8, 6).set(new Uint8Array(address.toBuffer()));
        },
        setSenderProtocolAddress: function (address) {
            var packet = this;

            if (!(address instanceof IPv4Address)) {
                throw new Exception("ARPPacket.setSenderProtocolAddress() :: Expected address to be an IPv4Address");
            }

            new Uint8Array(packet.buffer, packet.offset + 14, 4).set(new Uint8Array(address.toBuffer()));
        },
        setTargetHardwareAddress: function (address) {
            var packet = this;

            if (!(address instanceof MACAddress)) {
                throw new Exception("ARPPacket.setTargetHardwareAddress() :: Expected address to be a MACAddress");
            }

            new Uint8Array(packet.buffer, packet.offset + 18, 6).set(new Uint8Array(address.toBuffer()));
        },
        setTargetProtocolAddress: function (address) {
            var packet = this;

            if (!(address instanceof IPv4Address)) {
                throw new Exception("ARPPacket.setTargetProtocolAddress() :: Expected address to be an IPv4Address");
            }

            new Uint8Array(packet.buffer, packet.offset + 24, 4).set(new Uint8Array(address.toBuffer()));
        }
    });

    return ARPPacket;
});
