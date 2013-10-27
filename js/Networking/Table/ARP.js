/**
 * jemul8 - JavaScript x86 Emulator
 * http://jemul8.com/
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*global define */
define([
    "js/util",
    "js/Networking/Address/IPv4",
    "js/Networking/Address/MAC"
], function (
    util,
    IPv4Address,
    MACAddress
) {
    "use strict";

    function ARPTable() {
        this.macToIP = {};
    }

    util.extend(ARPTable.prototype, {
        add: function (macString, ipString) {
            this.macToIP[macString] = ipString;
        },
        getIPForMAC: function (mac) {
            var ipString = this.macToIP[mac.toHexString()];

            return ipString ? IPv4Address.createFromDottedDecimal(ipString) : null;
        },
        getMACForIP: function (ip) {
            var mac = null;

            util.each(this.macToIP, function (ipString, macString) {
                if (ipString === ip.toDottedDecimal()) {
                    mac = MACAddress.createFromHexString(macString);
                    return false;
                }
            });

            return mac;
        }
    });

    return ARPTable;
});
