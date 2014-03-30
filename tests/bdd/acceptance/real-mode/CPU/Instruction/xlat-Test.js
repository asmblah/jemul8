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

    describe("CPU 'xlat' (table look-up translation) instruction", function () {
        /*jshint bitwise: false */
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

        util.each({
            "should look up the correct byte in memory when using DS as segment with effective base address zero": {
                registers: {
                    ds: 0,
                    bx: 2000,
                    al: 10
                },
                memory: [{
                    to: 2000 + 10,
                    data: 23,
                    size: 1
                }],
                expectedRegisters: {
                    al: 23
                }
            },
            "should look up the correct byte in memory when using DS as segment with effective base address 0x500": {
                registers: {
                    ds: 0x50,
                    bx: 4321,
                    al: 11
                },
                memory: [{
                    to: (0x50 << 4) + 4321 + 11,
                    data: 21,
                    size: 1
                }],
                expectedRegisters: {
                    al: 21
                }
            },
            "should look up the correct byte in memory when using ES as segment with effective base address 0x500": {
                prefix: "es ",
                registers: {
                    es: 0x50,
                    bx: 4321,
                    al: 11
                },
                memory: [{
                    to: (0x50 << 4) + 4321 + 11,
                    data: 21,
                    size: 1
                }],
                expectedRegisters: {
                    al: 21
                }
            }
        }, function (scenario, description) {
            describe(description, function () {
                // Test in both modes so we check support for operand-size override prefix
                util.each([true, false], function (is32BitCodeSegment) {
                    describe("when code segment is " + (is32BitCodeSegment ? 32 : 16) + "-bit", function () {
                        describe("for 'xlat'", function () {
                            var registers;

                            beforeEach(function (done) {
                                var assembly = util.heredoc(function (/*<<<EOS
org 0x100
[BITS ${bits}]
${prefix} xlat

hlt
EOS
*/) {}, {prefix: scenario.prefix || "", bits: is32BitCodeSegment ? 32 : 16});
                                registers = system.getCPURegisters();

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
