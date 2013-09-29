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

    function Pin() {
        this.high = false;
    }

    util.extend(Pin.prototype, {
        isHigh: function () {
            return this.high;
        },

        lower: function () {
            this.high = false;
        },

        raise: function () {
            this.high = true;
        }
    });

    return Pin;
});
