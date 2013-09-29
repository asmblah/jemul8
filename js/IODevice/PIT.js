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
    "js/IODevice",
    "js/Promise"
], function (
    util,
    IODevice,
    Promise
) {
    "use strict";

    // Microseconds (us) === 1000 * 1000 per second,
    //  but clock signal is 1193181 (because of oscillator/crystal).
    //  Slight difference between the two, but enough to warrant additional
    //  calculations for accuracy.

    var USEC_PER_SECOND = 1000000,  // Of course: 1000ms * 1000 = us, but...
        TICKS_PER_SECOND = 1193181, // ... because of 1.193181MHz clock.
        global = util.global;

    // Constructor / pre-init
    function PIT(system, io, memory, options) {
        IODevice.call(this, "PIT", system, io, memory, options);
    }

    util.inherit(PIT).from(IODevice);

    util.extend(PIT.prototype, {
        init: function () {
            var pit = this,
                promise = new Promise();

            global.setInterval(function () {
                pit.system.raiseIRQ(0);
                setTimeout(function () {
                    pit.system.lowerIRQ(0);
                });
            }, 1000 / 18.2);

            promise.resolve();

            return promise;
        },

        reset: function () {
            var pit = this;

            return pit;
        }
    });

    function ticksToUsec(ticks) {
        return Math.floor((ticks * USEC_PER_SECOND) / TICKS_PER_SECOND);
    }

    function usecToTicks(usec) {
        return Math.floor((usec * TICKS_PER_SECOND) / USEC_PER_SECOND);
    }

    return PIT;
});
