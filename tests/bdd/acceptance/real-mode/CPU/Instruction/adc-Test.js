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

    describe("CPU 'adc' (add with carry) instruction", function () {
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
            "16-bit wrap past 0xffff and add carry when carry is 0": {
                is32BitCodeSegment: false,
                operand1: "bx",
                operand2: "ax",
                registers: {
                    ax: 0xffff,
                    bx: 1,
                    cf: 0
                },
                expectedRegisters: {
                    ax: 0xffff,
                    bx: 0,
                    cf: 1, // Adding the 1 to 0xffff results in a wrap-around, so 1 is carried
                    of: 0
                }
            },
            "16-bit wrap past 0xffff and add carry when carry is 1": {
                is32BitCodeSegment: false,
                operand1: "bx",
                operand2: "ax",
                registers: {
                    ax: 0xffff,
                    bx: 1,
                    cf: 1
                },
                expectedRegisters: {
                    ax: 0xffff,
                    bx: 1,
                    cf: 1, // Adding the 1 to 0xffff results in a wrap-around, so 1 is carried
                    of: 0
                }
            },
            "16-bit no wrap around when carry is 0": {
                is32BitCodeSegment: false,
                operand1: "bx",
                operand2: "ax",
                registers: {
                    ax: 4,
                    bx: 10,
                    cf: 0
                },
                expectedRegisters: {
                    ax: 4,
                    bx: 14,
                    cf: 0, // No wrap around, so no carry
                    of: 0
                }
            },
            "16-bit no wrap around when carry is 1": {
                is32BitCodeSegment: false,
                operand1: "bx",
                operand2: "ax",
                registers: {
                    ax: 4,
                    bx: 10,
                    cf: 1
                },
                expectedRegisters: {
                    ax: 4,
                    bx: 15,
                    cf: 0, // No wrap around, so no carry
                    of: 0
                }
            },
            "16-bit no wrap around when operands are zero and carry is 0": {
                is32BitCodeSegment: false,
                operand1: "bx",
                operand2: "ax",
                registers: {
                    ax: 0,
                    bx: 0,
                    cf: 0
                },
                expectedRegisters: {
                    ax: 0,
                    bx: 0,
                    cf: 0, // No wrap around, so no carry
                    of: 0
                }
            },
            "16-bit no wrap around when operands are zero and carry is 1": {
                is32BitCodeSegment: false,
                operand1: "bx",
                operand2: "ax",
                registers: {
                    ax: 0,
                    bx: 0,
                    cf: 1
                },
                expectedRegisters: {
                    ax: 0,
                    bx: 1,
                    cf: 0, // No wrap around, so no carry
                    of: 0
                }
            },
            "8-bit add when carry is 0": {
                is32BitCodeSegment: false,
                operand1: "bl",
                operand2: "al",
                registers: {
                    al: -128 & 0xff,
                    bl: -1 & 0xff,
                    cf: 0
                },
                expectedRegisters: {
                    al: -128 & 0xff,
                    bl: 127,
                    cf: 1, // Unsigned wrap around
                    of: 1  // Signed wrap around
                }
            },
            "8-bit add when carry is 1": {
                is32BitCodeSegment: false,
                operand1: "bl",
                operand2: "al",
                registers: {
                    al: -128 & 0xff,
                    bl: -1 & 0xff,
                    cf: 1
                },
                expectedRegisters: {
                    al: -128 & 0xff,
                    bl: 128,
                    cf: 1, // Unsigned wrap around
                    of: 0  // No signed wrap around
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
adc ${operand1}, ${operand2}

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
