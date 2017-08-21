/**
 * jemul8 - JavaScript x86 Emulator
 * http://jemul8.com/
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*global define, DataView, Uint8Array */
define([
    "modular",
    "module",
    "require"
], function (
    modular,
    module,
    require
) {
    "use strict";

    // Microseconds (us) === 1000 * 1000 per second,
    //  but clock signal is 1193181 (because of oscillator/crystal).
    //  Slight difference between the two, but enough to warrant additional
    //  calculations for accuracy.

    var USEC_PER_SECOND = 1000000,  // Of course: 1000ms * 1000 = us, but...
        TICKS_PER_SECOND = 1193181, // ... because of 1.193181MHz clock.
        create = Object.create || function (from) {
            function F() {}
            F.prototype = from;
            return new F();
        },
        get,
        util = create(modular.util),
        console = util.global.console,
        Promise;

    get = util.global.XMLHttpRequest ? function (uri) {
        var promise = new Promise(),
            xhr = new util.global.XMLHttpRequest();

        xhr.open("GET", "/" + uri + "?__r=" + Math.random(), true);
        xhr.responseType = "arraybuffer";
        xhr.onreadystatechange = function () {
            var buffer;

            if (this.readyState === 4) {
                if (this.status === 200) {
                    buffer = new DataView(this.response);

                    promise.resolve(buffer, uri);
                } else {
                    promise.reject(uri);
                }
            }
        };
        xhr.send("");

        return promise;
    } : function (uri) {
        var promise = new Promise();

        require("fs").readFile("./" + uri, function (error, data) {
            if (error) {
                promise.reject(new Error("util.get() :: Failed to read file '" + uri + "' - " + error.toString()));
                return;
            }

            promise.resolve(new Uint8Array(data), uri);
        });

        return promise;
    };

    util.extend(util, {
        // Mask applied to addresses presented at the address bus, depending
        //  on setting of A20MASK#
        MASK_ENABLE_A20:  0xFFFFFFFF,
        MASK_DISABLE_A20: 0xFFeFFFFF,

        // Type of reset: warm (software) or cold (hardware)
        RESET_HARDWARE: 1,
        RESET_SOFTWARE: 2,

        // CPU interrupt/exception types
        EXTERNAL_INTERRUPT: 0,
        NMI: 2,
        HARDWARE_EXCEPTION: 3, // All exceptions except #BP and #OF
        SOFTWARE_INTERRUPT: 4,
        PRIVILEGED_SOFTWARE_INTERRUPT: 5,
        SOFTWARE_EXCEPTION: 6,

        // CPU exception vectors
        DE_EXCEPTION: 0, // Divide Error (fault)
        DB_EXCEPTION: 1, // Debug (fault/trap)
        BP_EXCEPTION: 3, // Breakpoint (trap)
        OF_EXCEPTION: 4, // Overflow (trap)
        BR_EXCEPTION: 5, // BOUND (fault)
        UD_EXCEPTION: 6,
        NM_EXCEPTION: 7,
        DF_EXCEPTION: 8,
        TS_EXCEPTION: 10,
        NP_EXCEPTION: 11,
        SS_EXCEPTION: 12,
        GP_EXCEPTION: 13,
        PF_EXCEPTION: 14,
        MF_EXCEPTION: 16,
        AC_EXCEPTION: 17,
        MC_EXCEPTION: 18,
        XM_EXCEPTION: 19,
        // Total no. of handled exceptions
        CPU_HANDLED_EXCEPTIONS: 20,

        // Descriptor access types
        ACCESS_INVALID     : 0x00,
        ACCESS_VALID_CACHE : 0x01,
        ACCESS_ROK         : 0x02,
        ACCESS_WOK         : 0x04,

        // Descriptor types
        // For system & gate descriptors:
        DESC_GATE_TYPE_NONE                       : 0x0,
        DESC_SYS_SEGMENT_AVAIL_286_TSS            : 0x1,
        DESC_SYS_SEGMENT_LDT                      : 0x2,
        DESC_SYS_SEGMENT_BUSY_286_TSS             : 0x3,
        DESC_286_CALL_GATE                        : 0x4,
        DESC_TASK_GATE                            : 0x5,
        DESC_286_INTERRUPT_GATE                   : 0x6,
        DESC_286_TRAP_GATE                        : 0x7,
        // 0x8 reserved
        DESC_SYS_SEGMENT_AVAIL_386_TSS            : 0x9,
        // 0xA reserved
        DESC_SYS_SEGMENT_BUSY_386_TSS             : 0xB,
        DESC_386_CALL_GATE                        : 0xC,
        // 0xD reserved
        DESC_386_INTERRUPT_GATE                   : 0xE,
        DESC_386_TRAP_GATE                        : 0xF,

        // For data/code descriptors:
        DESC_DATA_READ_ONLY                       : 0x0,
        DESC_DATA_READ_ONLY_ACCESSED              : 0x1,
        DESC_DATA_READ_WRITE                      : 0x2,
        DESC_DATA_READ_WRITE_ACCESSED             : 0x3,
        DESC_DATA_READ_ONLY_EXPAND_DOWN           : 0x4,
        DESC_DATA_READ_ONLY_EXPAND_DOWN_ACCESSED  : 0x5,
        DESC_DATA_READ_WRITE_EXPAND_DOWN          : 0x6,
        DESC_DATA_READ_WRITE_EXPAND_DOWN_ACCESSED : 0x7,
        DESC_CODE_EXEC_ONLY                       : 0x8,
        DESC_CODE_EXEC_ONLY_ACCESSED              : 0x9,
        DESC_CODE_EXEC_READ                       : 0xA,
        DESC_CODE_EXEC_READ_ACCESSED              : 0xB,
        DESC_CODE_EXEC_ONLY_CONFORMING            : 0xC,
        DESC_CODE_EXEC_ONLY_CONFORMING_ACCESSED   : 0xD,
        DESC_CODE_EXEC_READ_CONFORMING            : 0xE,
        DESC_CODE_EXEC_READ_CONFORMING_ACCESSED   : 0xF,

        copyBuffer: function (options) {
            var from = options.from,
                fromBuffer = from.buffer,
                fromAddress = from.at,
                to = options.to,
                toBuffer = to.buffer,
                toAddress = to.at,
                length = options.length;

            new Uint8Array(toBuffer).set(new Uint8Array(fromBuffer, fromAddress, length), toAddress);
        },

        from: function (from) {
            return {
                to: function (to, callback) {
                    var number;

                    for (number = from; number < to; number += 1) {
                        callback(number, number - from);
                    }
                }
            };
        },

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

        get: get,

        getParity: function (num) {
            /*jshint bitwise: false */
            var res = 0;

            // x86 parity only applies to the low 8 bits
            num = num & 0xff;

            while (num) {
                ++res;
                // Loop will execute once for each bit set in num
                num &= num - 1;
            }

            return (res % 2 === 0) & 1;
        },

        heredoc: function (fn, variables) {
            var match = function () {}.toString.call(fn).match(/\/\*<<<(\w+)[\r\n](?:([\s\S]*)[\r\n])?\1\s*\*\//),
                string;

            if (!match) {
                throw new Error("util.heredoc() :: Function does not contain a heredoc");
            }

            string = match[2] || "";

            util.each(variables, function (value, name) {
                var pattern = new RegExp(("${" + name + "}").replace(/[^a-z0-9]/g, "\\$&"), "g");

                string = string.replace(pattern, value);
            }, {keys: true});

            return string;
        },

        hexify: function (number) {
            /*jshint bitwise: false */
            var val = (number >>> 0).toString(16).toUpperCase(),
                textLeadingZeroes = new Array(8 - val.length + 1).join("0");

            return "0x" + textLeadingZeroes + val;
        },

        inherit: function (To) {
            return {
                from: function (From) {
                    To.prototype = create(From.prototype);
                    To.prototype.constructor = To;
                }
            };
        },

        // Breaks the circular dependency between js/Jemul8.js<->js/util.js
        init: function (callback) {
            require([
                "js/Promise"
            ], function (
                PromiseClass
            ) {
                Promise = PromiseClass;
                callback();
            });
        },

        isNumber: function (number) {
            return util.getType(number) === "Number";
        },

        mask: function (number, mask) {
            /*jslint bitwise: true */

            return (number & mask) >>> 0;
        },

        // For reinterpreting a number as signed / "sign-extending" a number
        signExtend: function (num, length, lengthTo) {
            /*jshint bitwise: false */
            var numBits = length * 8, numBitsTo = lengthTo * 8;

            // Sign bit set
            if (num >>> (numBits - 1)) {
                // TODO: Convert "<<" to Math.pow() or multiply? May overflow
                //    the JavaScript 32-bit limit...
                return num | ((Math.pow(2, numBitsTo - numBits) - 1) << numBits);
            } else {
                return num;
            }
        },

        ticksToMicroseconds: function (ticks) {
            return Math.floor((ticks * USEC_PER_SECOND) / TICKS_PER_SECOND);
        },

        toSigned: function (number, size) {
            if (size === 4) {
                if (number > 0x7FFFFFFF) {
                    number -= 0xFFFFFFFF + 1;
                }
            } else if (size === 2) {
                if (number > 0x7FFF) {
                    number -= 0xFFFF + 1;
                }
            } else {
                if (number > 0x7F) {
                    number -= 0xFF + 1;
                }
            }

            return number;
        },

        microsecondsToTicks: function (usec) {
            return Math.floor((usec * TICKS_PER_SECOND) / USEC_PER_SECOND);
        },

        millisecondsToTicks: function (milliseconds) {
            return util.microsecondsToTicks(milliseconds * 1000);
        }
    });

    // Check, because IE10 preview errors on .bind()
    if ((function () {
        try {
            return console && console.assert && console.assert.bind && console.assert.bind(console);
        } catch (e) {}

        return false;
    }())) {
        util.extend(util, {
            assert: console.assert.bind(console),
            info: console.info.bind(console),
            debug: (console.debug || console.info).bind(console),
            warning: console.warn.bind(console),
            problem: console.error.bind(console),
            panic: function (msg) {
                throw new Error(msg);
            }
        });
    } else {
        // Stub functions as console logging unavailable
        util.extend(util, {
            assert: function () {},
            info: function () {},
            debug: function () {},
            warning: function () {},
            problem: function () {},
            panic: function () {}
        });
    }

    return util;
});
