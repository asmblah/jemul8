/*
 *  jemul8 - JavaScript x86 Emulator
 *  Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *
 * MODULE: CPU "Lazy" Flag class support
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
    "../../util"
], function (
    util
) {
    "use strict";

    // Flag getter lookups
    var hsh_getCF = {}, hsh_getAF = {}, hsh_getOF = {};

    // CPU Lazy Flag class constructor
    function LazyFlag(name, regMaster, bitsInLeft) {
        util.assert(this && (this instanceof LazyFlag), "LazyFlag ctor ::"
            + " error - constructor not called properly");
        /*util.assert(regMaster && (regMaster instanceof jemul8.LazyFlagRegister)
            , "LazyFlag constructor ::"
            + " no valid master LazyFlagRegister specified.");*/

        this.cpu = null; // Set on installation

        this.bitsInLeft = bitsInLeft;
        this.bitmaskDirtyGet = 1 << bitsInLeft;
        // NB: zero-extend shift-right operator used to force
        //    unsigned result with one's-complement negation
        //    (eg. 0xFFFFFFFF >> 0 == -1, but 0xFFFFFFFF >>> 0 == 0xFFFFFFFF)
        // NB2: opposite is to "num | 0"
        this.bitmaskDirtySet = (~this.bitmaskDirtyGet) >>> 0;

        // NB: It is EXTREMELY important that .value is ALWAYS stored
        //     as a 0 or 1, otherwise the use of identity operators throughout
        //     the code (=== & !==) will fail if comparing booleans to ints!
        this.value = 0;

        this.name = name;
        this.regMaster = regMaster;

        switch (name) {
        case "CF":
            this.hsh_get = hsh_getCF;
            this.get = getWithLookup;
            break;
        case "PF":
            this.get = getPF;
            break;
        case "AF":
            this.hsh_get = hsh_getAF;
            this.get = getWithLookup;
            break;
        case "ZF":
            this.get = getZF;
            break;
        case "SF":
            this.get = getSF;
            break;
        case "OF":
            this.hsh_get = hsh_getOF;
            this.get = getWithLookup;
            break;
        // Unsupported Lazy Flag type
        default:
            util.problem("LazyFlag constructor :: Unsupported Lazy Flag");
        }

        // Add to master LazyFlagsRegister's hash
        regMaster.hsh_flg[ bitsInLeft ] = this;
    }
    LazyFlag.prototype.get = null; // Polymorphic
    LazyFlag.prototype.set = function () {
        // Flag is definitely not dirty; clear dirty bit in Register
        this.regMaster.bitsDirty = (this.regMaster.bitsDirty
            & this.bitmaskDirtySet) >>> 0;
        this.value = 1;
    };
    LazyFlag.prototype.clear = function () {
        // Flag is definitely not dirty; clear dirty bit in Register
        this.regMaster.bitsDirty = (this.regMaster.bitsDirty
            & this.bitmaskDirtySet) >>> 0;
        this.value = 0;
    };
    LazyFlag.prototype.setBin = function (val) {
        // Flag is definitely not dirty; clear dirty bit in Register
        this.regMaster.bitsDirty = (this.regMaster.bitsDirty
            & this.bitmaskDirtySet) >>> 0;
        // Should be faster than eg. val ? 1 : 0
        //this.value = val & 1;
        this.value = val ? 1 : 0;
        //if (val > 1) { debugger; }
    };
    LazyFlag.prototype.toggle = function () {
        this.set(!this.get());
    };

    /* =========== Lazy Flags evaluation =========== */
    // Based on Bochs source code: cpu/lazy_flags.cc

    // These flags' calculations are the same for all instructions
    function getPF() {
        // When flagged as dirty, reads must evaluate flag from result
        //    of last operation
        if (this.regMaster.bitsDirty & this.bitmaskDirtyGet) {
            // Simple lookup for parity of low 8 bits
            this.value = mapParity[ this.cpu.resLast & 0xFF ];
            // Flag is no longer dirty; clear dirty bit in Register
            this.regMaster.bitsDirty = (this.regMaster.bitsDirty
                & this.bitmaskDirtySet) >>> 0;
        }
        return this.value;
    }
    function getZF() {
        // When flagged as dirty, reads must evaluate flag from result
        //    of last operation
        if (this.regMaster.bitsDirty & this.bitmaskDirtyGet) {
            this.value = (this.cpu.resLast === 0) & 1;
            // Flag is no longer dirty; clear dirty bit in Register
            this.regMaster.bitsDirty = (this.regMaster.bitsDirty
                & this.bitmaskDirtySet) >>> 0;
        }
        return this.value;
    }
    function getSF() {
        // When flagged as dirty, reads must evaluate flag from result
        //    of last operation
        if (this.regMaster.bitsDirty & this.bitmaskDirtyGet) {
            // Sign flag set if negative (use two's-complement signed high-bit check)
            //this.value = (this.cpu.resLast >> 31);
            switch (this.cpu.insnLast.operand1.size) {
            case 1:
                this.value = (this.cpu.resLast >> 7) & 1;
                break;
            case 2:
                this.value = (this.cpu.resLast >> 15) & 1;
                break;
            case 4:
                this.value = (this.cpu.resLast >> 31) & 1;
                break;
            }

            // Flag is no longer dirty; clear dirty bit in Register
            this.regMaster.bitsDirty = (this.regMaster.bitsDirty & this.bitmaskDirtySet) >>> 0;
        }
        return this.value;
    }
    // Other flags' values depend on the instruction
    function getWithLookup() {
        var cpu = this.cpu;
        // When flagged as dirty, reads must evaluate flag from result
        //    of last operation
        if (this.regMaster.bitsDirty & this.bitmaskDirtyGet) {
            if (this.hsh_get[ cpu.insnLast.name ]) {
                this.value = this.hsh_get[ cpu.insnLast.name ](cpu);
            } else {
                //debugger;
                util.warning("Cannot calculate value for lazy-flag " + this.name
                    + ", leaving unchanged (this needs fixing!!!)");
            }

            // Flag is no longer dirty; clear dirty bit in Register
            this.regMaster.bitsDirty = (this.regMaster.bitsDirty
                & this.bitmaskDirtySet) >>> 0;
        }
        return this.value;
    }

    // Carry Flag
    hsh_getCF[ "ADD" ] = function (cpu) {
        return (cpu.resLast < cpu.valLast1) & 1;
    };
    hsh_getCF[ "ADC" ] = function (cpu) {
        // Calc flags as for ADD if CF was not set
        if (!cpu.insnLast.lastCF) {
            return hsh_getCF[ "ADD" ](cpu);
        }

        return (cpu.resLast <= cpu.valLast1) & 1;
    };
    hsh_getCF[ "SUB" ]
    = hsh_getCF[ "CMP" ] = hsh_getCF[ "CMPS" ]
    = hsh_getCF[ "SCAS" ] = function (cpu) {
        return (cpu.valLast1 < cpu.valLast2) & 1;
    };
    hsh_getCF[ "SBB" ] = function (cpu) {
        var sizeOperand = cpu.insnLast.operand1.size;
        var op1 = cpu.valLast1;
        var op2 = cpu.valLast2;
        var res = cpu.resLast;

        // Calc flags as for SUB if CF was not set
        if (!cpu.insnLast.lastCF) {
            return hsh_getCF[ "SUB" ](cpu);
        }

        if (sizeOperand === 4) {
            return ((op1 < res) || (op2 === 0xFFFFFFFF)) & 1;
        } else if (sizeOperand === 2) {
            return ((op1 < res) || (op2 === 0xFFFF)) & 1;
        } else {
            return ((op1 < res) || (op2 === 0xFF)) & 1;
        }

        //var bitmask = (1 << (cpu.insnLast.operand1.size * 8)) - 1;
        //return ((cpu.valLast1 < cpu.resLast) || (cpu.valLast2 === bitmask)) & 1;
    };
    hsh_getCF[ "NEG" ] = function (cpu) {
        return (cpu.resLast !== 0) & 1;
    };
    hsh_getCF[ "INC" ]
    = hsh_getCF[ "DEC" ] = function (cpu) {
        util.panic("INC & DEC should preserve state!");
        return 0;
    };
    hsh_getCF[ "AND" ] = hsh_getCF[ "OR" ] = hsh_getCF[ "XOR" ]
    = hsh_getCF[ "NOT" ] = hsh_getCF[ "TEST" ]
    = hsh_getCF[ "MUL" ] = hsh_getCF[ "IMUL" ]
    = hsh_getCF[ "DIV" ] = hsh_getCF[ "DEC" ]
    = hsh_getCF[ "SHL" ] = hsh_getCF[ "SAL" ]
    = hsh_getCF[ "SHR" ] = hsh_getCF[ "SAR" ]
    = function (cpu) {
        return 0;
    };

    // Auxiliary / BCD Adjustment Flag
    hsh_getAF[ "ADD" ] = hsh_getAF[ "ADC" ]
    = hsh_getAF[ "SUB" ] = hsh_getAF[ "SBB" ]
    = hsh_getAF[ "CMP" ] = hsh_getAF[ "CMPS" ]
    = hsh_getAF[ "SCAS" ]
    = function (cpu) {
        return ((
            ((cpu.valLast1 & 0xFF) ^ (cpu.valLast2 & 0xFF))
            ^ (cpu.resLast & 0xFF)
        ) & 0x10) ? 1 : 0;
    };
    hsh_getAF[ "NEG" ] = function (cpu) {
        return ((cpu.resLast & 0x0F) !== 0) & 1;
    };
    hsh_getAF[ "INC" ] = function (cpu) {
        return ((cpu.resLast & 0x0F) === 0) & 1;
    };
    hsh_getAF[ "DEC" ] = function (cpu) {
        return ((cpu.resLast & 0x0F) === 0x0F) & 1;
    };
    hsh_getAF[ "AND" ] = hsh_getAF[ "OR" ] = hsh_getAF[ "XOR" ]
    = hsh_getAF[ "NOT" ] = hsh_getAF[ "TEST" ]
    = hsh_getAF[ "MUL" ] = hsh_getAF[ "IMUL" ]
    = hsh_getAF[ "DIV" ]
    = hsh_getAF[ "SHL" ] = hsh_getAF[ "SAL" ]
    = hsh_getAF[ "SHR" ] = hsh_getAF[ "SAR" ]
    = function (cpu) {
        return 0;
    };

    // Overflow Flag
    hsh_getOF[ "ADD" ] = hsh_getOF[ "ADC" ]
    = function (cpu) {
        return (((
            (cpu.valLast1 ^ cpu.resLast) & (cpu.valLast2 ^ cpu.resLast)
        ) & 0x80000000) != 0) & 1;
    };
    hsh_getOF[ "SUB" ] = hsh_getOF[ "SBB" ]
    = hsh_getOF[ "CMP" ] = hsh_getOF[ "CMPS" ]
    = hsh_getOF[ "SCAS" ]
    = function (cpu) {
        return (((
            (cpu.valLast1 ^ cpu.valLast2) & (cpu.valLast1 ^ cpu.resLast)
        ) & 0x80000000) != 0) & 1;
    };
    hsh_getOF[ "NEG" ] = hsh_getOF[ "INC" ] = function (cpu) {
        // eg. 80, 8000, 80000000
        //var half = Math.pow(2, cpu.insnLast.operand1.size * 8 - 1);
        //return (cpu.resLast === half) & 1;
        switch (cpu.insnLast.operand1.size) {
        case 1:
            return ((cpu.resLast & 0xFF) === 0x80) & 1;
        case 2:
            return ((cpu.resLast & 0xFFFF) === 0x8000) & 1;
        case 4:
            return ((cpu.resLast & 0xFFFFFFFF) === 0x80000000) & 1;
        default:
            jemul8.panic("Invalid operand size");
        }
    };
    hsh_getOF[ "DEC" ] = function (cpu) {
        //util.assert(cpu.insnLast.operand1.size < 4
        //    , "Needs to call .generateMask() if this ever occurs");

        // eg. 7F, 7FFF, 7FFFFFFF
        //var half = ((1 << (cpu.insnLast.operand1.size * 8)) - 1) / 2;
        //return (cpu.resLast === half) & 1;
        switch (cpu.insnLast.operand1.size) {
        case 1:
            return ((cpu.resLast & 0xFF) === 0x7F) & 1;
        case 2:
            return ((cpu.resLast & 0xFFFF) === 0x7FFF) & 1;
        case 4:
            return ((cpu.resLast & 0xFFFFFFFF) === 0x7FFFFFFF) & 1;
        default:
            jemul8.panic("Invalid operand size");
        }
    };
    hsh_getOF[ "AND" ] = hsh_getOF[ "OR" ] = hsh_getOF[ "XOR" ]
    = hsh_getOF[ "NOT" ] = hsh_getOF[ "TEST" ]
    = hsh_getOF[ "MUL" ] = hsh_getOF[ "IMUL" ]
    = hsh_getOF[ "DIV" ] = function (cpu) {
        return 0;
    };
    /* =========== /Lazy Flags evaluation =========== */

    // Determine whether there are an odd or even number
    //    of set bits in number "num"
    function getParity(num) {
        var res = 0;

        while (num) {
            ++res;
            // Loop will execute once for each bit set in num
            num &= num - 1;
        }
        return (res % 2 === 0) & 1;
    }

    // Cache parity values up to 0xFF in lookup table
    //  (eg. mapParity[val & 0xFF])
    var mapParity = {};
    for (var num = 0 ; num <= 0xFF ; ++num) {
        mapParity[ num ] = getParity(num);
    }

    // Exports
    return LazyFlag;
});
