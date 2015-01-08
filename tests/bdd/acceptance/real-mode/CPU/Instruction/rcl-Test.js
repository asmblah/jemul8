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

    describe("CPU 'rcl' (rotate through carry left) instruction", function () {
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
            "10111010b << 0 = 10111010b": {
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
            "10111010b << 1 = 01110101b": {
                is32BitCodeSegment: false,
                operand1: "bl",
                operand2: "1",
                registers: {
                    bl: parseInt("10111010", 2),

                    cf: 1, // Set CF to ensure it is shifted into LSB
                    of: 0  // Clear OF to ensure it is set (1-bit rotate: CF XOR MSB)
                },
                expectedRegisters: {
                    bl: parseInt("01110101", 2),

                    cf: 1, // CF should be left with one from the 1st MSB
                    of: 1  // Should be set (see above)
                }
            },
            "10111010b << 2 = 11101011b": {
                is32BitCodeSegment: false,
                operand1: "bl",
                operand2: "2",
                registers: {
                    bl: parseInt("10111010", 2),

                    cf: 1, // Set CF to ensure it is shifted into LSB
                    of: 1  // Set OF to ensure it is unaffected (not a 1-bit rotate)
                },
                expectedRegisters: {
                    bl: parseInt("11101011", 2),

                    cf: 0, // CF should be left with zero from the 2nd MSB
                    of: 1  // Should be set (see above)
                }
            },
            "10111010b << 3 = 11010110b": {
                is32BitCodeSegment: false,
                operand1: "bl",
                operand2: "3",
                registers: {
                    bl: parseInt("10111010", 2),

                    cf: 1, // Set CF to ensure it is shifted into LSB
                    of: 1  // Set OF to ensure it is cleared
                },
                expectedRegisters: {
                    bl: parseInt("11010110", 2),

                    cf: 1, // CF should be left with zero from the 2nd MSB
                    of: 0  // Should be cleared (see above)
                }
            },
            "0xc8a7 << 0xff = 0": {
                is32BitCodeSegment: false,
                operand1: "bx",
                operand2: "0xff",
                registers: {
                    bx: 0xc8a7,

                    cf: 1, // Set CF to ensure it is shifted into LSB
                    of: 1  // Set OF to ensure it is cleared
                },
                expectedRegisters: {
                    bx: 0xf914,

                    cf: 1, // CF should be left with one
                    of: 0  // Should be cleared (see above)
                }
            },
            "8-bit rotates should be modulo 9": {
                is32BitCodeSegment: false,
                operand1: "bl",
                operand2: "10",
                registers: {
                    bl: parseInt("00110101", 2),

                    cf: 1, // Set CF to ensure it is shifted into LSB
                    of: 1  // Set OF to ensure it is cleared
                },
                expectedRegisters: {
                    bl: parseInt("01101011", 2),

                    cf: 0, // CF should be left with zero
                    of: 0  // Should be cleared
                }
            },
            "16-bit rotates should be modulo 17": {
                is32BitCodeSegment: false,
                operand1: "bx",
                operand2: "18",
                registers: {
                    bx: parseInt("0011010111110101", 2),

                    cf: 1, // Set CF to ensure it is shifted into LSB
                    of: 1  // Set OF to ensure it is cleared
                },
                expectedRegisters: {
                    bx: parseInt("0110101111101011", 2),

                    cf: 0, // CF should be left with zero
                    of: 0  // Should be cleared
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
rcl ${operand1}, ${operand2}

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
