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

        describe("when an 8-bit value is pushed", function () {
            beforeEach(function (done) {
                var assembly = util.heredoc(function (/*<<<EOS
mov ax, 0
mov ss, ax
mov esp, 0xfffd
;; Push an 8-bit value: it should be zero-extended to 16-bit
push 0x12
hlt
EOS
*/) {});

                testSystem.execute(assembly).done(function () {
                    done();
                }).fail(function (exception) {
                    done(exception);
                });
            });

            it("should decrease (E)SP by 2", function () {
                expect(system.getCPURegisters().esp.get()).to.equal(0xfffb);
            });

            it("should not change SS", function () {
                expect(system.getCPURegisters().ss.get()).to.equal(0);
            });
        });

        describe("when an 16-bit value is pushed", function () {
            beforeEach(function (done) {
                var assembly = util.heredoc(function (/*<<<EOS
mov ax, 0
mov ss, ax
mov esp, 0xfffd
;; 16-bit value cannot be immediate
mov ax, 0x1234
push ax
hlt
EOS
*/) {});

                testSystem.execute(assembly).done(function () {
                    done();
                }).fail(function (exception) {
                    done(exception);
                });
            });

            it("should decrease (E)SP by 2", function () {
                expect(system.getCPURegisters().esp.get()).to.equal(0xfffb);
            });

            it("should not change SS", function () {
                expect(system.getCPURegisters().ss.get()).to.equal(0);
            });
        });
    });
});
