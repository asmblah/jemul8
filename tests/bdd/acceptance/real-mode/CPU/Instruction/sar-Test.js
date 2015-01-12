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

    describe("CPU 'sar' (shift arithmetic right) instruction", function () {
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
            "-9 >> 2 = -3 r +3": {
                is32BitCodeSegment: false,
                operand1: "bx",
                operand2: "2",
                registers: {
                    bx: -9,

                    of: 1 // Set OF to ensure it is cleared
                },
                expectedRegisters: {
                    bx: -3 & 0xffff,
                    cf: 1, // Last bit shifted out

                    of: 0,
                    sf: 1
                }
            },
            "0xdfb9 >> 0xff": {
                is32BitCodeSegment: false,
                operand1: "bx",
                operand2: "cl",
                registers: {
                    bx: 0xdfb9,
                    cl: 0xff,

                    of: 1 // Set OF to ensure it is cleared
                },
                expectedRegisters: {
                    bx: 0xffff,
                    cf: 1, // Last bit shifted out

                    of: 0,
                    sf: 1
                }
            },
            "0x7fff >> 2": {
                is32BitCodeSegment: false,
                operand1: "bx",
                operand2: "cl",
                registers: {
                    bx: 0x7fff,
                    cl: 2,

                    of: 1 // Set OF to ensure it is cleared
                },
                expectedRegisters: {
                    bx: 0x1fff,
                    cf: 1, // Last bit shifted out

                    of: 0,
                    sf: 0
                }
            },
            "0xffc9 >> 7": {
                is32BitCodeSegment: false,
                operand1: "bx",
                operand2: "cl",
                registers: {
                    bx: 0xffc9,
                    cl: 7,

                    of: 1 // Set OF to ensure it is cleared
                },
                expectedRegisters: {
                    bx: 0xffff,
                    cf: 1, // Last bit shifted out

                    of: 0,
                    sf: 1
                }
            },
            "shift by zero bits should not affect flags": {
                is32BitCodeSegment: false,
                operand1: "bx",
                operand2: "cl",
                registers: {
                    cl: 0,

                    flags: 0xffff
                },
                expectedRegisters: {
                    cl: 0,

                    flags: 0xffff
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
sar ${operand1}, ${operand2}

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
