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
    "js/util"
], function (
    util
) {
    "use strict";

    var TICKS_PER_MICROSECOND = 1193.181,
        global = util.global,
        getMicrosecondsNow,
        getTicksNow;

    if (global.performance) {
        getMicrosecondsNow = function () {
            /*jshint bitwise: false */
            return (global.performance.now() * 1000) >>> 0;
        };
        getTicksNow = function () {
            /*jshint bitwise: false */
            return (global.performance.now() * TICKS_PER_MICROSECOND) >>> 0;
        };
    } else {
        getMicrosecondsNow = function () {
            /*jshint bitwise: false */
            return (Date.now() * 1000) >>> 0;
        };
        getTicksNow = function () {
            /*jshint bitwise: false */
            return (Date.now() * TICKS_PER_MICROSECOND) >>> 0;
        };
    }

    function Clock() {

    }

    util.extend(Clock.prototype, {
        getMicrosecondsNow: getMicrosecondsNow,
        getTicksNow: getTicksNow
    });

    return Clock;
});
