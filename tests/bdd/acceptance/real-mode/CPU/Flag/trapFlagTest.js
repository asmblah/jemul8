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

    describe("CPU Trap Flag", function () {
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

        describe("when under 16-bit real mode", function () {
            it("should raise exception 1 (Debug/Trap)", function (done) {
                var assembly = util.heredoc(function (/*<<<EOS
org 0x100

[BITS 16]
; We'll use CX for counting the traps
mov cx, 0

; Install INT 1 handler in the IVT
mov word [1 * 4], int1_handler

; Enable the trap flag (TF)
pushf
mov bp, sp
or word [bp], 0x100
popf

mov ax, 0x1001
mov ax, 0x1002

push ss
; Trap exception should not fire after this pop, as we just loaded SS
; (because the next instruction is supposed to load a valid (E)SP as appropriate)
pop ss
mov ax, 0x9888

mov ax, 0x1003
mov ax, 0x1004

; Finish
hang:
hlt
jmp hang

int1_handler:
    push ax
    ; Keep a simple counter of the no. of times this interrupt occurs (see assertion below)
    inc cx

    ; Write ax out so that we can check the trap exception interrupt fired at the right time
    ; (captured with an event listener below).
    ; Note that ports 0xe7 and 0xe8 have been picked arbitrarily as they don't collide with any virtual devices
    out 0xe7, ax

    ; Write the low word of DR6 out so that we can check the trap exception set bit 14
    ; (captured with an event listener below)
    mov eax, dr6
    out 0xe8, ax ; Discard the high word of the saved DR6

    pop ax
    ; The saved instruction pointer should just point to the instruction _after_
    ; the one that caused the exception, so we can just resume from there
    iret

EOS
*/) {}),
                    log = [];

                system.on('io write', function (port, value) {
                    log.push('0x' + port.toString(16) + ': 0x' + value.toString(16));
                });

                testSystem.execute(assembly).done(function () {
                    expect(system.getCPURegisters().cx.get()).to.equal(6);
                    expect(log).to.deep.equal([
                        // First mov
                        "0xe7: 0x1001",
                        "0xe8: 0x4000", // Ensure that bit 14 in DR6 was set (https://wiki.osdev.org/CPU_Registers_x86#DR6)

                        // Second mov
                        "0xe7: 0x1002",
                        "0xe8: 0x4000",

                        // Push SS
                        "0xe7: 0x1002",
                        "0xe8: 0x4000",

                        // (Pop SS shouldn't be trapped)

                        // Third mov (the one after pop of SS)
                        "0xe7: 0x9888",
                        "0xe8: 0x4000",

                        // Fourth mov
                        "0xe7: 0x1003",
                        "0xe8: 0x4000",

                        // Fifth mov
                        "0xe7: 0x1004",
                        "0xe8: 0x4000"
                    ]);

                    done();
                }).fail(function (exception) {
                    done(exception);
                });
            });
        });
    });
});
