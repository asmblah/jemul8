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

    describe("CPU 'setle' (set byte if less than or equal, signed) instruction", function () {
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
            "should set the byte when the left operand is smaller (both positive)": {
                operand1: "ax",
                operand2: "4",
                destination: "bl",
                registers: {
                    ax: 2
                },
                expectedRegisters: {
                    bl: 1
                }
            },
            "should set the byte when the left operand is equal (both positive)": {
                operand1: "ax",
                operand2: "3",
                destination: "bl",
                registers: {
                    ax: 3
                },
                expectedRegisters: {
                    bl: 1
                }
            },
            "should not set the byte when the left operand was greater (both positive)": {
                operand1: "ax",
                operand2: "3",
                destination: "bl",
                registers: {
                    ax: 6
                },
                expectedRegisters: {
                    bl: 0
                }
            }
        }, function (scenario, description) {
            describe(description, function () {
                // Test in both modes so we check support for operand-size override prefix
                util.each([true, false], function (is32BitCodeSegment) {
                    describe("when code segment is " + (is32BitCodeSegment ? 32 : 16) + "-bit", function () {
                        describe("for 'cmp " + scenario.operand1 + ", " + scenario.operand2 + "; setle " + scenario.destination + "'", function () {
                            beforeEach(function (done) {
                                var assembly = util.heredoc(function (/*<<<EOS
org 0x100
[BITS ${bits}]
cmp ${operand1}, ${operand2}
setle ${destination}

hlt
EOS
*/) {}, {destination: scenario.destination, operand1: scenario.operand1, operand2: scenario.operand2, bits: is32BitCodeSegment ? 32 : 16});

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

                            util.each(scenario.expectedRegisters, function (expectedValue, register) {
                                it("should set " + register + " correctly", function () {
                                    expect(registers[register].get()).to.equal(expectedValue);
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});
