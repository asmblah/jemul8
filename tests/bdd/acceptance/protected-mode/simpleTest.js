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

    describe("Simple protected mode test", function () {
        var system,
            testSystem;

        beforeEach(function (done) {
            testSystem = new TestSystem();
            system = testSystem.getSystem();

            testSystem.init().done(function () {
                done();
            });
        });

        describe("when under 32-bit protected mode", function () {
            // Based on http://f.osdev.org/viewtopic.php?f=1&t=20588
            it("should correctly enter protected mode and load AX with 0x1234", function (done) {
                var assembly = util.heredoc(function (/*<<<EOS
org 0x100

;; Real mode startup
[BITS 16]
xor ax, ax
mov ds, ax
mov es, ax
mov ss, ax
mov sp, 0x100

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

;; Store result in AX
mov ax, 0x1234

;; Finish
hang:
hlt
jmp hang

;; GDT
gdt:      dw  0x0000, 0x0000, 0x0000, 0x0000
sys_data: dw  0xFFFF, 0x0000, 0x9200, 0x00CF
sys_code: dw  0xFFFF, 0x0000, 0x9800, 0x00CF
gdt_end:

gdtr:     dw gdt_end - gdt - 1
          dd gdt
EOS
*/) {});

                testSystem.execute(assembly).done(function () {
                    expect(system.getCPURegisters().ax.get()).to.equal(0x1234);
                    done();
                }).fail(function (exception) {
                    done(exception);
                });
            });
        });
    });
});
