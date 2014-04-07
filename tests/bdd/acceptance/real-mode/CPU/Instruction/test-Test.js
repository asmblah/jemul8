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

    describe("CPU 'test' instruction", function () {
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

        util.each([
            {
                operand1: "ax",
                operand2: "ax",
                setup: {
                    ax: 0
                },
                expectedFlags: {
                    sf: 0,
                    zf: 1, // Result of AND is zero, so zero flag should be set
                    pf: util.getParity(0)
                }
            },
            {
                operand1: "ax",
                operand2: "2",
                setup: {
                    ax: 1
                },
                expectedFlags: {
                    sf: 0,
                    zf: 1, // Result of AND is zero, so zero flag should be set
                    pf: util.getParity(0)
                }
            },
            {
                operand1: "ax",
                operand2: "1",
                setup: {
                    ax: 1
                },
                expectedFlags: {
                    sf: 0,
                    zf: 0,
                    pf: util.getParity(1)
                }
            },
            {
                operand1: "ax",
                operand2: "ax",
                setup: {
                    ax: -1
                },
                expectedFlags: {
                    sf: 1, // Negative result, so sign flag should be set
                    zf: 0,
                    pf: util.getParity(-1)
                }
            }
        ], function (scenario) {
            var setupSummary = JSON.stringify(scenario.setup).replace(/^\{|\}$/g, "");

            // Test in both modes so we check support for operand-size override prefix
            util.each([true, false], function (is32BitCodeSegment) {
                describe("when code segment is " + (is32BitCodeSegment ? 32 : 16) + "-bit", function () {
                    describe("for 'test " + scenario.operand1 + ", " + scenario.operand2 + "' with " + setupSummary, function () {
                        beforeEach(function (done) {
                            var assembly = util.heredoc(function (/*<<<EOS
org 0x100
[BITS ${bits}]
test ${operand1}, ${operand2}

hlt
EOS
*/) {}, {operand1: scenario.operand1, operand2: scenario.operand2, bits: is32BitCodeSegment ? 32 : 16});

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

                        it("should clear cf", function () {
                            expect(registers.cf.get()).to.equal(0);
                        });

                        it("should clear of", function () {
                            expect(registers.of.get()).to.equal(0);
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
