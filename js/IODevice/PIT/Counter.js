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

        MODE_NOT_STARTED = 0,
        MODE_HIGH = 1,
        MODE_LOW = 2,

        READ_LOAD_LATCH_COUNT = 0,
        READ_LOAD_LSB_ONLY = 1,
        READ_LOAD_MSB_ONLY = 2,
        READ_LOAD_LSB_THEN_MSB = 3,

        NOT_LOADED = 0,
        HALF_LOADED = 1,
        FULLY_LOADED = 2,

        goLow = function (counter) {
            counter.mode = MODE_LOW;
            counter.emit("out low");
        },

        goHigh = function (counter) {
            counter.mode = MODE_HIGH;
            counter.emit("out high");
        };

    // Constructor / pre-init
    function Counter(system, timer) {
        var counter = this;

        EventEmitter.call(this);

        this.binaryOrBCD = null;
        this.enabled = false;
        this.initialCount = 0;
        this.latchedCount = 0;
        this.loadState = NOT_LOADED;
        this.mode = MODE_LOW;
        this.nextElapseTicks = 0;
        this.operatingMode = null;
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
            counter.loadState = NOT_LOADED;
            counter.mode = MODE_NOT_STARTED;
            counter.operatingMode = operatingMode;
            counter.readLoadMode = readLoadMode;

            if (readLoadMode === READ_LOAD_LATCH_COUNT) {
                counter.latchedCount = counter.getCount();
            }
        },

        /**
         * Fetches the current value of this counter.
         * Note that as we don't exactly simulate a real 8254 (by triggering every tick)
         * we need to calculate what the count would be depending on the current time
         * and this counter's current operating mode
         *
         * @returns {number}
         */
        getCount: function () {
            var counter = this,
                currentTicks = counter.system.getTicksNow(),
                ticksRemainingUntilElapse = counter.nextElapseTicks - currentTicks;

            if (counter.operatingMode === SQUARE_WAVE_GENERATOR && counter.mode === MODE_HIGH) {
                // In square wave mode, the timer elapses every half-count,
                // so we need to adjust only in the first half of each counting cycle
                ticksRemainingUntilElapse += counter.initialCount / 2;
            }

            if (ticksRemainingUntilElapse < 0) {
                ticksRemainingUntilElapse = 0;
            }

            return ticksRemainingUntilElapse;
        },

        /**
         * Fetches the initial count that this counter was loaded with
         * (not necessarily the same as the _current_ count, if some ticks have passed
         * since it was loaded)
         *
         * @returns {number}
         */
        getInitialCount: function () {
            return this.initialCount;
        },

        /**
         * Returns true if this counter's OUT is currently high, false otherwise
         *
         * @returns {boolean}
         */
        isOutHigh: function () {
            return this.mode === MODE_HIGH;
        },

        receiveHalfCount: function () {
            /*jshint bitwise: false */
            var counter = this;

            if (counter.readLoadMode === READ_LOAD_LSB_ONLY) {
                return this.getCount() & 0xff;
            }

            if (counter.readLoadMode === READ_LOAD_MSB_ONLY) {
                return this.getCount() >>> 8;
            }

            if (counter.readLoadMode === READ_LOAD_LSB_THEN_MSB) {
                if (counter.loadState === HALF_LOADED) {
                    counter.loadState = NOT_LOADED;

                    return counter.getCount() >>> 8;
                }

                counter.loadState = HALF_LOADED;

                return counter.getCount() & 0xff;
            }

            if (counter.readLoadMode === READ_LOAD_LATCH_COUNT) {
                if (counter.loadState === HALF_LOADED) {
                    counter.loadState = NOT_LOADED;

                    return counter.latchedCount >>> 8;
                }

                counter.loadState = HALF_LOADED;

                return counter.latchedCount & 0xff;
            }
        },

        sendHalfCount: function (halfCount) {
            var counter = this;

            if (counter.readLoadMode === READ_LOAD_LSB_ONLY) {
                counter.initialCount = halfCount;

                counter.loadState = FULLY_LOADED;
            } else if (counter.readLoadMode === READ_LOAD_LSB_THEN_MSB) {
                if (counter.loadState === NOT_LOADED) {
                    counter.initialCount = halfCount;

                    counter.loadState = HALF_LOADED;
                } else if (counter.loadState === HALF_LOADED) {
                    /*jshint bitwise: false */
                    counter.initialCount |= halfCount << 8;

                    counter.loadState = FULLY_LOADED;
                } else {
                    throw new Error('Tried to read count for a second time');
                }
            } else {
                throw new Error('Read/load mode ' + counter.readLoadMode + ' not fully supported');
            }

            if (counter.loadState === FULLY_LOADED) {
                counter.enabled = true;
                counter.loadState = NOT_LOADED;
                counter.mode = MODE_NOT_STARTED;

                // Intel docs say that count won't be loaded until the next CLK pulse,
                // but I think we can safely ignore that here and load it immediately
                counter.nextElapseTicks = counter.system.getTicksNow();
                onElapse(counter);
            }
        }
    });

    function onElapse(counter) {
        var initialCount;

        if (!counter.enabled) {
            return;
        }

        initialCount = counter.initialCount === 0 ? 0xFFFF + 1 : counter.initialCount;

        if (counter.operatingMode === INTERRUPT_ON_TERMINAL_COUNT) {
            if (counter.mode === MODE_NOT_STARTED) {
                goLow(counter);

                counter.nextElapseTicks += initialCount;

                counter.timer.triggerAtTicks(counter.nextElapseTicks);
            } else {
                goHigh(counter);
            }
        } else if (counter.operatingMode === RATE_GENERATOR) {
            if (counter.mode === MODE_NOT_STARTED) {
                goHigh(counter); // OUT will initially be high for this mode

                counter.nextElapseTicks += initialCount;

                counter.timer.triggerAtTicks(counter.nextElapseTicks);
            } else if (counter.mode === MODE_LOW) {
                goHigh(counter);

                counter.nextElapseTicks += initialCount;

                counter.timer.triggerAtTicks(counter.nextElapseTicks);
            } else {
                goLow(counter);

                counter.nextElapseTicks += 1;

                counter.timer.triggerAtTicks(counter.nextElapseTicks);
            }
        // TODO: What is mode 7, and is this correct?
        } else if (counter.operatingMode === SQUARE_WAVE_GENERATOR || counter.operatingMode === 7) {
            if (counter.mode === MODE_NOT_STARTED) {
                goHigh(counter); // OUT will initially be high for this mode
            } else if (counter.mode === MODE_LOW) {
                goHigh(counter);
            } else {
                goLow(counter);
            }

            counter.nextElapseTicks += initialCount / 2;

            counter.timer.triggerAtTicks(counter.nextElapseTicks);
        } else {
            throw new Error('Counter mode ' + counter.operatingMode + ' not supported');
        }
    }

    return Counter;
});
