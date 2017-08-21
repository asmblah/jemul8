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

    describe("CPU 'ltr' (Load Task Register) instruction", function () {
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

        describe("when under 32-bit protected mode", function () {
            it("should set register TR to the provided value", function (done) {
                var assembly = util.heredoc(function (/*<<<EOS
org 0x100

;; Set up ready to enter protected mode
cli
lgdt [gdtr]
mov eax, cr0
or al, 1
mov cr0, eax
jmp 0x10:protected

;; Enter protected mode
[BITS 32]
protected:
mov ax, 0x8
mov ds, ax
mov es, ax
mov ss, ax
mov esp, 0x100

;; Perform load of TR
mov ax, SYS_TSS
ltr ax

;; Finish
hang:
hlt
jmp hang

;; GDT
; Null descriptor
gdt:
    dw 0			; Limit 15:0
	dw 0			; Base 15:0
	db 0			; Base 23:16
	db 0			; Type
	db 0			; Limit 19:16, flags
	db 0			; Base 31:24
sys_data:
    dw 0xffff
    dw 0x0000
    dw 0x9200
    dw 0x00cf
sys_code:
    dw 0xffff
    dw 0x0000
    dw 0x9800
    dw 0x00cf
; System TSS
SYS_TSS		equ	$-gdt
gdt1:
	dw 103
	dw 0			; Set to stss
	db 0
	db 0x89			; Present, ring 0, 32-bit available TSS
	db 0
	db 0
gdt_end:

gdtr:     dw gdt_end - gdt - 1
          dd gdt
EOS
*/) {});

                testSystem.execute(assembly).done(function () {
                    // Check that TR was given the value of SYS_TSS
                    expect(system.getCPURegisters().tr.get()).to.equal(24);

                    // Check that busy bit (second bit of byte 5) was set in the TSS descriptor
                    var byte5 = system.read({
                        from: system.getCPURegisters().gdtr.base + (3 * 8) + 5,
                        size: 1
                    });
                    expect((byte5 >>> 1) & 1).to.equal(1);
                    done();
                }).fail(function (exception) {
                    done(exception);
                });
            });
        });
    });
});
