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
    "module",
    "js/util",
    "js/Jemul8"
], function (
    module,
    util,
    Jemul8
) {
    "use strict";

    var FAILED = 1,
        FINISHED = 2,
        PASSED = 0,
        TEST_PORT = 0x404;

    return {
        defineTest: function (name, path, callback, options) {
            var beforeEach,
                emulator,
                registers;

            options = options || {};
            beforeEach = options.beforeEach || function () {};

            function init(done) {
                emulator = new Jemul8().createEmulator();
                registers = emulator.getCPURegisters();

                util.get("../../asm/tests/bdd/acceptance/" + path + ".bin").done(function (buffer) {
                    emulator.init().done(function () {
                        // Write harness machine code to memory @ 0x100
                        emulator.write({
                            data: buffer,
                            to:   0x00000100
                        });

                        // Point CPU at first loaded instruction
                        registers.cs.set(0x0000);
                        registers.eip.set(0x00000100);

                        done();
                    });
                });
            }

            (function () {
                var index = -1,
                    tests = [];

                (function nextTest() {
                    var description = "";
                    index += 1;

                    init(function () {
                        var options = beforeEach(emulator) || {},
                            helpers = options.helpers || {};

                        registers.ax.set(index);

                        emulator.on("io write", [TEST_PORT], function (value, length) {
                            var toolIndex = registers.bx.get();

                            if (toolIndex === 0) {
                                if (length !== 1) {
                                    throw new Error("Unsupported IO length " + length);
                                }

                                description += String.fromCharCode(value);
                            } else {
                                if (helpers[toolIndex]) {
                                    helpers[toolIndex](value);
                                } else {
                                    throw new Error("Unsupported test tool index: " + toolIndex);
                                }
                            }
                        });

                        // Run the emulator, wait for HLT
                        emulator.run().done(function () {
                            var result = registers.ax.get();

                            if (result === FINISHED) {
                                describe(name + " acceptance tests", function () {
                                    util.each(tests, function (test) {
                                        var description = test.description,
                                            result = test.result;

                                        it(description, function (done) {
                                            if (result === PASSED) {
                                                done();
                                            } else if (result === FAILED) {
                                                done(new Error("Assertion in VM failed"));
                                            } else {
                                                done(new Error("Invalid result in AX from test runner: " + result));
                                            }
                                        });
                                    });
                                });

                                callback();
                            } else {
                                tests.push({
                                    description: description,
                                    result: result
                                });
                                nextTest();
                            }
                        });
                    });
                }());
            }());
        }
    };
});
