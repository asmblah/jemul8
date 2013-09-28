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
    "js/Emulator",
    "js/core/classes/emulator"
], function (
    util,
    Emulator,
    LegacyJemul8
) {
    "use strict";

    function Jemul8() {

    }

    util.extend(Jemul8.prototype, {
        createEmulator: function (options) {
            var legacyJemul8 = new LegacyJemul8(options);

            return new Emulator(legacyJemul8);
        }
    });

    return Jemul8;
});
