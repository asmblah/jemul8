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

        util.each([
            {
                operand1: "ax",
                operand2: "ax",
                setup: {
                    ax: 0
                },
                expectedFlags: {
                    sf: 0,
                    zf: 1, // Result of SUB is zero, so zero flag should be set
                    pf: util.getParity(0 - 0)
                }
            },
            {
                operand1: "ax",
                operand2: "byte -1",
                setup: {
                    ax: -10
                },
                expectedFlags: {
                    sf: 1, // Negative result
                    zf: 0, // Non-zero result
                    pf: util.getParity(-10 - (-1))
                }
            },
            {
                operand1: "ax",
                operand2: "byte -1",
                setup: {
                    ax: 10
                },
                expectedFlags: {
                    sf: 0, // Positive result
                    zf: 0, // Non-zero result
                    pf: util.getParity(10 - (-1))
                }
            },
            // Subtraction of negative number that results in zero
            {
                operand1: "ax",
                operand2: "byte -4",
                setup: {
                    ax: -4
                },
                expectedFlags: {
                    sf: 0, // Positive result
                    zf: 1, // Zero result
                    pf: util.getParity(-4 - (-4))
                }
            }
        ], function (scenario) {
            var setupSummary = JSON.stringify(scenario.setup).replace(/^\{|\}$/g, "");

            // Test in both modes so we check support for operand-size override prefix
            util.each([true, false], function (is32BitCodeSegment) {
                describe("when code segment is " + (is32BitCodeSegment ? 32 : 16) + "-bit", function () {
                    describe("for 'cmp " + scenario.operand1 + ", " + scenario.operand2 + "' with " + setupSummary, function () {
                        var registers;

                        beforeEach(function (done) {
                            var assembly = util.heredoc(function (/*<<<EOS
org 0x100
[BITS ${bits}]
cmp ${operand1}, ${operand2}

hlt
EOS
*/) {}, {operand1: scenario.operand1, operand2: scenario.operand2, bits: is32BitCodeSegment ? 32 : 16});
                            registers = system.getCPURegisters();

                            testSystem.on("pre-run", function () {
                                registers.cs.set32BitMode(is32BitCodeSegment);
                            });

                            util.each(scenario.setup, function (value, register) {
                                registers[register].set(value);
                            });

                            testSystem.execute(assembly).done(function () {
                                done();
                            }).fail(function (exception) {
                                done(exception);
                            });
                        });

                        /*it("should clear cf", function () {
                            expect(registers.cf.get()).to.equal(0);
                        });

                        it("should clear of", function () {
                            expect(registers.of.get()).to.equal(0);
                        });*/

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
