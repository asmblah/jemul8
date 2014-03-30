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
    "tools/TestSystem"
], function (
    util,
    TestSystem
) {
    "use strict";

    describe("CPU 'shr' (unsigned bit shift right) instruction", function () {
        var system,
            testSystem;

        beforeEach(function (done) {
            testSystem = new TestSystem();
            system = testSystem.getSystem();

            testSystem.init().done(function () {
                done();
            });
        });

        afterEach(function () {
            system.stop();
            system = null;
            testSystem = null;
        });

        // Test in both modes so we check support for operand-size override prefix
        util.each([true, false], function (is32BitCodeSegment) {
            /*jshint bitwise: false */
            var bits = is32BitCodeSegment ? 32 : 16,
                registers;

            describe("when code segment is " + bits + "-bit", function () {
                util.each({
                    "shift al right by immediate 1 to divide it by 2": {
                        destination: "al",
                        count: "1",
                        setup: function () {
                            // Set al: also set higher bits to make sure they are untouched
                            registers.eax.set(0xABCDEF00 | 46);
                        },
                        expectedRegisters: {
                            eax: 0xABCDEF00 | 23,
                            cf: 0 // 0 was shifted out last
                        }
                    },
                    "shift ax right by immediate 1 to divide it by 2": {
                        destination: "ax",
                        count: "1",
                        setup: function () {
                            // Set ax: also set higher bits to make sure they are untouched
                            registers.eax.set(0xABCD0000 | 400);
                        },
                        expectedRegisters: {
                            eax: 0xABCD0000 | 200,
                            cf: 0 // 0 was shifted out last
                        }
                    },
                    "shift eax right by immediate 1 to divide it by 2": {
                        destination: "eax",
                        count: "1",
                        setup: function () {
                            registers.eax.set(0xFFFFFFFF);
                        },
                        expectedRegisters: {
                            eax: 0x7fffffff,
                            cf: 1 // 1 was shifted out last
                        }
                    },
                    "shift al right by immediate 2 to divide it by 4": {
                        destination: "al",
                        count: "2",
                        setup: function () {
                            // Set al: also set higher bits to make sure they are untouched
                            registers.eax.set(0xABCDEF00 | 20);
                        },
                        expectedRegisters: {
                            eax: 0xABCDEF00 | 5,
                            cf: 0 // 0 was shifted out last
                        }
                    },
                    "shift bl right by immediate 3 to divide it by 8": {
                        destination: "bl",
                        count: "3",
                        setup: function () {
                            // Set bl: also set higher bits to make sure they are untouched
                            registers.ebx.set(0xABCDEF00 | 28);
                        },
                        expectedRegisters: {
                            ebx: 0xABCDEF00 | 3,
                            cf: 1 // 1 was shifted out last
                        }
                    },
                    "shift bl right by cl(2) to divide it by 4": {
                        destination: "bl",
                        count: "cl",
                        setup: function () {
                            // Set bl: also set higher bits to make sure they are untouched
                            registers.ebx.set(0xABCDEF00 | 40);
                            // Set cl: also set higher bits to make sure they are unused
                            registers.ecx.set(0xABCDEF00 | 2);
                        },
                        expectedRegisters: {
                            ebx: 0xABCDEF00 | 10,
                            cf: 0 // 0 was shifted out last
                        }
                    }
                }, function (scenario, description) {
                    describe(description, function () {
                        beforeEach(function (done) {
                            var assembly = util.heredoc(function (/*<<<EOS
[BITS ${bits}]
org 0x100
shr ${destination}, ${count}
hlt
EOS
*/) {}, {bits: bits, destination: scenario.destination, count: scenario.count});

                            registers = system.getCPURegisters();

                            testSystem.on("pre-run", function () {
                                registers.cs.set32BitMode(is32BitCodeSegment);
                            });

                            scenario.setup();

                            testSystem.execute(assembly).done(function () {
                                done();
                            }).fail(function (exception) {
                                done(exception);
                            });
                        });

                        util.each(scenario.expectedRegisters, function (value, name) {
                            it("should leave the correct value in " + name, function () {
                                expect(registers[name].get()).to.equal(value >>> 0);
                            });
                        });
                    });
                });
            });
        });
    });
});
