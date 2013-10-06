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

    var global = util.global,
        getMicrosecondsNow = global.performance ? function () {
            /*jshint bitwise: false */
            return (global.performance.now() * 1000) >> 0;
        } : function () {
            return Date.now() * 1000;
        };

    function Clock() {

    }

    util.extend(Clock.prototype, {
        getMicrosecondsNow: getMicrosecondsNow
    });

    return Clock;
});
