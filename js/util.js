/**
 * jemul8 - JavaScript x86 Emulator v0.0.1
 * http://jemul8.com/
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*global define */
define([
    "modular"
], function (
    modular
) {
    "use strict";

    var create = Object.create || function (from) {
        function F() {}
        F.prototype = from;
        return new F();
    },
        util = create(modular.util);

    return util.extend(util, {
        // Create a bitmask for the specified value size in bytes
        // - eg. for masking off higher bits of a value to fit it into a CPU register
        generateMask: function (size) {
            /*jslint bitwise: true */

            // 4 bytes creates a number that is too large for ECMAScript
            // - (before the -1) ... in Chrome/FF, the result would be zero,
            //   so we hard-code this particular scenario.
            if (size < 4) {
                return (1 << size * 8) - 1;
            } else {
                return 0xFFFFFFFF;
            }
        },

        inherit: function (To) {
            return {
                from: function (From) {
                    To.prototype = create(From.prototype);
                    To.prototype.constructor = To;
                }
            };
        },

        mask: function (number, mask) {
            /*jslint bitwise: true */

            return (number & mask) >>> 0;
        }
    });
});
