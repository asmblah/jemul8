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

    describe("CPU 'div' (unsigned divide) instruction", function () {
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
            "16-bit divide of ax 255 by 1 with no remainder": {
                divisor: "dh",
                registers: {
                    ax: 255,
                    dh: 1
                },
                expectedRegisters: {
                    al: 255, // Quotient: 255
                    ah: 0,   // No remainder
                    dh: 1    // (Just check the divisor register is left untouched)
                }
            },
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
            "16-bit divide of ax 0xffff by 1 with no remainder": {
                divisor: "dh",
                registers: {
                    ax: 0xffff,
                    dh: 1,

                    // Set up the stack for the exception
                    ss: 0xd000,
                    esp: 0xe000
                },
                expectedRegisters: {
                    // Ensure registers are left unchanged
                    ax: 0xffff,
                    dh: 1
                },
                // Should overflow because quotient (0xffff) will not fit in al
                expectedExceptionVector: CPU.DIVIDE_ERROR
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
            },
            "32-bit divide of dx:ax 0xa320c3da by 0xffff": {
                divisor: "bx",
                registers: {
                    dx: 0xa320,
                    ax: 0xc3da,
                    bx: 0xffff
                },
                expectedRegisters: {
                    ax: 0xa321, // Quotient:  0xa320c3da / 0xffff
                    dx: 0x66fb, // Remainder: 0xa320c3da - (0xa321 * 0xffff)
                    bx: 0xffff  // Ensure bx (divisor) is left unchanged
                }
            },
            "32-bit divide of dx:ax 0xa320c3da by 14": {
                divisor: "bx",
                registers: {
                    dx: 0xa320,
                    ax: 0xc3da,
                    bx: 14,

                    // Set up the stack for the exception
                    ss: 0xd000,
                    esp: 0xe000
                },
                expectedRegisters: {
                    // Ensure registers are left unchanged
                    ax: 0xc3da,
                    dx: 0xa320,
                    bx: 14
                },
                // Should overflow because quotient will not fit in ax
                expectedExceptionVector: CPU.DIVIDE_ERROR
            },
            // Check that zero-padded eax is handled correctly
            "64-bit divide of edx:eax 0xa321bcde00004321 by 0xfa2b3c4d": {
                divisor: "ebx",
                registers: {
                    edx: 0xa321bcde,
                    eax: 0x00004321,
                    ebx: 0xfa2b3c4d
                },
                expectedRegisters: {
                    eax: 0xa6ef2645, // Quotient: 0xa321bcde00004321 / 0xfa2b3c4d
                    edx: 0xed829460, // Remainder: 0xa321bcde00004321 - (0xa6ef2645 * 0xfa2b3c4d)
                    ebx: 0xfa2b3c4d  // Ensure ebx (divisor) is left unchanged
                }
            },
            "64-bit divide of edx:eax 0xa321bcde5def4321 by 0xfa2b3c4d": {
                divisor: "ebx",
                registers: {
                    edx: 0xa321bcde,
                    eax: 0x5def4321,
                    ebx: 0xfa2b3c4d
                },
                expectedRegisters: {
                    eax: 0xa6ef2646, // Quotient: 0xa321bcde5def4321 / 0xfa2b3c4d
                    edx: 0x51465813, // Remainder: 0xa321bcde5def4321 - (0xa6ef2646 * 0xfa2b3c4d)
                    ebx: 0xfa2b3c4d  // Ensure ebx (divisor) is left unchanged
                }
            },
            "64-bit divide of edx:eax 0xa321bcde5def4321 by 15": {
                divisor: "ecx",
                registers: {
                    edx: 0xa321bcde,
                    eax: 0x5def4321,
                    ecx: 15,

                    // Set up the stack for the exception
                    ss: 0xd000,
                    esp: 0xe000
                },
                expectedRegisters: {
                    // Ensure registers are left unchanged
                    eax: 0x5def4321,
                    edx: 0xa321bcde,
                    ecx: 15
                },
                // Should overflow because quotient will not fit in eax
                expectedExceptionVector: CPU.DIVIDE_ERROR
            },
            "16-bit divide of ax by zero": {
                divisor: "bl",
                registers: {
                    ax: 4,
                    bl: 0,

                    // Set up the stack for the exception
                    ss: 0xd000,
                    esp: 0xe000
                },
                expectedRegisters: {
                    ax: 4 // Ensure ax is left unchanged
                },
                expectedExceptionVector: CPU.DIVIDE_ERROR
            },
            "32-bit divide of dx:ax by zero": {
                divisor: "bx",
                registers: {
                    dx: 0x1234,
                    ax: 0x4321,
                    bx: 0,

                    // Set up the stack for the exception
                    ss: 0xd000,
                    esp: 0xe000
                },
                expectedRegisters: {
                    // Ensure registers are left unchanged
                    ax: 0x4321,
                    dx: 0x1234,
                    bx: 0
                },
                expectedExceptionVector: CPU.DIVIDE_ERROR
            },
            "64-bit divide of edx:eax by zero": {
                divisor: "ebx",
                registers: {
                    edx: 0xabcd1234,
                    eax: 0xdcba4321,
                    ebx: 0,

                    // Set up the stack for the exception
                    ss: 0xd000,
                    esp: 0xe000
                },
                expectedRegisters: {
                    // Ensure registers are left unchanged
                    eax: 0xdcba4321,
                    edx: 0xabcd1234,
                    ebx: 0
                },
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
div ${divisor}

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
                                expect(registers[name].get()).to.equal(value >>> 0);
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
