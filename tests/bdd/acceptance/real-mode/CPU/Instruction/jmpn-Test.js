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

    describe("CPU 'jmpn' (jump near) instruction", function () {
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
            it("should be able to jump backward, absolute indirect", function (done) {
                var assembly = util.heredoc(function (/*<<<EOS
[BITS 16]
org 0x100
mov ax, 0

;; Unfortunately, we have to rely on a short jump to test the backward near jump
jmp try_it
hlt ;; Just in case

TIMES 0x010A-($-$$) DB 0
mov ax, 0x3214
hlt

try_it:
mov ax, 0x010A
jmp near ax
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
    });
});
