/**
 * jemul8 - JavaScript x86 Emulator
 * http://jemul8.com/
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*global define, Uint8Array, Uint16Array, Uint32Array */
define([
    "js/util"
], function (
    util
) {
    "use strict";

    var byteSizeToViewClass = {
        1: Uint8Array,
        2: Uint16Array,
        4: Uint32Array
    };

    function Register(buffer, offset, byteSize, name) {
        this.byteSize = byteSize;
        this.name = name;
        this.view = new byteSizeToViewClass[byteSize](buffer, offset, 1);
    }

    util.extend(Register.prototype, {
        clear: function () {
            var register = this;

            register.view[0] = 0;

            return register;
        },

        createSubRegister: function (byteOffset, byteSize, name) {
            var view = this.view;

            return new Register(view.buffer, view.byteOffset + byteOffset, byteSize, name);
        },

        get: function () {
            return this.view[0];
        },

        // Returns a nicely formatted hex string, with register value, padded to its size
        getHex: function () {
            var register = this;

            return util.hexify(register.get(), register.getSize());
        },

        getName: function () {
            return this.name || null;
        },

        getSize: function () {
            return this.byteSize;
        },

        set: function (value) {
            var register = this;

            register.view[0] = value;

            return register;
        }
    });

    return Register;
});
