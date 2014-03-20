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
    "js/Networking/Table/ARP",
    "js/Networking/Address/IPv4",
    "js/Networking/Address/MAC"
], function (
    util,
    ARPTable,
    IPv4Address,
    MACAddress
) {
    "use strict";

    function NATGateway() {
        this.arpTable = new ARPTable();
        this.gatewayIP = IPv4Address.createFromDottedDecimal("192.168.2.1");
        this.gatewayInternalMAC = MACAddress.createFromHexString("00:AB:CD:EF:12:34");

        // Add entry for gateway
        //this.arpTable.add(this.gatewayMAC.toHexString(), this.gatewayIP.toDottedDecimal());
    }

    util.extend(NATGateway.prototype, {
        receiveExternalFrame: function (ethernetFrame) {

        },
        receiveInternalFrame: function (ethernetFrame) {

        }
    });

    return NATGateway;
});
