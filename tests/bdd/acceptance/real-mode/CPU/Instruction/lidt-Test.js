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

    describe("CPU 'lidt' (load interrupt descriptor table register) instruction", function () {
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
            "with a 32-bit base of 0xabcd1234 and limit of 0xdefa": {
                prefix: "o32 ",
                operand: "[0x4567]",
                registers: {
                    ds: 0x300
                },
                memory: [{
                    to: (0x300 << 4) + 0x4567,
                    data: 0xdefa,
                    size: 2
                }, {
                    to: (0x300 << 4) + 0x4567 + 2,
                    data: 0xabcd1234,
                    size: 4
                }],
                expectedBase: 0xabcd1234,
                expectedLimit: 0xdefa
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
${prefix} lidt ${operand}

hlt
EOS
*/) {}, {operand: scenario.operand, prefix: scenario.prefix, bits: is32BitCodeSegment ? 32 : 16});
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

                        it("should set the correct base", function () {
                            expect(registers.idtr.getBase()).to.equal(scenario.expectedBase);
                        });

                        it("should set the correct limit", function () {
                            expect(registers.idtr.getLimit()).to.equal(scenario.expectedLimit);
                        });
                    });
                });
            });
        });
    });
});
