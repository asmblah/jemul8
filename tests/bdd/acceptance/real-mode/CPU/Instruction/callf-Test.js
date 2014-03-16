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

    describe("CPU 'callf' (call far) instruction", function () {
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
            it("should be able to call forward, within a few bytes, direct", function (done) {
                var assembly = util.heredoc(function (/*<<<EOS
org 0x100
;; Implicit "call far"
call 0x0000:0x010A
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

            it("should be able to call forward, within a few bytes, direct, but with a different segment", function (done) {
                var assembly = util.heredoc(function (/*<<<EOS
org 0x100
;; Implicit "call far"
call 0x0092:0x0006
mov ax, 0x1234

;; This hlt should catch any issues with segment being ignored,
;; otherwise it is possible for the gulf of 0x00 bytes to execute
;; all the way up to the mov below and provide a false positive
TIMES 0x200-($-$$) DB 0
hlt

TIMES 0x0926-($-$$) DB 0
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

            it("should be able to call forward, within a few bytes, indirect", function (done) {
                var assembly = util.heredoc(function (/*<<<EOS
org 0x100
;; Implicit "call far"
call far [bx]
mov ax, 0x1234

TIMES 0x010A-($-$$) DB 0
mov ax, 0x4321
hlt
EOS
*/) {});

                system.getCPURegisters().bx.set(0x2000);
                system.write({data: 0x0000010A, to: 0x2000, size: 4});

                testSystem.execute(assembly).done(function () {
                    expect(system.getCPURegisters().ax.get()).to.equal(0x4321);
                    done();
                }).fail(function (exception) {
                    done(exception);
                });
            });

            it("should be able to call forward, within a few bytes, indirect, but with a different segment", function (done) {
                var assembly = util.heredoc(function (/*<<<EOS
org 0x100
;; Implicit "call far"
call far [bx]
mov ax, 0x1234

;; This hlt should catch any issues with segment being ignored,
;; otherwise it is possible for the gulf of 0x00 bytes to execute
;; all the way up to the mov below and provide a false positive
TIMES 0x200-($-$$) DB 0
hlt

TIMES 0x0926-($-$$) DB 0
mov ax, 0x4321
hlt
EOS
*/) {});

                system.getCPURegisters().bx.set(0x2000);
                system.write({data: 0x00920006, to: 0x2000, size: 4});

                testSystem.execute(assembly).done(function () {
                    expect(system.getCPURegisters().ax.get()).to.equal(0x4321);
                    done();
                }).fail(function (exception) {
                    done(exception);
                });
            });

            it("should be able to call backward, within a few bytes, direct", function (done) {
                var assembly = util.heredoc(function (/*<<<EOS
org 0x100
TIMES 0x010A-($-$$) DB 0
mov ax, 0x3214
hlt

TIMES 0x012A-($-$$) DB 0
;; Implicit "call far"
call 0x0000:0x010A
EOS
*/) {});

                testSystem.execute(assembly, {entrypoint: 0x012A}).done(function () {
                    expect(system.getCPURegisters().ax.get()).to.equal(0x3214);
                    done();
                }).fail(function (exception) {
                    done(exception);
                });
            });
        });
    });
});
