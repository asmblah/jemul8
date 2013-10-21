/**
 * jemul8 - JavaScript x86 Emulator
 * http://jemul8.com/
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*
 * PIC (Programmable Interrupt Controller) chip, based on an Intel 8259A
 */

/*global define */
define([
    "js/util",
    "js/IODevice",
    "js/core/classes/iodev/pic",
    "js/Promise"
], function (
    util,
    IODevice,
    LegacyPIC,
    Promise
) {
    "use strict";

    function PIC(system, io, memory, options) {
        IODevice.call(this, "PIC", system, io, memory, options);

        this.legacyReadHandler = null;
        this.legacyWriteHandler = null;

        this.legacyPIC = new LegacyPIC((function (pic) {
            return {
                cpu: {
                    INTR: {
                        lower: function () {
                            system.lowerINTR();
                        },
                        raise: function () {
                            system.raiseINTR();
                        }
                    }
                },
                io: {
                    registerIO_Read: function (device, addr, name, fn) {
                        pic.legacyReadHandler = fn;
                    },
                    registerIO_Write: function (device, addr, name, fn) {
                        pic.legacyWriteHandler = fn;
                    }
                }
            };
        }(this)));
    }

    util.inherit(PIC).from(IODevice);

    util.extend(PIC.prototype, {
        acknowledgeInterrupt: function () {
            return this.legacyPIC.acknowledgeInterrupt();
        },

        getIOPorts: function () {
            return {
                0x0020: { description: "PIC", allowedIOLengths: {1: true} },
                0x0021: { description: "PIC", allowedIOLengths: {1: true} },
                0x00A0: { description: "PIC", allowedIOLengths: {1: true} },
                0x00A1: { description: "PIC", allowedIOLengths: {1: true} }
            };
        },

        init: function () {
            var pic = this,
                promise = new Promise();

            pic.legacyPIC.init(function () {
                promise.resolve();
            }, function () {
                promise.reject();
            });

            return promise;
        },

        ioRead: function (port, length) {
            var pic = this;

            return pic.legacyReadHandler(pic.legacyPIC, port, length);
        },

        ioWrite: function (port, value, length) {
            var pic = this;

            pic.legacyWriteHandler(pic.legacyPIC, port, value, length);
        },

        lowerIRQ: function (irq) {
            this.legacyPIC.lowerIRQ(irq);
        },

        raiseIRQ: function (irq) {
            this.legacyPIC.raiseIRQ(irq);
        },

        reset: function () {
            var pic = this;

            return pic;
        }
    });

    return PIC;
});
