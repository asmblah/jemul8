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

    describe("CPU 'shl' (shift left) instruction", function () {
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
            "6 << 0 = 20": {
                is32BitCodeSegment: false,
                operand1: "bx",
                operand2: "0",
                registers: {
                    bx: 6,

                    of: 1 // Set OF to ensure it is unaffected (not a 1-bit shift)
                },
                expectedRegisters: {
                    bx: 6,
                    cf: 0, // Last bit shifted out

                    of: 1, // Should be set (see above)
                    sf: 0  // Positive result
                }
            },
            "5 << 2 = 20": {
                is32BitCodeSegment: false,
                operand1: "bx",
                operand2: "2",
                registers: {
                    bx: 5,

                    of: 1 // Set OF to ensure it is cleared (not a 1-bit shift)
                },
                expectedRegisters: {
                    bx: 20,
                    cf: 0, // Last bit shifted out

                    of: 0, // Should be cleared (see above)
                    sf: 0  // Positive result
                }
            },
            "5 << 1 = 10": {
                is32BitCodeSegment: false,
                operand1: "bx",
                operand2: "1",
                registers: {
                    bx: 5,

                    of: 1  // Set OF to ensure it is cleared (1-bit shift)
                },
                expectedRegisters: {
                    bx: 10,
                    cf: 0, // Last bit shifted out

                    of: 0, // Cleared if MSB of result == CF
                    sf: 0  // Positive result
                }
            },
            "10011111b << 1 = 00111110b": {
                is32BitCodeSegment: false,
                operand1: "bl",
                operand2: "1",
                registers: {
                    bl: 0x9f,

                    of: 0  // Clear OF to ensure it is set (1-bit shift)
                },
                expectedRegisters: {
                    bl: 0x3e,
                    cf: 1, // Last bit shifted out

                    of: 1, // Set if MSB of result <> CF
                    sf: 0  // Positive result
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
shl ${operand1}, ${operand2}

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
