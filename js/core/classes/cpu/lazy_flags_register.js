/*
 *  jemul8 - JavaScript x86 Emulator
 *  Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *
 * MODULE: Lazy Flags Register class support
 *
 * ====
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*jslint bitwise: true, plusplus: true */
/*global define, require */

define([
    "../../util",
    "./lazy_flag",
    "./unlazy_flag"
], function (
    util,
    LazyFlag,
    UnlazyFlag
) {
    "use strict";

    // LazyFlagRegister (eg. EFLAGS) class constructor
    function LazyFlagRegister(name, size) {
        util.assert(this && (this instanceof LazyFlagRegister)
            , "LazyFlagRegister constructor :: error - not called properly"
        );

        this.cpu = null; // Set on installation

        this.name = name;
        this.size = size;
        this.mask = util.generateMask(size);

        this.hsh_flg = [];

        // Bit array; set bits indicate dirty flags
        //    (must be evaluated next time they are read)
        this.bitsDirty = 0x00000000;
    }
    LazyFlagRegister.prototype.install = function (component) {
        switch (component.constructor) {
        // Install a compatible Register onto the emulated CPU
        case LazyFlag:    // Fall through
        case UnlazyFlag:
            component.cpu = this.cpu;
            this.cpu[ component.name ] = component;
            this.hsh_flg[ component.name ] = component;
            break;
        default:
            util.problem("x86CPU.install :: Provided component cannot be installed into the CPU.");
        }
    };
    // Register is rarely evaluated in full, so performance is heavily biased toward
    //    speed in the Flags themselves - each stores their value independent of
    //    this Register
    // TODO: make this polymorphic as size is going to be 8, 16, 32, 64 or 128 bits
    LazyFlagRegister.prototype.get = function () {
        var idx_bit;
        var num_bit = this.size * 8;
        var value = 0;
        var hsh_flg = this.hsh_flg;
        var mask;

        // Hash contains one Flag per Bit in register
        for (idx_bit = 0 ; idx_bit < num_bit ; ++idx_bit) {
            //value |= hsh_flg[ idx_bit ].get() << idx_bit;
            // Don't allow two's complement sign-extension with high bits
            mask = idx_bit < 31 ? ((1 << (idx_bit + 1)) - 1) : 0xFFFFFFFF;
            value = (value | (hsh_flg[ idx_bit ].get() << idx_bit)) & mask;
        }

        return value;
    };
    // Register is rarely evaluated in full, so performance is heavily biased toward
    //    speed in the Flags themselves - each stores their value independent of
    //    this Register
    // TODO: make this polymorphic as size is going to be 8, 16, 32, 64 or 128 bits
    LazyFlagRegister.prototype.set = function (val) {
        var idx_bit;
        var num_bit = this.size * 8;
        var hsh_flg = this.hsh_flg;

        // Hash contains one Flag per Bit in register
        for (idx_bit = 0 ; idx_bit < num_bit ; ++idx_bit) {
            hsh_flg[ idx_bit ].setBin(!!(val & (1 << idx_bit)));
        }
        // All bits have just been set; none can be dirty so just quickly clean list out
        this.bitsDirty = 0x00000000;
    };
    // Returns a nicely formatted hex string, with register value, padded to its size
    LazyFlagRegister.prototype.getHexString = function () {
        var val = this.get().toString(16).toUpperCase();
        var sizeHexChars = this.size * 2;
        var textLeadingZeroes = new Array(sizeHexChars - val.length + 1).join("0");
        // Use spaces to right-align hex characters with the full 32-bit ones (8 chars)
        var textLeadingSpaces = new Array(8 - sizeHexChars + 1).join(" ");

        return textLeadingSpaces + textLeadingZeroes + val;
    };
    LazyFlagRegister.prototype.getName = function () {
        return this.name;
    };
    LazyFlagRegister.prototype.getSize = function () {
        return this.size;
    };

    // Exports
    return LazyFlagRegister;
});
