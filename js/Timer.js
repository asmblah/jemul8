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
    "js/EventEmitter",
    "js/Exception"
], function (
    util,
    EventEmitter,
    Exception
) {
    "use strict";

    function Timer(system) {
        EventEmitter.call(this);

        this.enabled = false;
        this.system = system;
        this.triggerTicks = 0;
    }

    util.inherit(Timer).from(EventEmitter);

    util.extend(Timer.prototype, {
        disable: function () {
            this.enabled = false;
        },

        enable: function () {
            var timer = this;

            if (timer.triggerTicks === 0) {
                throw new Exception("Timer.enable() :: Cannot enable a timer with a trigger ticks of zero");
            }

            timer.enabled = true;
        },

        getTriggerTicks: function () {
            return this.triggerTicks;
        },

        isActive: function () {
            return this.enabled;
        },

        tick: function (ticksNow) {
            var elapses = 0,
                previousTriggerTicks,
                timer = this;

            if (timer.enabled && ticksNow >= timer.triggerTicks) {
                timer.enabled = false;

                do {
                    previousTriggerTicks = timer.triggerTicks;
                    timer.emit("elapse");
                } while (
                    timer.enabled &&
                    timer.triggerTicks !== previousTriggerTicks &&
                    ticksNow >= timer.triggerTicks &&
                    ++elapses < 100
                );
            }
        },

        triggerAfterMicroseconds: function (microseconds) {
            var timer = this;

            return timer.triggerAtTicks(timer.system.getTicksNow() + util.microsecondsToTicks(microseconds));
        },

        triggerAfterTicks: function (ticks) {
            var timer = this;

            return timer.triggerAtTicks(timer.system.getTicksNow() + ticks);
        },

        triggerAtTicks: function (ticks) {
            var timer = this;

            timer.triggerTicks = ticks;
            timer.enabled = true;

            return timer;
        }
    });

    return Timer;
});
