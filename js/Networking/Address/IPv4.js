/**
 * jemul8 - JavaScript x86 Emulator
 * http://jemul8.com/
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*global define, Uint8Array */
define([
    "js/util"
], function (
    util
) {
    "use strict";

    function IPv4Address(buffer, offset) {
        this.buffer = buffer;
        this.offset = offset;
    }

    util.extend(IPv4Address, {
        createFromDottedDecimal: function (dottedString) {
            var octets = new Uint8Array(4);

            util.each(dottedString.split("."), function (octet, index) {
                octets[index] = parseInt(octet, 10);
            });

            return new IPv4Address(octets.buffer, 0);
        }
    });

    util.extend(IPv4Address.prototype, {
        to32BitInteger: function () {
            /*jshint bitwise: false */
            var ipAddress = this,
                buffer = new Uint8Array(ipAddress.buffer, ipAddress.offset, 4),
                index,
                result = 0;

            for (index = 0; index < 4; index++) {
                result |= (buffer[index] << (8 * (3 - index)));
            }

            return result;
        },
        toBuffer: function () {
            var mac = this;

            return mac.buffer.slice(mac.offset, mac.offset + 4);
        },
        toDottedDecimal: function () {
            var index,
                ipAddress = this,
                buffer = new Uint8Array(ipAddress.buffer, ipAddress.offset, 4),
                octets = [];

            for (index = 0; index < 4; index++) {
                octets[index] = buffer[index];
            }

            return octets.join(".");
        }
    });

    return IPv4Address;
});
