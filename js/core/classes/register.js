/*
 * jemul8 - JavaScript x86 Emulator
 *
 * MODULE: Register class support
 *
 * ====
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*global define */
define([
    "js/util",
    "./decoder/register"
], function (
    util,
    DecoderRegister
) {
    "use strict";

    // Register (eg. CPU registers EAX, EBX) class constructor
    //  (NB: also used by I/O devices eg. CMOS)
    function Register(name, size) {
        DecoderRegister.call(this, name, size);

        if (!size) {
            size = 0;
        }

        this.value = 0;
        this.mask = util.generateMask(size);
    }

    util.inherit(Register).from(DecoderRegister);

    util.extend(Register.prototype, {
        clear: function () {
            this.set(0x00);
        },

        get: function () {
            return this.value;
        },

        // Returns a nicely formatted hex string, with register value, padded to its size
        getHexString: function () {
            /*jslint bitwise: true */

            var val = (this.get() >>> 0).toString(16).toUpperCase(),
                sizeHexChars = this.getSize() * 2,
                textLeadingZeroes = new Array(sizeHexChars - val.length + 1).join("0"),
                // Use spaces to right-align hex characters with the full 32-bit ones (8 chars)
                textLeadingSpaces = new Array(8 - sizeHexChars + 1).join(" ");

            return textLeadingSpaces + textLeadingZeroes + val;
        },

        set: function (val) {
            /*jslint bitwise: true */

            // Mask out bits of value outside Register's bit-width
            this.value = (val & this.mask) >>> 0;
        }
    });

    return Register;
});
