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

    describe("CPU 'lss' (load full pointer with SS) instruction", function () {
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
            "reading pointer from segment 0x500, with segment 0xbeef via ES and 16-bit offset of 0x89ab into SS:CX": {
                operand1: "cx",
                operand2: "[es:0x6789]",
                registers: {
                    es: 0x500
                },
                memory: [{
                    to: (0x500 << 4) + 0x6789,
                    data: 0x89ab,
                    size: 2
                }, {
                    to: (0x500 << 4) + 0x6789 + 2,
                    data: 0xbeef,
                    size: 2
                }],
                expectedRegisters: {
                    ss: 0xbeef,
                    cx: 0x89ab
                }
            },
            "reading pointer from segment 0x400, with segment 0xc0de via DS and 32-bit offset of 0xabcd1234 into SS:EDX": {
                operand1: "edx",
                operand2: "[0x4567]",
                registers: {
                    ds: 0x400
                },
                memory: [{
                    to: (0x400 << 4) + 0x4567,
                    data: 0xabcd1234,
                    size: 4
                }, {
                    to: (0x400 << 4) + 0x4567 + 4,
                    data: 0xc0de,
                    size: 2
                }],
                expectedRegisters: {
                    ss: 0xc0de,
                    edx: 0xabcd1234
                }
            }
        }, function (scenario, description) {
            describe(description, function () {
                // Test in both modes so we check support for operand-size override prefix
                util.each([true, false], function (is32BitCodeSegment) {
                    describe("when code segment is " + (is32BitCodeSegment ? 32 : 16) + "-bit", function () {
                        beforeEach(function (done) {
                            var assembly = util.heredoc(function (/*<<<EOS
org 0x100
[BITS ${bits}]
${prefix} lss ${operand1}, ${operand2}

hlt
EOS
*/) {}, {operand1: scenario.operand1, operand2: scenario.operand2, prefix: scenario.prefix || "", bits: is32BitCodeSegment ? 32 : 16});

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
