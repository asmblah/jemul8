/**
 * jemul8 - JavaScript x86 Emulator
 * http://jemul8.com/
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*global ArrayBuffer, DataView, define, Uint8Array */
define([
    "js/util"
], function (
    util
) {
    "use strict";

    function EchoICMPMessage(buffer, offset, length) {
        this.buffer = buffer;
        this.dataView = new DataView(buffer, offset, length);
        this.length = length;
        this.offset = offset;
    }

    util.extend(EchoICMPMessage, {
        create: function (dataLength) {
            var length = 8 + dataLength,
                buffer = new ArrayBuffer(length),
                message = new EchoICMPMessage(buffer, 0, length);

            return message;
        }
    });

    util.extend(EchoICMPMessage.prototype, {
        getData: function () {
            var message = this;

            return message.buffer.slice(message.offset + 8, message.offset + message.length);
        },
        getDataLength: function () {
            return this.length - 8;
        },
        getID: function () {
            // Ethernet octets are big-endian
            return this.dataView.getUint16(4, false);
        },
        getPointer: function () {
            var message = this;

            return {
                buffer: message.buffer,
                length: message.length,
                offset: message.offset
            };
        },
        getSequenceNumber: function () {
            // Ethernet octets are big-endian
            return this.dataView.getUint16(6, false);
        },
        // Validates an ICMP message by checking its header against the header checksum
        isValid: function () {
            /*jshint bitwise: false */

            // For the purposes of the checksum, the checksum field value is zero
            var index,
                message = this,
                sum = 0;

            for (index = 0; index < message.length; index += 2) {
                // Ethernet octets are big-endian
                sum += message.dataView.getUint16(index, false);
            }

            // Add the carry (above lower 16 bits) to the rest of the sum
            sum = (sum >>> 16) + (sum & 0xffff);

            // Calculate one's complement and drop higher bits (for 16-bit)
            sum = (~sum) & 0xffff;

            // Result will be zero if valid
            return (sum === 0);
        },
        setData: function (buffer) {
            var message = this;

            new Uint8Array(message.buffer, message.offset + 8).set(new Uint8Array(buffer));
        },
        setID: function (id) {
            // Ethernet octets are big-endian
            this.dataView.setUint16(4, id, false);
        },
        setSequenceNumber: function (sequenceNumber) {
            // Ethernet octets are big-endian
            this.dataView.setUint16(6, sequenceNumber, false);
        },
        updateChecksum: function () {
            /*jshint bitwise: false */
            var index,
                message = this,
                sum = 0;

            // For the purposes of the checksum, the checksum field value is zero
            message.dataView.setUint16(2, 0, false);

            for (index = 0; index < message.length; index += 2) {
                // Ethernet octets are big-endian
                sum += message.dataView.getUint16(index, false);
            }

            // Add the carry (above lower 16 bits) to the rest of the sum
            sum = (sum >>> 16) + (sum & 0xffff);

            // Calculate one's complement and drop higher bits (for 16-bit)
            sum = (~sum) & 0xffff;

            // Ethernet octets are big-endian
            message.dataView.setUint16(2, sum, false);
        }
    });

    return EchoICMPMessage;
});
