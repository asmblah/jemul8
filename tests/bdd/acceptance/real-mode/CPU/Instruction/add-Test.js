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

    describe("CPU 'add' instruction", function () {
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

        util.each({
            "16-bit unsigned wrap around overflow, because 65535 is largest unsigned 16-bit number": {
                is32BitCodeSegment: false,
                operand1: "bx",
                operand2: "ax",
                registers: {
                    ax: 1,
                    bx: 65535
                },
                expectedRegisters: {
                    ax: 1,
                    bx: 0,
                    cf: 1,
                    of: 0,
                    sf: 0  // Result is positive so sign flag is clear
                }
            },
            "16-bit negative wrap around overflow, because -32768 is smallest signed 16-bit number": {
                is32BitCodeSegment: false,
                operand1: "bx",
                operand2: "ax",
                registers: {
                    ax: -1 & 0xffff,
                    bx: -32768 & 0xffff
                },
                expectedRegisters: {
                    ax: -1 & 0xffff,
                    bx: 32767,
                    cf: 1, // Adding the -1 results in an unsigned wrap-around, so 1 is carried -
                    of: 1, // - and also results in a signed overflow (see description)
                    sf: 0  // Result is positive so sign flag is clear
                }
            },
            "32-bit negative wrap around overflow, because -2147483648 is smallest signed 32-bit number": {
                is32BitCodeSegment: false,
                operand1: "ebx",
                operand2: "eax",
                registers: {
                    eax: (-1 & 0xffffffff) >>> 0,
                    ebx: (-2147483648 & 0xffffffff) >>> 0
                },
                expectedRegisters: {
                    eax: (-1 & 0xffffffff) >>> 0,
                    ebx: 2147483647,
                    cf: 1, // Adding the -1 results in an unsigned wrap-around, so 1 is carried -
                    of: 1, // - and also results in a signed overflow (see description)
                    sf: 0  // Result is positive so sign flag is clear
                }
            },
            "16-bit no wrap around when operands are positive non-zero, positive result (no overflow)": {
                is32BitCodeSegment: false,
                operand1: "bx",
                operand2: "ax",
                registers: {
                    ax: 4,
                    bx: 10
                },
                expectedRegisters: {
                    ax: 4,
                    bx: 14,
                    cf: 0, // No wrap around, so no carry
                    of: 0,
                    sf: 0  // Zero result, positive
                }
            },
            "16-bit no wrap around when operands are positive non-zero, negative result (overflow!)": {
                is32BitCodeSegment: false,
                operand1: "bx",
                operand2: "ax",
                registers: {
                    ax: 1,
                    bx: 32767
                },
                expectedRegisters: {
                    ax: 1,
                    bx: 32768,
                    cf: 0, // No unsigned wrap around, so no carry
                    of: 1, // But there is signed wrap around
                    sf: 1  // Negative result
                }
            },
            "16-bit no wrap around when operands are zero, zero result": {
                is32BitCodeSegment: false,
                operand1: "bx",
                operand2: "ax",
                registers: {
                    ax: 0,
                    bx: 0
                },
                expectedRegisters: {
                    ax: 0,
                    bx: 0,
                    cf: 0, // No wrap around, so no carry
                    of: 0,
                    sf: 0  // Zero result, positive
                }
            },
            "16-bit no wrap around, negative result": {
                is32BitCodeSegment: false,
                operand1: "bx",
                operand2: "ax",
                registers: {
                    ax: -30 & 0xffff,
                    bx: 10
                },
                expectedRegisters: {
                    ax: -30 & 0xffff,
                    bx: -20 & 0xffff,
                    cf: 0, // No wrap around, so no carry
                    of: 0, // - and no signed overflow
                    sf: 1  // Negative result
                }
            }
        }, function (scenario, description) {
            var is32BitCodeSegment = scenario.is32BitCodeSegment;

            describe("when code segment is " + (is32BitCodeSegment ? 32 : 16) + "-bit", function () {
                describe(description, function () {
                    beforeEach(function (done) {
                        var assembly = util.heredoc(function (/*<<<EOS
org 0x100
[BITS ${bits}]
add ${operand1}, ${operand2}

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
                            registers[register][/f$/.test(register) ? "setBin" : "set"](value);
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

                    util.each(scenario.expectedRegisters, function (expectedValue, register) {
                        it("should set " + register + " correctly", function () {
                            expect(registers[register].get()).to.equal(expectedValue);
                        });
                    });

                    util.each(scenario.expectedMemory, function (data) {
                        var expectedValue = data.expected;

                        it("should store " + util.hexify(expectedValue) + " at " + util.hexify(data.from), function () {
                            expect(system.read(data)).to.equal(expectedValue);
                        });
                    });
                });
            });
        });
    });
});
