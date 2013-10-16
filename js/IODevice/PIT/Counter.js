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

    var INTERRUPT_ON_TERMINAL_COUNT = 0,
        HARDWARE_TRIGGERED_ONE_SHOT = 1,
        RATE_GENERATOR = 2,
        SQUARE_WAVE_GENERATOR = 3,
        SOFTWARE_TRIGGERED_STROBE = 4,
        HARDWARE_TRIGGERED_STROBE = 5,
        MODE_HIGH = 0,
        MODE_LOW = 1,
        READ_LOAD_INTERNAL_CONTROL_REG = 0,
        READ_LOAD_LSB_ONLY = 1,
        READ_LOAD_MSB_ONLY = 2,
        READ_LOAD_LSB_THEN_MSB = 3;

    // Constructor / pre-init
    function Counter(system) {
        EventEmitter.call(this);

        this.count = 0;
        this.enabled = false;
        this.halfLoadedCount = null;
        this.mode = MODE_LOW;
        this.operatingMode = null;
        this.previousTicks = null;
        this.readLoadMode = null;
        this.system = system;
        this.timer = system.createTimer();
        this.type = null;
    }

    util.inherit(Counter).from(EventEmitter);

    util.extend(Counter.prototype, {
        configure: function (type, operatingMode, readLoadMode) {
            var counter = this;

            counter.enabled = false;
            counter.halfLoadedCount = false;
            counter.operatingMode = operatingMode;
            counter.readLoadMode = readLoadMode;
            counter.type = type;
        },

        init: function () {
            var counter = this;

            counter.timer.on("elapse", function () {
                onElapse(counter);
            });

            return counter;
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
        }
    });

    function onElapse(counter) {
        if (!counter.enabled) {
            return;
        }

        if (counter.operatingMode === RATE_GENERATOR) {
            if (counter.mode === MODE_LOW) {
                counter.emit("out high");
                counter.mode = MODE_HIGH;

                counter.previousTicks += counter.count;

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

            counter.previousTicks += counter.count / 2;

            counter.timer.triggerAtTicks(counter.previousTicks);
        }
    }

    return Counter;
});
