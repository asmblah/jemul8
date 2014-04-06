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

    describe("CPU 'div' (unsigned divide) instruction", function () {
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
            "16-bit divide of ax 100 by 2 with no remainder": {
                divisor: "bl",
                registers: {
                    ax: 100,
                    bl: 2
                },
                expectedRegisters: {
                    al: 50,
                    ah: 0
                }
            },
            "16-bit divide of ax 21 by 12 with remainder": {
                divisor: "bl",
                registers: {
                    ax: 21,
                    bl: 12
                },
                expectedRegisters: {
                    al: 1,
                    ah: 9
                }
            },
            "32-bit divide of dx:ax 21 by 12 with remainder": {
                divisor: "bx",
                registers: {
                    dx: 0,
                    ax: 21,
                    bx: 12
                },
                expectedRegisters: {
                    ax: 1,
                    dx: 9
                }
            }
        }, function (scenario, description) {
            describe(description, function () {
                // Test in both modes so we check support for operand-size override prefix
                util.each([true, false], function (is32BitCodeSegment) {
                    describe("when code segment is " + (is32BitCodeSegment ? 32 : 16) + "-bit", function () {
                        var registers;

                        beforeEach(function (done) {
                            var assembly = util.heredoc(function (/*<<<EOS
org 0x100
[BITS ${bits}]
div ${divisor}

hlt
EOS
*/) {}, {divisor: scenario.divisor, bits: is32BitCodeSegment ? 32 : 16});
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

                        util.each(scenario.expectedRegisters, function (value, name) {
                            it("should leave the correct value in " + name, function () {
                                expect(registers[name].get()).to.equal(value >>> 0);
                            });
                        });
                    });
                });
            });
        });
    });
});
