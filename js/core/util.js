/*
 *  jemul8 - JavaScript x86 Emulator
 *  Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *
 * MODULE: Miscellaneous utilities
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
    "modular"
], function (
    modular
) {
    "use strict";

    var util = {};

    util.extend = modular.util.extend;
    util.each = modular.util.each;
    util.global = modular.util.global;
    util.isFunction = modular.util.isFunction;

    util.extend(util, {
    // Mask applied to addresses presented at the address bus, depending
    //  on setting of A20MASK#
        MASK_ENABLE_A20:    0xFFFFFFFF
        , MASK_DISABLE_A20: 0xFFeFFFFF

    // Type of reset: warm (software) or cold (hardware)
        , RESET_HARDWARE: 1
        , RESET_SOFTWARE: 2

    // CPU interrupt/exception types
        , EXTERNAL_INTERRUPT: 0
        , NMI: 2
        , HARDWARE_EXCEPTION: 3 // All exceptions except #BP and #OF
        , SOFTWARE_INTERRUPT: 4
        , PRIVILEGED_SOFTWARE_INTERRUPT: 5
        , SOFTWARE_EXCEPTION: 6

    // CPU exception vectors
        , DE_EXCEPTION: 0 // Divide Error (fault)
        , DB_EXCEPTION: 1 // Debug (fault/trap)
        , BP_EXCEPTION: 3 // Breakpoint (trap)
        , OF_EXCEPTION: 4 // Overflow (trap)
        , BR_EXCEPTION: 5 // BOUND (fault)
        , UD_EXCEPTION: 6
        , NM_EXCEPTION: 7
        , DF_EXCEPTION: 8
        , TS_EXCEPTION: 10
        , NP_EXCEPTION: 11
        , SS_EXCEPTION: 12
        , GP_EXCEPTION: 13
        , PF_EXCEPTION: 14
        , MF_EXCEPTION: 16
        , AC_EXCEPTION: 17
        , MC_EXCEPTION: 18
        , XM_EXCEPTION: 19
        // Total no. of handled exceptions
        , CPU_HANDLED_EXCEPTIONS: 20

    // Descriptor access types
        , ACCESS_INVALID     : 0x00
        , ACCESS_VALID_CACHE : 0x01
        , ACCESS_ROK         : 0x02
        , ACCESS_WOK         : 0x04

    // Descriptor types
        // For system & gate descriptors:
        , DESC_GATE_TYPE_NONE                       : 0x0
        , DESC_SYS_SEGMENT_AVAIL_286_TSS            : 0x1
        , DESC_SYS_SEGMENT_LDT                      : 0x2
        , DESC_SYS_SEGMENT_BUSY_286_TSS             : 0x3
        , DESC_286_CALL_GATE                        : 0x4
        , DESC_TASK_GATE                            : 0x5
        , DESC_286_INTERRUPT_GATE                   : 0x6
        , DESC_286_TRAP_GATE                        : 0x7
                                                   // 0x8 reserved
        , DESC_SYS_SEGMENT_AVAIL_386_TSS            : 0x9
                                                   // 0xA reserved
        , DESC_SYS_SEGMENT_BUSY_386_TSS             : 0xB
        , DESC_386_CALL_GATE                        : 0xC
                                                   // 0xD reserved
        , DESC_386_INTERRUPT_GATE                   : 0xE
        , DESC_386_TRAP_GATE                        : 0xF

        // For data/code descriptors:
        , DESC_DATA_READ_ONLY                       : 0x0
        , DESC_DATA_READ_ONLY_ACCESSED              : 0x1
        , DESC_DATA_READ_WRITE                      : 0x2
        , DESC_DATA_READ_WRITE_ACCESSED             : 0x3
        , DESC_DATA_READ_ONLY_EXPAND_DOWN           : 0x4
        , DESC_DATA_READ_ONLY_EXPAND_DOWN_ACCESSED  : 0x5
        , DESC_DATA_READ_WRITE_EXPAND_DOWN          : 0x6
        , DESC_DATA_READ_WRITE_EXPAND_DOWN_ACCESSED : 0x7
        , DESC_CODE_EXEC_ONLY                       : 0x8
        , DESC_CODE_EXEC_ONLY_ACCESSED              : 0x9
        , DESC_CODE_EXEC_READ                       : 0xA
        , DESC_CODE_EXEC_READ_ACCESSED              : 0xB
        , DESC_CODE_EXEC_ONLY_CONFORMING            : 0xC
        , DESC_CODE_EXEC_ONLY_CONFORMING_ACCESSED   : 0xD
        , DESC_CODE_EXEC_READ_CONFORMING            : 0xE
        , DESC_CODE_EXEC_READ_CONFORMING_ACCESSED   : 0xF

        // For converting a number in two's complement to a float value
        // - byte 0xFF -> -1
        // - word 0xFF -> 0xFF (not negative)
        , toSigned: function (num, size) {
            if (size === 4) {
                //num = (num >>> 0);
                if (num > 0x7FFFFFFF) {
                    num -= 0xFFFFFFFF + 1;
                }
            } else if (size === 2) {
                if (num > 0x7FFF) {
                    num -= 0xFFFF + 1;
                }
            } else {
                if (num > 0x7F) {
                    num -= 0xFF + 1;
                }
            }
            return num;

        }, truncateTowardZero: function (num) {
            return num >> 0;
        }
    });

    // From [http://phpjs.org/functions/sprintf:522]
    util.sprintf = function (/* ... */) {
        // http://kevin.vanzonneveld.net
        // +   original by: Ash Searle (http://hexmen.com/blog/)
        // + namespaced by: Michael White (http://getsprink.com)
        // +    tweaked by: Jack
        // +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
        // +      input by: Paulo Freitas
        // +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
        // +      input by: Brett Zamir (http://brett-zamir.me)
        // +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
        // *     example 1: sprintf("%01.2f", 123.1);
        // *     returns 1: 123.10
        // *     example 2: sprintf("[%10s]", 'monkey');
        // *     returns 2: '[    monkey]'
        // *     example 3: sprintf("[%'#10s]", 'monkey');
        // *     returns 3: '[####monkey]'
        var regex = /%%|%(\d+\$)?([-+\'#0 ]*)(\*\d+\$|\*|\d+)?(\.(\*\d+\$|\*|\d+))?([scboxXuidfegEG]|l{0,2}d)/g;
        var a = arguments,
            i = 0,
            format = a[i++];

        // pad()
        var pad = function (str, len, chr, leftJustify) {
            if (!chr) {
                chr = ' ';
            }
            var padding = (str.length >= len) ? '' : Array(1 + len - str.length >>> 0).join(chr);
            return leftJustify ? str + padding : padding + str;
        };

        // justify()
        var justify = function (value, prefix, leftJustify, minWidth, zeroPad, customPadChar) {
            var diff = minWidth - value.length;
            if (diff > 0) {
                if (leftJustify || !zeroPad) {
                    value = pad(value, minWidth, customPadChar, leftJustify);
                } else {
                    value = value.slice(0, prefix.length) + pad('', diff, '0', true) + value.slice(prefix.length);
                }
            }
            return value;
        };

        // formatBaseX()
        var formatBaseX = function (value, base, prefix, leftJustify, minWidth, precision, zeroPad) {
            // Note: casts negative numbers to positive ones
            var number = value >>> 0;
            prefix = prefix && number && {
                '2': '0b',
                '8': '0',
                '16': '0x'
            }[base] || '';
            value = prefix + pad(number.toString(base), precision || 0, '0', false);
            return justify(value, prefix, leftJustify, minWidth, zeroPad);
        };

        // formatString()
        var formatString = function (value, leftJustify, minWidth, precision, zeroPad, customPadChar) {
            if (precision != null) {
                value = value.slice(0, precision);
            }
            return justify(value, '', leftJustify, minWidth, zeroPad, customPadChar);
        };

        // doFormat()
        var doFormat = function (substring, valueIndex, flags, minWidth, _, precision, type) {
            var number;
            var prefix;
            var method;
            var textTransform;
            var value;

            if (substring == '%%') {
                return '%';
            }

            // parse flags
            var leftJustify = false,
                positivePrefix = '',
                zeroPad = false,
                prefixBaseX = false,
                customPadChar = ' ';
            var flagsl = flags.length;
            for (var j = 0; flags && j < flagsl; j++) {
                switch (flags.charAt(j)) {
                case ' ':
                    positivePrefix = ' ';
                    break;
                case '+':
                    positivePrefix = '+';
                    break;
                case '-':
                    leftJustify = true;
                    break;
                case "'":
                    customPadChar = flags.charAt(j + 1);
                    break;
                case '0':
                    zeroPad = true;
                    break;
                case '#':
                    prefixBaseX = true;
                    break;
                }
            }

            // parameters may be null, undefined, empty-string or real valued
            // we want to ignore null, undefined and empty-string values
            if (!minWidth) {
                minWidth = 0;
            } else if (minWidth == '*') {
                minWidth = +a[i++];
            } else if (minWidth.charAt(0) == '*') {
                minWidth = +a[minWidth.slice(1, -1)];
            } else {
                minWidth = +minWidth;
            }

            // Note: undocumented perl feature:
            if (minWidth < 0) {
                minWidth = -minWidth;
                leftJustify = true;
            }

            if (!isFinite(minWidth)) {
                throw new Error('sprintf: (minimum-)width must be finite');
            }

            if (!precision) {
                precision = 'fFeE'.indexOf(type) > -1 ? 6 : (type == 'd') ? 0 : undefined;
            } else if (precision == '*') {
                precision = +a[i++];
            } else if (precision.charAt(0) == '*') {
                precision = +a[precision.slice(1, -1)];
            } else {
                precision = +precision;
            }

            // grab value using valueIndex if required?
            value = valueIndex ? a[valueIndex.slice(0, -1)] : a[i++];

            switch (type) {
            case 's':
                return formatString(String(value), leftJustify, minWidth, precision, zeroPad, customPadChar);
            case 'c':
                return formatString(String.fromCharCode(+value), leftJustify, minWidth, precision, zeroPad);
            case 'b':
                return formatBaseX(value, 2, prefixBaseX, leftJustify, minWidth, precision, zeroPad);
            case 'o':
                return formatBaseX(value, 8, prefixBaseX, leftJustify, minWidth, precision, zeroPad);
            case 'x':
                return formatBaseX(value, 16, prefixBaseX, leftJustify, minWidth, precision, zeroPad);
            case 'X':
                return formatBaseX(value, 16, prefixBaseX, leftJustify, minWidth, precision, zeroPad).toUpperCase();
            case 'u':
                return formatBaseX(value, 10, prefixBaseX, leftJustify, minWidth, precision, zeroPad);
            case 'i':
            case 'd':
            case "ld":
            case "lld":
                number = (+value) | 0;
                prefix = number < 0 ? '-' : positivePrefix;
                value = prefix + pad(String(Math.abs(number)), precision, '0', false);
                return justify(value, prefix, leftJustify, minWidth, zeroPad);
            case 'e':
            case 'E':
            case 'f':
            case 'F':
            case 'g':
            case 'G':
                number = +value;
                prefix = number < 0 ? '-' : positivePrefix;
                method = ['toExponential', 'toFixed', 'toPrecision']['efg'.indexOf(type.toLowerCase())];
                textTransform = ['toString', 'toUpperCase']['eEfFgG'.indexOf(type) % 2];
                value = prefix + Math.abs(number)[method](precision);
                return justify(value, prefix, leftJustify, minWidth, zeroPad)[textTransform]();
            default:
                return substring;
            }
        };

        return format.replace(regex, doFormat);
    };

    // Format various data prettily
    util.format = function (type, data /* or hour */, minute, sec) {
        var args = arguments;
        switch (type) {
        case "hex":
            return "0x" + data.toString(16).toUpperCase();
        case "time":
            return data/* (hour) */ + ":" + minute + ":" + sec;
        case "bool":
            return data ? "true" : "false";
        default:
            throw new Error( "util.format() :: Error - invalid 'type'" );
        }
    };

    // For properly creating a subclass in JavaScript
    util.inherit = function (cls1, cls2, arg) {
        if (!util.isFunction(cls1)) {
            throw new Error("util.inherit() :: 'cls1' is not a valid JavaScript class/function");
        }
        if (!util.isFunction(cls2)) {
            throw new Error("util.inherit() :: 'cls2' is not a valid JavaScript class/function");
        }
        // Unfortunately no way to perform "new" & call .apply,
        //    see [http://stackoverflow.com/questions/181348/instantiating-a-javascript-object-by-calling-prototype-constructor-apply]
        cls1.prototype = arg !== undefined ? new cls2(arg) : new cls2();
        cls1.prototype.constructor = cls1;
    };

    // Feature detection
    util.support = (function () {
        // ArrayBuffers are used for efficient memory storage
        var typedArrays = ("ArrayBuffer" in util.global) && ("Uint8Array" in util.global);

        return {
            typedArrays: typedArrays
            , typedDataView: typedArrays && ("DataView" in util.global)
        };
    })();

    // Safe versions of left- & right-shift
    //    (the builtin operators will convert a > 32-bit value
    //    to zero, so are not safe for some uses)
    util.shl = function (num, bits) {
        // (See note in jemul8.generateMask())
        return num * Math.pow(2, bits);
    };
    util.shr = function (num, bits) {
        // (See note in jemul8.generateMask())
        return num / Math.pow(2, bits);
    };
    // Create a bitmask for the specified value size in bytes
    //    (eg. for masking off higher bits of a value to fit it
    //    into a CPU register)
    util.generateMask = function (size /* in bytes */) {
        // 4 bytes creates a number that is too large for ECMAScript
        //    (before the -1) ... in FF, the result would be zero,
        //    so we hard-code this particular scenario.
        if (size < 4) {
            return (1 << size * 8) - 1;
        } else {
            return 0xFFFFFFFF;
        }
    };
    // For reinterpreting a number as signed / "sign-extending" a number
    util.signExtend = function (num, length, lengthTo) {
        var numBits = length * 8, numBitsTo = lengthTo * 8;
        // Sign bit set
        if (num >> (numBits - 1)) {
            // TODO: Convert "<<" to Math.pow() or multiply? May overflow
            //    the JavaScript 32-bit limit...
            return num | ((Math.pow(2, numBitsTo - numBits) - 1) << numBits);
        } else {
            return num;
        }
    };

    if (!Function.prototype.bind) {
        // Partial implementation of Function.bind()
        //    (does not support prepending arguments)
        Function.prototype.bind = function (obj) {
            var fn = this;
            return function () {
                return fn.apply(obj, arguments);
            };
        };
    }

    if (!Date.now) {
        Date.now = function () {
            return new Date().getTime();
        };
    }

    // Check, because IE10 preview errors on .bind()
    var useBind = false;
    try {
        useBind = util.global.console && console.assert
        && console.assert.bind && console.assert.bind(console);
    } catch (e) {}

    if (0 && useBind) {
        util.extend(util, {
            assert: console.assert.bind(console)
            , info: console.info.bind(console)
            , debug: (console.debug || console.info).bind(console)
            , warning: console.warn.bind(console)
            , problem: console.error.bind(console)
            , panic: function (msg) {
                alert(msg);
                throw new Error(msg);
            }
        });
    } else {
        // Stub functions as console logging unavailable
        util.extend(util, {
            assert: function (cond, msg) {}
            , info: function (msg) {}
            , debug: function (msg) {}
            , warning: function (msg) {}
            , problem: function (msg) {}
            , panic: function (msg) {}
        });
    }

    return util;
});
