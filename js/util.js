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
    "require"
], function (
    modular,
    require
) {
    "use strict";

    var create = Object.create || function (from) {
        function F() {}
        F.prototype = from;
        return new F();
    },
        util = create(modular.util),
        console = util.global.console,
        Promise;

    util.extend(util, {
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

        get: function (uri) {
            var promise = new Promise(),
                xhr = new util.global.XMLHttpRequest();

            xhr.open("GET", uri + "?__r=" + Math.random(), true);
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
        },

        hexify: function (number, byteSize) {
            /*jshint bitwise: true */
            var val = (number >>> 0).toString(16).toUpperCase(),
                sizeHexChars = byteSize * 2,
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

        mask: function (number, mask) {
            /*jslint bitwise: true */

            return (number & mask) >>> 0;
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
            debug: console.debug.bind(console),
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
