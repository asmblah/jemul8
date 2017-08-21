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
    "js/EventEmitter"
], function (
    util,
    EventEmitter
) {
    "use strict";

    var BINARY_MODE = 0,
        BCD_MODE = 1,
        INTERRUPT_ON_TERMINAL_COUNT = 0,
        HARDWARE_TRIGGERED_ONE_SHOT = 1,
        RATE_GENERATOR = 2,
        SQUARE_WAVE_GENERATOR = 3,
        SOFTWARE_TRIGGERED_STROBE = 4,
        HARDWARE_TRIGGERED_STROBE = 5,
        MODE_HIGH = 0,
        MODE_LOW = 1,
        READ_LOAD_LATCH_COUNT = 0,
        READ_LOAD_LSB_ONLY = 1,
        READ_LOAD_MSB_ONLY = 2,
        READ_LOAD_LSB_THEN_MSB = 3;

    // Constructor / pre-init
    function Counter(system, timer) {
        var counter = this;

        EventEmitter.call(this);

        this.binaryOrBCD = null;
        this.count = 0;
        this.enabled = false;
        this.halfLoadedCount = false;
        this.latchedCount = 0;
        this.mode = MODE_LOW;
        this.operatingMode = null;
        this.previousTicks = null;
        this.readLoadMode = null;
        this.system = system;
        this.timer = timer;

        this.timer.on("elapse", function () {
            onElapse(counter);
        });
    }

    util.inherit(Counter).from(EventEmitter);

    util.extend(Counter, {
        BINARY_MODE: BINARY_MODE,
        BCD_MODE: BCD_MODE,

        INTERRUPT_ON_TERMINAL_COUNT: INTERRUPT_ON_TERMINAL_COUNT,
        HARDWARE_TRIGGERED_ONE_SHOT: HARDWARE_TRIGGERED_ONE_SHOT,
        RATE_GENERATOR: RATE_GENERATOR,
        SQUARE_WAVE_GENERATOR: SQUARE_WAVE_GENERATOR,
        SOFTWARE_TRIGGERED_STROBE: SOFTWARE_TRIGGERED_STROBE,
        HARDWARE_TRIGGERED_STROBE: HARDWARE_TRIGGERED_STROBE,

        READ_LOAD_LATCH_COUNT: READ_LOAD_LATCH_COUNT,
        READ_LOAD_LSB_ONLY: READ_LOAD_LSB_ONLY,
        READ_LOAD_MSB_ONLY: READ_LOAD_MSB_ONLY,
        READ_LOAD_LSB_THEN_MSB: READ_LOAD_LSB_THEN_MSB
    });

    util.extend(Counter.prototype, {
        configure: function (binaryOrBCD, operatingMode, readLoadMode) {
            var counter = this;

            counter.binaryOrBCD = binaryOrBCD;
            counter.enabled = false;
            counter.halfLoadedCount = false;
            counter.operatingMode = operatingMode;
            counter.readLoadMode = readLoadMode;

            if (readLoadMode === READ_LOAD_LATCH_COUNT) {
                counter.latchedCount = counter.count;
            }
        },

        receiveHalfCount: function () {
            /*jshint bitwise: false */
            var counter = this;

            if (counter.readLoadMode === READ_LOAD_LSB_ONLY) {
                return this.count & 0xff;
            }

            if (counter.readLoadMode === READ_LOAD_MSB_ONLY) {
                return this.count >>> 8;
            }

            if (counter.readLoadMode === READ_LOAD_LSB_THEN_MSB) {
                if (counter.halfLoadedCount) {
                    counter.halfLoadedCount = false;

                    return counter.count >>> 8;
                }

                counter.halfLoadedCount = true;

                return counter.count & 0xff;
            }

            if (counter.readLoadMode === READ_LOAD_LATCH_COUNT) {
                if (counter.halfLoadedCount) {
                    counter.halfLoadedCount = false;

                    return counter.latchedCount >>> 8;
                }

                counter.halfLoadedCount = true;

                return counter.latchedCount & 0xff;
            }
        },

        sendHalfCount: function (halfCount) {
            var counter = this;

            if (counter.readLoadMode === READ_LOAD_LSB_THEN_MSB) {
                if (counter.halfLoadedCount) {
                    /*jshint bitwise: false */
                    counter.count |= halfCount << 8;
                } else {
                    counter.count = halfCount;
                }
            }

            counter.halfLoadedCount = !counter.halfLoadedCount;

            if (!counter.halfLoadedCount) {
                counter.enabled = true;
                counter.mode = MODE_LOW;
                counter.previousTicks = counter.system.getTicksNow();
                counter.timer.triggerAtTicks(counter.previousTicks + 1);
            }
        },

        setCount: function (count) {
            this.count = count;
        }
    });

    function onElapse(counter) {
        var count;

        if (!counter.enabled) {
            return;
        }

        count = counter.count === 0 ? 0xFFFF + 1 : counter.count;

        if (counter.operatingMode === RATE_GENERATOR) {
            if (counter.mode === MODE_LOW) {
                counter.emit("out high");
                counter.mode = MODE_HIGH;

                counter.previousTicks += count;

                counter.timer.triggerAtTicks(counter.previousTicks);
            } else {
                counter.emit("out low");
                counter.mode = MODE_LOW;

                counter.previousTicks += 1;

                counter.timer.triggerAtTicks(counter.previousTicks);
            }
        } else if (counter.operatingMode === SQUARE_WAVE_GENERATOR) {
            if (counter.mode === MODE_LOW) {
                counter.emit("out high");
                counter.mode = MODE_HIGH;
            } else {
                counter.emit("out low");
                counter.mode = MODE_LOW;
            }

            counter.previousTicks += count / 2;

            counter.timer.triggerAtTicks(counter.previousTicks);
        }
    }

    return Counter;
});
