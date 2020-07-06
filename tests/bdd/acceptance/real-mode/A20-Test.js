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

    describe("A20 address line handling test", function () {
        var checkA20Assembly = util.heredoc(function (/*<<<EOS
; From http://wiki.osdev.org/A20_Line#Testing_the_A20_line
org 0x100

[BITS 16]
; Returns: 0 in ax if the a20 line is disabled (memory wraps around)
;          1 in ax if the a20 line is enabled (memory does not wrap around)

check_a20:
    pushf
    push ds
    push es
    push di
    push si

    cli

    xor ax, ax ; ax = 0
    mov es, ax

    not ax ; ax = 0xFFFF
    mov ds, ax

    mov di, 0x0500
    mov si, 0x0510

    mov al, byte [es:di]
    push ax

    mov al, byte [ds:si]
    push ax

    mov byte [es:di], 0x00
    mov byte [ds:si], 0xFF

    cmp byte [es:di], 0xFF

    pop ax
    mov byte [ds:si], al

    pop ax
    mov byte [es:di], al

    mov ax, 0
    je check_a20__exit

    mov ax, 1

check_a20__exit:
    pop si
    pop di
    pop es
    pop ds
    popf

    hlt
EOS
*/) {}),
            system,
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
            it("should mask the A20 line in addresses at startup", function (done) {
                testSystem.execute(checkA20Assembly).done(function () {
                    // Check that A20 is reported as disabled
                    expect(system.getCPURegisters().ax.get()).to.equal(0);
                    done();
                }).fail(function (exception) {
                    done(exception);
                });
            });

            it("should not mask the A20 line in addresses after it has been enabled", function (done) {
                system.setEnableA20(true);

                testSystem.execute(checkA20Assembly).done(function () {
                    // Check that A20 is reported as disabled
                    expect(system.getCPURegisters().ax.get()).to.equal(1);
                    done();
                }).fail(function (exception) {
                    done(exception);
                });
            });

            it("should allow A20 to be enabled via the keyboard controller", function (done) {
                var assembly = util.heredoc(function (/*<<<EOS
; From http://wiki.osdev.org/A20_Line#Testing_the_A20_line
org 0x100

[BITS 16]
enable_A20:
    cli

    call    a20wait
    mov     al,0xAD
    out     0x64,al

    call    a20wait
    mov     al,0xD0
    out     0x64,al

    call    a20wait2
    in      al,0x60
    push    eax

    call    a20wait
    mov     al,0xD1
    out     0x64,al

    call    a20wait
    pop     eax
    or      al,2
    out     0x60,al

    call    a20wait
    mov     al,0xAE
    out     0x64,al

    call    a20wait
    sti
    hlt

a20wait:
    in      al,0x64
    test    al,2
    jnz     a20wait
    ret

a20wait2:
    in      al,0x64
    test    al,1
    jz      a20wait2
    ret

    hlt
EOS
*/) {});
                testSystem.execute(assembly).done(function () {
                    expect(system.getEnableA20()).to.be.true;
                    done();
                }).fail(function (exception) {
                    done(exception);
                });
            });
        });
    });
});
