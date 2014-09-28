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
    "js/CPU",
    "tools/TestSystem"
], function (
    util,
    CPU,
    TestSystem
) {
    "use strict";

    describe("CPU 'idiv' (signed divide) instruction", function () {
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
            "16-bit divide of ax +127 by +1 with no remainder": {
                divisor: "dh",
                registers: {
                    ax: 127,
                    dh: 1
                },
                expectedRegisters: {
                    al: 127, // Quotient: +127
                    ah: 0,   // No remainder
                    dh: 1    // (Just check the divisor register is left untouched)
                }
            },
            "16-bit divide of ax -100 by -2 with no remainder": {
                divisor: "bl",
                registers: {
                    ax: -100,
                    bl: -2
                },
                expectedRegisters: {
                    al: 50, // Positive quotient because dividend and divisor both negative
                    ah: 0
                }
            },
            "16-bit divide of ax -101 by -2 with remainder": {
                divisor: "bl",
                registers: {
                    ax: -101,
                    bl: -2
                },
                expectedRegisters: {
                    al: 50, // Positive quotient because dividend and divisor both negative
                    ah: -1  // Negative remainder (always same sign as dividend)
                }
            },
            "16-bit divide of ax -21 by +12 with remainder": {
                divisor: "bl",
                registers: {
                    ax: -21,
                    bl: 12
                },
                expectedRegisters: {
                    al: -1, // Negative quotient because one operand was negative
                    ah: -9  // Negative remainder (always same sign as dividend)
                }
            },
            "16-bit divide of ax +21 by -12 with remainder": {
                divisor: "bl",
                registers: {
                    ax: 21,
                    bl: -12
                },
                expectedRegisters: {
                    al: -1, // Negative quotient because one operand was negative
                    ah: 9   // Positive remainder (always same sign as dividend)
                }
            },
            "16-bit divide of ax -512 by +2 with no remainder": {
                divisor: "dh",
                registers: {
                    ax: -512,
                    dh: 2,

                    // Set up the stack for the exception
                    ss: 0xd000,
                    esp: 0xe000
                },
                expectedRegisters: {
                    // Ensure registers are left unchanged
                    ax: -512,
                    dh: 2
                },
                // Should overflow because quotient (-256) will not fit in al
                expectedExceptionVector: CPU.DIVIDE_ERROR
            },
            "32-bit divide of dx:ax +32767 by +1 with no remainder": {
                divisor: "cx",
                registers: {
                    dx: 0,
                    ax: 32767,
                    cx: 1
                },
                expectedRegisters: {
                    ax: 32767, // Quotient
                    dx: 0,     // No remainder
                    cx: 1      // (Just check the divisor register is left untouched)
                }
            },
            "32-bit divide of dx:ax -16777215 by -1024 with remainder": {
                divisor: "bx",
                registers: {
                    dx: -0xffffff >>> 16,
                    ax: -0xffffff & 0xffff,
                    bx: -1024
                },
                expectedRegisters: {
                    ax: 16383, // Positive quotient because dividend and divisor both negative
                    dx: -1023,  // Negative remainder (always same sign as dividend)
                    bx: -1024  // (Just check the divisor register is left untouched)
                }
            },
            "32-bit divide of dx:ax -16777215 by +512 with remainder": {
                divisor: "bx",
                registers: {
                    dx: -0xffffff >>> 16,
                    ax: -0xffffff & 0xffff,
                    bx: 512
                },
                expectedRegisters: {
                    ax: -32767, // Negative quotient because one operand was negative
                    dx: -511,   // Negative remainder (always same sign as dividend)
                    bx: 512     // (Just check the divisor register is left untouched)
                }
            },
            "32-bit divide of dx:ax -8388608 by +256 with no remainder": {
                divisor: "cx",
                registers: {
                    dx: -8388608 >> 16,
                    ax: -8388608 & 0xffff,
                    cx: 256
                },
                expectedRegisters: {
                    ax: -32768, // Negative quotient because one operand was negative
                    dx: 0,      // No remainder
                    cx: 256     // (Just check the divisor register is left untouched)
                }
            },
            "32-bit divide of dx:ax -8388864 by +256 with no remainder": {
                divisor: "cx",
                registers: {
                    dx: -8388864 >> 16,
                    ax: -8388864 & 0xffff,
                    cx: 256,

                    // Set up the stack for the exception
                    ss: 0xd000,
                    esp: 0xe000
                },
                expectedRegisters: {
                    // Ensure registers are left unchanged
                    dx: -8388864 >> 16,
                    ax: -8388864 & 0xffff,
                    cx: 256
                },
                // Should overflow because quotient (-32769) will not fit in ax
                expectedExceptionVector: CPU.DIVIDE_ERROR
            }
        }, function (scenario, description) {
            describe(description, function () {
                // Test in both modes so we check support for operand-size override prefix
                util.each([true, false], function (is32BitCodeSegment) {
                    describe("when code segment is " + (is32BitCodeSegment ? 32 : 16) + "-bit", function () {
                        var exceptionVector;

                        beforeEach(function (done) {
                            var assembly = util.heredoc(function (/*<<<EOS
org 0x100
[BITS ${bits}]
idiv ${divisor}

hlt
EOS
*/) {}, {divisor: scenario.divisor, bits: is32BitCodeSegment ? 32 : 16});

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

                            if (scenario.hasOwnProperty("expectedExceptionVector")) {
                                system.on("exception", function (vector) {
                                    exceptionVector = vector;
                                    system.pause();
                                });
                            }

                            testSystem.execute(assembly).done(function () {
                                done();
                            }).fail(function (exception) {
                                done(exception);
                            });
                        });

                        util.each(scenario.expectedRegisters, function (value, name) {
                            it("should leave the correct value in " + name, function () {
                                expect(registers[name].get()).to.equal((value & registers[name].getMask()) >>> 0);
                            });
                        });

                        if (scenario.hasOwnProperty("expectedExceptionVector")) {
                            it("should raise the expected CPU exception", function () {
                                expect(exceptionVector).to.equal(scenario.expectedExceptionVector);
                            });

                            it("should save the address of the divide instruction as the return address", function () {
                                expect(registers.ss.readSegment(registers.sp.get(), 2)).to.equal(0x100);
                                expect(registers.ss.readSegment(registers.sp.get() + 2, 2)).to.equal(0);
                            });
                        }
                    });
                });
            });
        });
    });
});
