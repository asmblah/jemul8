/**
 * jemul8 - JavaScript x86 Emulator
 * http://jemul8.com/
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*
 * PIT (Programmable Interval Timer) chip, based on an Intel 8254/82C54
 */

/*global define */
define([
    "js/util",
    "js/IODevice/PIT/Counter",
    "js/IODevice",
    "js/Promise"
], function (
    util,
    Counter,
    IODevice,
    Promise
) {
    "use strict";

    // Constructor / pre-init
    function PIT(system, io, memory, counter0, counter1, counter2, options) {
        var pit = this;

        IODevice.call(this, "PIT", system, io, memory, options);

        counter0.on("out high", function () {
            pit.emit("counter out high", 0);

            system.lowerIRQ(0);
        });
        counter0.on("out low", function () {
            pit.emit("counter out low", 0);

            system.raiseIRQ(0);
        });

        this.counters = [
            counter0,
            counter1,
            counter2
        ];
    }

    util.inherit(PIT).from(IODevice);

    util.extend(PIT.prototype, {
        getIOPorts: function () {
            return {
                0x0040: { description: "PIT CTR0", allowedIOLengths: {1: true} },
                0x0041: { description: "PIT CTR1", allowedIOLengths: {1: true} },
                0x0042: { description: "PIT CTR2", allowedIOLengths: {1: true} },
                0x0043: { description: "PIT ICW", allowedIOLengths: {1: true} }
            };
        },

        getPluginData: function () {
            return this;
        },

        init: function () {
            var promise = new Promise();

            promise.resolve();

            return promise;
        },

        ioRead: function (port) {
            var pit = this;

            return pit.counters[port - 0x0040].receiveHalfCount();
        },

        ioWrite: function (port, value) {
            var pit = this;

            // Set count for counter
            if (port === 0x0040 || port === 0x0041 || port === 0x0042) {
                pit.counters[port - 0x0040].sendHalfCount(value);

                return;
            // Set control word
            } else if (port === 0x0043) {
                (function () {
                    /*jshint bitwise: false */
                    var counterIndex = (value >> 6) & 0x02,
                        operatingMode = (value >> 1) & 0x07,
                        readLoadMode = (value >> 4) & 0x03,
                        binaryOrBCD = value & 1;

                    pit.counters[counterIndex].configure(binaryOrBCD, operatingMode, readLoadMode);
                }());

                return;
            }

            pit.system.debug("PIT.ioWrite() :: Unsupported write");
        },

        reset: function () {
            var pit = this;

            return pit;
        }
    });

    return PIT;
});
