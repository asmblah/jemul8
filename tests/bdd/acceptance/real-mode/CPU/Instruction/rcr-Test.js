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

    describe("CPU 'rcr' (rotate through carry right) instruction", function () {
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
            "10111010b >> 0 = 10111010b": {
                is32BitCodeSegment: false,
                operand1: "bl",
                operand2: "0",
                registers: {
                    bl: parseInt("10111010", 2),

                    cf: 1, // Set CF to ensure it is unaffected (count is zero)
                    of: 1  // Set OF to ensure it is unaffected (not a 1-bit rotate)
                },
                expectedRegisters: {
                    bl: parseInt("10111010", 2),

                    cf: 1, // Set CF to ensure it is unaffected (count is zero)
                    of: 1  // Should be set (see above)
                }
            },
            "10111010b >> 1 = 11011101b": {
                is32BitCodeSegment: false,
                operand1: "bl",
                operand2: "1",
                registers: {
                    bl: parseInt("10111010", 2),

                    cf: 1, // Set CF to ensure it is shifted into MSB
                    of: 1  // Set OF to ensure it is cleared (1-bit rotate: CF XOR MSB)
                },
                expectedRegisters: {
                    bl: parseInt("11011101", 2),

                    cf: 0, // CF should be left with one from the 1st LSB
                    of: 0  // Should be cleared (see above)
                }
            },
            "10111010b >> 2 = 00101110b": {
                is32BitCodeSegment: false,
                operand1: "bl",
                operand2: "2",
                registers: {
                    bl: parseInt("10111010", 2),

                    cf: 0, // Clear CF to ensure it is shifted into MSB
                    of: 1  // Set OF to ensure it is cleared
                },
                expectedRegisters: {
                    bl: parseInt("00101110", 2),

                    cf: 1, // CF should be left with one from the 2nd LSB
                    of: 0  // Should be clear (see above)
                }
            },
            "rotate count should be masked to only the 5 LSBs": {
                is32BitCodeSegment: false,
                operand1: "bx",
                operand2: "32",
                registers: {
                    bx: 0xabcd,

                    cf: 1,
                    of: 1  // Set OF to ensure it is unaffected (not a 1-bit rotate)
                },
                expectedRegisters: {
                    bx: 0xabcd,

                    cf: 1,
                    of: 1  // Should be set (see above)
                }
            },
            "8-bit rotates should be modulo 9": {
                is32BitCodeSegment: false,
                operand1: "bl",
                operand2: "10",
                registers: {
                    bl: parseInt("00110101", 2),

                    cf: 0, // Clear CF to ensure it is shifted into LSB
                    of: 1
                },
                expectedRegisters: {
                    bl: parseInt("00011010", 2),

                    cf: 1,
                    of: 0 // XOR of 2 MSBs of result
                }
            },
            "16-bit rotates should be modulo 17": {
                is32BitCodeSegment: false,
                operand1: "bx",
                operand2: "18",
                registers: {
                    bx: parseInt("0011010111110101", 2),

                    cf: 1, // Set CF to ensure it is shifted into LSB
                    of: 1
                },
                expectedRegisters: {
                    bx: parseInt("1001101011111010", 2),

                    cf: 1,
                    of: 1 // XOR of 2 MSBs of result
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
rcr ${operand1}, ${operand2}

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
