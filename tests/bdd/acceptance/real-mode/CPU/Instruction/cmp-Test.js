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

    describe("CPU 'cmp' instruction", function () {
        /*jshint bitwise: false */
        var registers,
            system,
            testSystem;

        beforeEach(function (done) {
            testSystem = new TestSystem();
            system = testSystem.getSystem();
            registers = system.getCPURegisters();

            testSystem.init().done(function () {
                done();
            });
        });

        afterEach(function () {
            system.stop();
            registers = null;
            system = null;
            testSystem = null;
        });

        /*
         * Notes:
         * - Subtracting larger no. from smaller no. will result in carry (so CF set)
         */

        util.each({
            "subtracting ax from itself when zero": {
                operand1: "ax",
                operand2: "ax",
                registers: {
                    ax: 0
                },
                expectedFlags: {
                    cf: 0, // Zero result does not result in a carry
                    sf: 0,
                    zf: 1, // Result of SUB is zero, so zero flag should be set
                    pf: util.getParity(0 - 0)
                }
            },
            "subtracting negative sign-extended byte from negative word with negative result": {
                operand1: "ax",
                operand2: "byte -1",
                registers: {
                    ax: -10
                },
                expectedFlags: {
                    cf: 1, // (-10 [unsigned, so 0xFFF6]) - (-1 [0xFFFF]) results in a carry
                    sf: 1, // Negative result
                    zf: 0, // Non-zero result
                    pf: util.getParity(-10 - (-1))
                }
            },
            "subtracting negative byte from negative byte with negative result": {
                operand1: "al",
                operand2: "ah",
                registers: {
                    al: -10,
                    ah: -2
                },
                expectedFlags: {
                    cf: 1,
                    of: 0, // No signed overflow
                    sf: 1, // Negative result
                    zf: 0, // Non-zero result
                    pf: util.getParity(-10 - (-2))
                }
            },
            "subtracting positive byte from negative byte with overflowing result": {
                operand1: "al",
                operand2: "ah",
                registers: {
                    al: -0x80 & 0xff,
                    ah: 2
                },
                expectedFlags: {
                    cf: 0,
                    of: 1, // Signed overflow
                    sf: 0, // Positive result after overflow
                    zf: 0, // Non-zero result
                    pf: util.getParity(-0x80 - 2)
                }
            },
            "subtracting negative sign-extended byte from positive word": {
                operand1: "ax",
                operand2: "byte -1",
                registers: {
                    ax: 10
                },
                expectedFlags: {
                    cf: 1, // (10) - (-1 [unsigned, so 0xFFFF]) results in a carry
                    sf: 0, // Positive result
                    zf: 0, // Non-zero result
                    pf: util.getParity(10 - (-1))
                }
            },
            "subtracting negative number that results in zero": {
                operand1: "ax",
                operand2: "byte -4",
                registers: {
                    ax: -4
                },
                expectedFlags: {
                    cf: 0, // (-4 [unsigned, so 0xFFFC]) - (-4 [0xFFFC]) - zero result does not result in a carry
                    sf: 0, // Positive result
                    zf: 1, // Zero result
                    pf: util.getParity(-4 - (-4))
                }
            },
            "subtracting negative sign-extended byte from negative word with zero result": {
                operand1: "ax",
                operand2: "byte -1",
                registers: {
                    ax: -1
                },
                expectedFlags: {
                    cf: 0,
                    sf: 0,
                    zf: 1, // Immediate should be sign-extended to word for AX and remain equal
                    pf: 1
                }
            },
            "subtracting positive dword from positive dword with positive result": {
                operand1: "eax",
                operand2: "ebx",
                registers: {
                    eax: 120100,
                    ebx: 100000
                },
                expectedFlags: {
                    cf: 0,
                    sf: 0,
                    zf: 0,
                    pf: util.getParity(120100 - 100000)
                }
            },
            "subtracting positive dword (reg) from positive dword (reg) with negative result": {
                operand1: "eax",
                operand2: "ebx",
                registers: {
                    eax: 120100,
                    ebx: 120101
                },
                expectedFlags: {
                    cf: 1,
                    sf: 1,
                    zf: 0,
                    pf: util.getParity(120100 - 120101)
                }
            },
            "subtracting positive dword (reg) from positive dword (mem) near limit, with positive result": {
                operand1: "[0x12]",
                operand2: "ebx",
                registers: {
                    ds: 0x300,
                    ebx: 1
                },
                memory: [{
                    to: (0x300 << 4) + 0x12,
                    data: 0x7fffffff,
                    size: 4
                }],
                expectedFlags: {
                    cf: 0,
                    sf: 0,
                    zf: 0,
                    pf: util.getParity(0x7fffffff - 1)
                }
            },
            "subtracting positive dword (reg) from positive dword (mem) with negative result": {
                operand1: "[0x12]",
                operand2: "ebx",
                registers: {
                    ds: 0x300,
                    ebx: 120101
                },
                memory: [{
                    to: (0x300 << 4) + 0x12,
                    data: 120100,
                    size: 4
                }],
                expectedFlags: {
                    cf: 1,
                    sf: 1,
                    zf: 0,
                    pf: util.getParity(120100 - 120101)
                }
            }
        }, function (scenario, description) {
            describe(description, function () {
                // Test in both modes so we check support for operand-size override prefix
                util.each([true, false], function (is32BitCodeSegment) {
                    describe("when code segment is " + (is32BitCodeSegment ? 32 : 16) + "-bit", function () {
                        beforeEach(function (done) {
                            var assembly = util.heredoc(function (/*<<<EOS
org 0x100
[BITS ${bits}]
cmp ${operand1}, ${operand2}

hlt
EOS
*/) {}, {operand1: scenario.operand1, operand2: scenario.operand2, bits: is32BitCodeSegment ? 32 : 16});

                            testSystem.on("pre-run", function () {
                                registers.cs.set32BitMode(is32BitCodeSegment);
                            });

                            if (scenario.setup) {
                                scenario.setup(registers);
                            }

                            util.each(scenario.registers, function (value, register) {
                                registers[register].set(value);
                            });

                            util.each(scenario.memory, function (options) {
                                system.write(options);
                            });

                            testSystem.execute(assembly).done(function () {
                                done();
                            }).fail(function (exception) {
                                done(exception);
                            });
                        });

                        util.each(scenario.expectedFlags, function (expectedValue, flag) {
                            it("should set " + flag + " correctly", function () {
                                expect(registers[flag].get()).to.equal(expectedValue);
                            });
                        });
                    });
                });
            });
        });
    });
});
