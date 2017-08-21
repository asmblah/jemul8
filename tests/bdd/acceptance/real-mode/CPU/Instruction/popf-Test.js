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

    describe("CPU 'popf' (pop flags or eflags) instruction", function () {
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
            "16-bit pop into flags of 0xabcd": {
                is32BitCodeSegment: false,
                registers: {
                    ss: 0x300,
                    sp: 0x200
                },
                memory: [{
                    to: (0x300 << 4) + 0x200,
                    data: 0xabcd,
                    size: 2
                }],
                expectedRegisters: {
                    flags: 0xabcd,
                    eflags: 0x0000abcd // Ensure high word of eflags is left untouched
                }
            },
            "16-bit pop into flags of 0x0fd5": {
                is32BitCodeSegment: false,
                registers: {
                    ss: 0x300,
                    sp: 0x200
                },
                memory: [{
                    to: (0x300 << 4) + 0x200,
                    data: 0x0fd5,
                    size: 2
                }],
                expectedRegisters: {
                    flags: 0x0fd5,
                    eflags: 0x00000fd5 // Ensure high word of eflags is left untouched
                }
            },
            "16-bit pop into flags of 0xf000": {
                is32BitCodeSegment: false,
                registers: {
                    ss: 0x300,
                    sp: 0x200
                },
                memory: [{
                    to: (0x300 << 4) + 0x200,
                    data: 0xf000,
                    size: 2
                }],
                expectedRegisters: {
                    flags: 0xf000,
                    eflags: 0x0000f000 // Ensure high word of eflags is left untouched
                }
            },
            "32-bit pop into eflags": {
                is32BitCodeSegment: true,
                registers: {
                    ss: 0x400,
                    esp: 0x102
                },
                memory: [{
                    to: (0x400 << 4) + 0x102,
                    data: 0x4321bcde,
                    size: 4
                }],
                expectedRegisters: {
                    flags: 0xbcde,
                    eflags: 0x4321bcde
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
popf

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
