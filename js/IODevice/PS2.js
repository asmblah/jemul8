/**
 * jemul8 - JavaScript x86 Emulator
 * http://jemul8.com/
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*
 * PS/2
 */

/*global define */
define([
    "js/util",
    "js/IODevice",
    "js/core/classes/iodev/keyboard",
    "js/Promise"
], function (
    util,
    IODevice,
    LegacyPS2,
    Promise
) {
    "use strict";

    function PS2(system, io, memory, pit, options) {
        IODevice.call(this, "PS/2", system, io, memory, options);

        this.legacyReadHandler = null;
        this.legacyWriteHandler = null;
        this.pit = pit;
        this.speakerGateState = 0;

        this.legacyPS2 = new LegacyPS2((function (ps2) {
            return {
                cmos: {
                    installEquipment: function () {}
                },
                io: {
                    registerIO_Read: function (device, addr, name, fn) {
                        ps2.legacyReadHandler = fn;
                    },
                    registerIO_Write: function (device, addr, name, fn) {
                        ps2.legacyWriteHandler = fn;
                    },
                    registerIRQ: function () {}
                },
                pic: {
                    lowerIRQ: function (irq) {
                        system.lowerIRQ(irq);
                    },
                    raiseIRQ: function (irq) {
                        system.raiseIRQ(irq);
                    }
                },
                getEnableA20: function () {
                    return system.getEnableA20();
                },
                registerTimer: function (fn, thisObj, interval) {
                    var timer = system.createTimer();

                    timer.on("elapse", function () {
                        fn.call(thisObj, Date.now());
                        timer.triggerAfterMicroseconds(interval);
                    });

                    timer.triggerAfterMicroseconds(interval);
                },
                setEnableA20: function (enabled) {
                    system.setEnableA20(enabled);
                }
            };
        }(this)));
    }

    util.inherit(PS2).from(IODevice);

    util.extend(PS2.prototype, {
        getIOPorts: function () {
            return {
                0x0060: { description: "PS/2", allowedIOLengths: {1: true} },
                0x0061: { description: "PS/2 Speaker", allowedIOLengths: {1: true} },
                0x0064: { description: "PS/2", allowedIOLengths: {1: true} }
            };
        },

        getPluginData: function () {
            return this.legacyPS2;
        },

        init: function () {
            var ps2 = this,
                promise = new Promise();

            ps2.legacyPS2.init(function () {
                promise.resolve();
            }, function () {
                promise.reject();
            });

            return promise;
        },

        ioRead: function (port, length) {
            var ps2 = this;

            if (port === 0x0061) {
                return (ps2.speakerGateState) |
                  (ps2.pit.isSpeakerDataOn() << 1) |
                  (((ps2.system.getMicrosecondsNow() / 15) & 1) << 4) |
                  (ps2.pit.isCounterOutHigh(2) << 5);
            }

            return ps2.legacyReadHandler(ps2.legacyPS2, port, length);
        },

        ioWrite: function (port, value, length) {
            var ps2 = this;

            if (port === 0x0061) {
                ps2.speakerGateState = value & 0x1;

                if (ps2.speakerGateState && ((value >>> 1) & 0x1)) {
                    ps2.pit.turnSpeakerDataOn();
                } else {
                    ps2.pit.turnSpeakerDataOff();
                }

                return;
            }

            ps2.legacyWriteHandler(ps2.legacyPS2, port, value, length);
        },

        reset: function () {
            var ps2 = this;

            return ps2;
        }
    });

    return PS2;
});
