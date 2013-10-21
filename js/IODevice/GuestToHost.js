/**
 * jemul8 - JavaScript x86 Emulator
 * http://jemul8.com/
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*
 * Guest to Host bridge
 */

/*global define */
define([
    "js/util",
    "js/IODevice",
    "js/core/classes/iodev/guest2host",
    "js/Promise"
], function (
    util,
    IODevice,
    LegacyGuestToHost,
    Promise
) {
    "use strict";

    function GuestToHost(system, io, memory, options) {
        IODevice.call(this, "GuestToHost", system, io, memory, options);

        this.legacyReadHandler = null;
        this.legacyWriteHandler = null;

        this.legacyGuestToHost = new LegacyGuestToHost((function (guestToHost) {
            return {
                io: {
                    registerIO_Read: function (device, addr, name, fn) {
                        guestToHost.legacyReadHandler = fn;
                    },
                    registerIO_Write: function (device, addr, name, fn) {
                        guestToHost.legacyWriteHandler = fn;
                    }
                }
            };
        }(this)));
    }

    util.inherit(GuestToHost).from(IODevice);

    util.extend(GuestToHost.prototype, {
        getIOPorts: function () {
            return {
                0x0402: { description: "GuestToHost INFO_PORT", allowedIOLengths: {1: true} },
                0x0403: { description: "GuestToHost DEBUG_PORT", allowedIOLengths: {1: true} }
            };
        },

        init: function () {
            var guestToHost = this,
                promise = new Promise();

            guestToHost.legacyGuestToHost.init(function () {
                promise.resolve();
            }, function () {
                promise.reject();
            });

            return promise;
        },

        ioRead: function (port, length) {
            var guestToHost = this;

            return guestToHost.legacyReadHandler(guestToHost.legacyGuestToHost, port, length);
        },

        ioWrite: function (port, value, length) {
            var guestToHost = this;

            guestToHost.legacyWriteHandler(guestToHost.legacyGuestToHost, port, value, length);
        },

        reset: function () {
            var guestToHost = this;

            return guestToHost;
        }
    });

    return GuestToHost;
});
