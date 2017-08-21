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

    // TODO: Add tests to ensure SP is incremented if specified by stack segment descriptor! (protected mode)

    describe("CPU 'push' instruction", function () {
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
                codeSegment: {
                    // Address size and operand size are always the same for a segment - one flag in the descriptor
                    operandSize: 2
                },
                stackSegment: {
                    addressSize: 2
                }
            }
        ], function (scenario) {
            var codeSegment = scenario.codeSegment,
                stackSegment = scenario.stackSegment;

            describe("when the address-size attribute of the stack segment is " + stackSegment.addressSize * 8 + "-bit", function () {
                describe("when the operand-size attribute of the current code segment is " + codeSegment.operandSize * 8 + "-bit", function () {
                    util.each({
                        "when the operand-size of the current instruction is 16-bit and an 8-bit immediate value is pushed": {
                            assembly: util.heredoc(function (/*<<<EOS
mov ax, 0
mov ss, ax
mov esp, 0x00c0fffd
;; Push an 8-bit value: it should be sign-extended to 16-bit
push byte 0xF2
hlt
EOS
*/) {}),
                            operandSize: 2,
                            expectedValue: 0xFFF2 // Note the sign extension of high bits
                        },
                        "when the operand-size of the current instruction is 32-bit and an 8-bit immediate value is pushed": {
                            assembly: util.heredoc(function (/*<<<EOS
mov ax, 0
mov ss, ax
mov esp, 0x00c0fffd
mov dx, 0x404
out dx, ax
;; Push an 8-bit value: it should be sign-extended to 32-bit
o32 push byte 0xF2
hlt
EOS
*/) {}),
                            operandSize: 4,
                            expectedValue: 0xFFFFFFF2 // Note the sign extension of high bits
                        },
                        "when the operand-size of the current instruction is 16-bit (so a 16-bit immediate value is pushed)": {
                            assembly: util.heredoc(function (/*<<<EOS
mov ax, 0
mov ss, ax
mov esp, 0x00c0fffd
push word 0x1234
hlt
EOS
*/) {}),
                            operandSize: 2,
                            expectedValue: 0x1234
                        },
                        "when the operand-size of the current instruction is 32-bit (so a 32-bit immediate value is pushed)": {
                            assembly: util.heredoc(function (/*<<<EOS
mov ax, 0
mov ss, ax
mov esp, 0x00c0fffd
push dword 0x12345678
hlt
EOS
*/) {}),
                            operandSize: 4,
                            expectedValue: 0x12345678
                        }
                    }, function (scenario, description) {
                        describe(description, function () {
                            beforeEach(function (done) {
                                var assembly = scenario.assembly;

                                assembly = "[BITS " + (codeSegment.operandSize * 8) + "]\n" + assembly;

                                testSystem.execute(assembly).done(function () {
                                    done();
                                }).fail(function (exception) {
                                    done(exception);
                                });
                            });

                            it("should not change SS", function () {
                                expect(system.getCPURegisters().ss.get()).to.equal(0);
                            });

                            if (scenario.operandSize === 2) {
                                it("should decrease SP by " + scenario.operandSize + " (operand-size)", function () {
                                    expect(system.getCPURegisters().sp.get()).to.equal(0xfffd - scenario.operandSize);
                                });

                                it("should not change the high word of ESP", function () {
                                    /*jshint bitwise: false */
                                    expect(system.getCPURegisters().esp.get() >>> 16).to.equal(0x00c0);
                                });
                            } else {
                                it("should decrease ESP by " + scenario.operandSize + " (operand-size)", function () {
                                    expect(system.getCPURegisters().esp.get()).to.equal(0x00c0fffd - scenario.operandSize);
                                });
                            }

                            if (stackSegment.addressSize === 2) {
                                it("should place the pushed value on the stack in the correct place", function () {
                                    expect(system.read({from: 0xfffd - scenario.operandSize, size: scenario.operandSize})).to.equal(scenario.expectedValue);
                                });
                            } else {
                                it("should place the pushed value on the stack in the correct place", function () {
                                    expect(system.read({from: 0x00c0fffd - scenario.operandSize, size: scenario.operandSize})).to.equal(scenario.expectedValue);
                                });
                            }
                        });
                    });
                });
            });
        });
    });
});
