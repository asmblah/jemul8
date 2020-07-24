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

    describe("CPU 'bts' (Bit Test and Set) instruction", function () {
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
            "16-bit, when bit offset is < 16, selecting a set bit": {
                is32BitCodeSegment: false,
                operand1: "ax", // Bit base
                operand2: "bx", // Bit offset
                registers: {
                    ax: parseInt('00000100', 2),
                    bx: 2
                },
                expectedRegisters: {
                    // Bit base should be left unchanged, because although we set
                    // the bit that was read, it was already 1
                    ax: parseInt('00000100', 2),
                    bx: 2, // Bit offset should have been left unchanged
                    cf: 1  // Bit was set
                }
            },
            "16-bit, when bit offset is < 16, selecting a clear bit": {
                is32BitCodeSegment: false,
                operand1: "ax", // Bit base
                operand2: "bx", // Bit offset
                registers: {
                    ax: parseInt('00000100', 2),
                    bx: 3
                },
                expectedRegisters: {
                    // The bit that was read should now be set
                    ax: parseInt('00001100', 2),
                    bx: 3, // Bit offset should have been left unchanged
                    cf: 0  // Bit was clear
                }
            },
            "16-bit, when bit offset is > 16 so we rely on modulo, selecting a set bit": {
                is32BitCodeSegment: false,
                operand1: "ax", // Bit base
                operand2: "bx", // Bit offset
                registers: {
                    ax: parseInt('00000100', 2),
                    bx: 18
                },
                expectedRegisters: {
                    // Bit base should be left unchanged, because although we set
                    // the bit that was read, it was already 1
                    ax: parseInt('00000100', 2),
                    bx: 18, // Bit offset should have been left unchanged
                    cf: 1  // Bit was set
                }
            },
            "16-bit, when bit offset is > 16 so we rely on modulo, selecting a clear bit": {
                is32BitCodeSegment: false,
                operand1: "ax", // Bit base
                operand2: "bx", // Bit offset
                registers: {
                    ax: parseInt('00000100', 2),
                    bx: 20
                },
                expectedRegisters: {
                    // The bit that was read should now be set
                    ax: parseInt('00010100', 2),
                    bx: 20, // Bit offset should have been left unchanged
                    cf: 0  // Bit was clear
                }
            },
            "32-bit, when bit offset is > 32 so we rely on modulo, selecting a set bit": {
                is32BitCodeSegment: false,
                operand1: "eax", // Bit base
                operand2: "ebx", // Bit offset
                registers: {
                    eax: parseInt('00000000000000000000000000000100', 2),
                    ebx: 34
                },
                expectedRegisters: {
                    // Bit base should be left unchanged, because although we set
                    // the bit that was read, it was already 1
                    eax: parseInt('00000000000000000000000000000100', 2),
                    ebx: 34, // Bit offset should have been left unchanged
                    cf: 1  // Bit was set
                }
            },
            "32-bit, when bit offset is > 32 so we rely on modulo, selecting a clear bit": {
                is32BitCodeSegment: false,
                operand1: "eax", // Bit base
                operand2: "ebx", // Bit offset
                registers: {
                    eax: parseInt('00000000000000000000000000000100', 2),
                    ebx: 36
                },
                expectedRegisters: {
                    // The bit that was read should now be set
                    eax: parseInt('00000000000000000000000000010100', 2),
                    ebx: 36, // Bit offset should have been left unchanged
                    cf: 0  // Bit was clear
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
bts ${operand1}, ${operand2}

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
