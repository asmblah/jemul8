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

    describe("FPU disabled test", function () {
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
            it("should do nothing on FPU instructions when EM is clear", function (done) {
                var assembly = util.heredoc(function (/*<<<EOS
org 0x100

[BITS 16]
    ;; From http://wiki.osdev.org/FPU
    fninit                                  ; Load defaults to FPU
    fnstsw [testword]                       ; Store status word
    cmp word [testword], 0                  ; Compare the written status with the expected FPU state
    jne nofpu                               ; Jump if the FPU hasn't written anything (i.e. it's not there)
    jmp hasfpu

nofpu:
    mov ax, 1234
    hlt

hasfpu:
    mov ax, 9999
    hlt

testword: dw 0x55AA                         ; Store garbage to be able to detect a change

EOS
*/) {});
                system.getCPURegisters().em.clear();

                testSystem.execute(assembly).done(function () {
                    // Check that FPU was not detected as it did nothing
                    expect(system.getCPURegisters().ax.get()).to.equal(1234);
                    done();
                }).fail(function (exception) {
                    done(exception);
                });
            });

            it("should raise an Undefined Opcode exception (Interrupt 6) on FPU instructions when EM is set", function (done) {
                var assembly = util.heredoc(function (/*<<<EOS
org 0x100

[BITS 16]
    xor ax, ax
    mov es, ax ;; Use the Extra Segment to point to the IVT's segment (0)
    mov [es:4 * 6 + 2], ax ;; Handler will be in segment 0
    mov ax, undef_opcode_handler ;; Handler offset within segment
    mov [es:4 * 6], ax

    ;; -- Handler installed, now run an FPU instruction to raise the #UD exception --

    fninit
    hlt

;; Undefined opcode exception (Interrupt 6) handler
undef_opcode_handler:
    mov dx, 1234 ;; Result!
    hlt
EOS
*/) {});
                system.getCPURegisters().em.set();

                testSystem.execute(assembly).done(function () {
                    // Check that undefined opcode ISR was called as emulation is enabled
                    expect(system.getCPURegisters().dx.get()).to.equal(1234);
                    done();
                }).fail(function (exception) {
                    done(exception);
                });
            });
        });
    });
});
