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

    describe("CPU 'jmpf' (jump far) instruction", function () {
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
            it("should be able to jump forward, within a few bytes", function (done) {
                var assembly = util.heredoc(function (/*<<<EOS
[BITS 16]
org 0x100
;; Implicit "jmp far"
jmp 0x0000:0x010A
mov ax, 0x1234

TIMES 0x010A-($-$$) DB 0
mov ax, 0x4321
hlt
EOS
*/) {});

                testSystem.execute(assembly).done(function () {
                    expect(system.getCPURegisters().ax.get()).to.equal(0x4321);
                    done();
                }).fail(function (exception) {
                    done(exception);
                });
            });

            it("should be able to jump backward, within a few bytes", function (done) {
                var assembly = util.heredoc(function (/*<<<EOS
[BITS 16]
org 0x100
mov ax, 0

;; Unfortunately, we have to rely on a short jump to test the backward far jump
jmp try_it
hlt ;; Just in case

TIMES 0x010A-($-$$) DB 0
mov ax, 0x3214
hlt

try_it:
;; Implicit "jmp far"
jmp 0x0000:0x010A
EOS
*/) {});

                testSystem.execute(assembly).done(function () {
                    expect(system.getCPURegisters().ax.get()).to.equal(0x3214);
                    done();
                }).fail(function (exception) {
                    done(exception);
                });
            });
        });

        describe("when under 32-bit (un)real mode", function () {
            beforeEach(function () {
                testSystem.on("pre-run", function () {
                    system.getCPURegisters().cs.set32BitMode(true);
                });
            });

            it("should be able to jump forward using a 32-bit immediate offset", function (done) {
                var assembly = util.heredoc(function (/*<<<EOS
[BITS 32]
org 0x100
;; Implicit "jmp far"
jmp 0x0000:dword 0x0001010A
mov ax, 0x1234

TIMES 0x0001010A-($-$$) DB 0
mov ax, 0x4321
hlt
EOS
*/) {});

                testSystem.execute(assembly).done(function () {
                    expect(system.getCPURegisters().ax.get()).to.equal(0x4321);
                    done();
                }).fail(function (exception) {
                    done(exception);
                });
            });

            it("should be able to jump forward using a 32-bit indirect offset", function (done) {
                var assembly = util.heredoc(function (/*<<<EOS
[BITS 32]
org 0x100

xor bx, bx
mov ds, bx
jmp far [address]
mov ax, 0x1234

TIMES 0x0000110A-($-$$) DB 0
mov ax, 0x4321
hlt

address:
dd 0x0000110A
dw 0x0000
EOS
*/) {});

                testSystem.execute(assembly).done(function () {
                    expect(system.getCPURegisters().ax.get()).to.equal(0x4321);
                    done();
                }).fail(function (exception) {
                    done(exception);
                });
            });
        });
    });
});
