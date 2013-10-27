/**
 * jemul8 - JavaScript x86 Emulator
 * http://jemul8.com/
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*global ArrayBuffer, define, Uint8Array */
define([
    "js/util"
], function (
    util
) {
    "use strict";

    function MACAddress(buffer, offset) {
        this.buffer = buffer;
        this.offset = offset;
    }

    util.extend(MACAddress, {
        create: function () {
            return new MACAddress(new ArrayBuffer(6), 0);
        },
        createFromHexString: function (dottedString) {
            var octets = new Uint8Array(6);

            util.each(dottedString.split(":"), function (octet, index) {
                octets[index] = parseInt(octet, 16);
            });

            return new MACAddress(octets.buffer, 0);
        }
    });

    util.extend(MACAddress.prototype, {
        copy: function () {
            return MACAddress.createFromHexString(this.toHexString());
        },
        /*
         * Calculates the 6-bit index into the multicast table.
         * Stolen unashamedly from Bochs (and there from FreeBSD's if_ed.c)
         */
        getMulticastIndex: function () {
            /*jshint bitwise: false */
            var POLYNOMIAL = 0x04c11db6,
                b,
                mac = this,
                buffer = new Uint8Array(mac.buffer, mac.offset, 6),
                carry,
                crc = 0xffffffff,
                ep = 0,
                i,
                j;

            for (i = 6; i >= 0; i--) {
                b = buffer[ep++];
                for (j = 8; j >= 0; j--) {
                    carry = ((crc & 0x80000000) ? 1 : 0) ^ (b & 0x01);
                    crc <<= 1;
                    b >>>= 1;
                    if (carry) {
                        crc = ((crc ^ POLYNOMIAL) | carry);
                    }
                }
            }

            return (crc >>> 26);
        },
        getOctet: function (index) {
            var mac = this;

            return new Uint8Array(mac.buffer, mac.offset, 6)[index];
        },
        getPointer: function () {
            var mac = this;

            return {
                buffer: mac.buffer,
                length: mac.length,
                offset: mac.offset
            };
        },
        isBroadcast: function () {
            return this.toHexString() === "FF:FF:FF:FF:FF:FF";
        },
        setOctet: function (index, value) {
            var mac = this;

            new Uint8Array(mac.buffer, mac.offset, 6)[index] = value;
        },
        setZero: function () {
            var mac = this;

            new Uint8Array(mac.buffer, mac.offset, 6).set(new Uint8Array(new ArrayBuffer(6)));
        },
        toBuffer: function () {
            var mac = this;

            return mac.buffer.slice(mac.offset, mac.offset + 6);
        },
        toHexString: function () {
            var index,
                mac = this,
                buffer = new Uint8Array(mac.buffer, mac.offset, 6),
                octet,
                octets = [];

            for (index = 0; index < 6; index++) {
                octet = buffer[index].toString(16).toUpperCase();
                if (octet.length === 1) {
                    octet = "0" + octet;
                }

                octets[index] = octet;
            }

            return octets.join(":");
        }
    });

    return MACAddress;
});
