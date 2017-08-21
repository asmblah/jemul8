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

    describe("Exception handling test", function () {
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
            it("should raise interrupt 0 on divide by zero", function (done) {
                var assembly = util.heredoc(function (/*<<<EOS
org 0x100

[BITS 16]
    xor ax, ax
    mov es, ax ;; Use the Extra Segment to point to the IVT's segment (0)
    mov [es:0 + 2], ax ;; Handler will be in segment 0
    mov ax, div0_handler ;; Handler offset within segment
    mov [es:0], ax

    ;; -- Handler installed, now trigger a divide by zero to use it --

    mov ax, 10
    mov bx, 0
    div bx
    hlt

;; Divide-by-zero exception (Interrupt 0) handler
div0_handler:
    mov dx, 1234 ;; Set a result to show we handled the exception
    hlt
EOS
*/) {});

                testSystem.execute(assembly).done(function () {
                    // Check that ISR was called correctly
                    expect(system.getCPURegisters().dx.get()).to.equal(1234);

                    // Check that AX was left untouched
                    expect(system.getCPURegisters().ax.get()).to.equal(10);
                    done();
                }).fail(function (exception) {
                    done(exception);
                });
            });
        });
    });
});
