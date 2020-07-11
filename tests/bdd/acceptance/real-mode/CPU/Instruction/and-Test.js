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

    describe("CPU 'and' (bitwise AND) instruction", function () {
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
            "with SIB byte and displacement, positive non-zero result": {
                operand1: "[ss:bp+si+0x79]",
                operand2: "ah",
                registers: {
                    ss: 0x500,
                    bp: 0x1234,
                    si: 0x4567,
                    ax: 0x0fcd,

                    af: 1, // Set these 3 to make sure they are all clear
                    cf: 1,
                    of: 1,
                    pf: 1,
                    sf: 1,
                    zf: 1
                },
                memory: [{
                    to: (0x500 << 4) + 0x1234 + 0x4567 + 0x79,
                    data: 0x3c,
                    size: 1
                }],
                expectedMemory: [{
                    from: (0x500 << 4) + 0x1234 + 0x4567 + 0x79,
                    size: 1,
                    // 111100b AND 001111b to test overlap
                    expected: 0x3c & 0x0f
                }],
                expectedRegisters: {
                    af: 0,
                    cf: 0,
                    of: 0,
                    pf: util.getParity(0x3c & 0x0f),
                    sf: 0, // Positive result
                    zf: 0  // Non-zero result
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
and ${operand1}, ${operand2}

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
});
