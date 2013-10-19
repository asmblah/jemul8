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

        describe("when the address-size attribute of the stack segment is 16-bit", function () {
            describe("when the operand-size of the current code segment is 16-bit", function () {
                describe("when the operand-size of the current instruction is 16-bit (no override)", function () {
                    describe("when an 8-bit value is pushed", function () {
                        beforeEach(function (done) {
                            var assembly = util.heredoc(function (/*<<<EOS
mov ax, 0
mov ss, ax
mov esp, 0xc0defffd
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

                        it("should decrease SP by 2", function () {
                            expect(system.getCPURegisters().sp.get()).to.equal(0xfffd - 2);
                        });

                        it("should not change the high word of ESP", function () {
                            /*jshint bitwise: false */
                            expect(system.getCPURegisters().esp.get() >>> 16).to.equal(0xc0de);
                        });

                        it("should not change SS", function () {
                            expect(system.getCPURegisters().ss.get()).to.equal(0);
                        });

                        it("should place the pushed value on the stack in the correct place", function () {
                            expect(system.read({from: 0xfffd - 2, size: 2})).to.equal(0x12);
                        });
                    });

                    describe("when a 16-bit value is pushed", function () {
                        beforeEach(function (done) {
                            var assembly = util.heredoc(function (/*<<<EOS
mov ax, 0
mov ss, ax
mov esp, 0xc0defffd
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

                        it("should decrease SP by 2", function () {
                            expect(system.getCPURegisters().sp.get()).to.equal(0xfffb);
                        });

                        it("should not change the high word of ESP", function () {
                            /*jshint bitwise: false */
                            expect(system.getCPURegisters().esp.get() >>> 16).to.equal(0xc0de);
                        });

                        it("should not change SS", function () {
                            expect(system.getCPURegisters().ss.get()).to.equal(0);
                        });

                        it("should place the pushed value on the stack in the correct place", function () {
                            expect(system.read({from: 0xfffd - 2, size: 2})).to.equal(0x1234);
                        });
                    });
                });

                describe("when the operand-size of the current instruction is 32-bit (with override)", function () {
                    describe("when an 8-bit value is pushed", function () {
                        beforeEach(function (done) {
                            var assembly = util.heredoc(function (/*<<<EOS
mov ax, 0
mov ss, ax
mov esp, 0xc0defffd
;; Push an 8-bit value: it should be zero-extended to 32-bit
o32 push 0x12
hlt
EOS
*/) {});

                            testSystem.execute(assembly).done(function () {
                                done();
                            }).fail(function (exception) {
                                done(exception);
                            });
                        });

                        it("should decrease SP by 4", function () {
                            expect(system.getCPURegisters().sp.get()).to.equal(0xfffd - 4);
                        });

                        it("should not change the high word of ESP", function () {
                            /*jshint bitwise: false */
                            expect(system.getCPURegisters().esp.get() >>> 16).to.equal(0xc0de);
                        });

                        it("should not change SS", function () {
                            expect(system.getCPURegisters().ss.get()).to.equal(0);
                        });

                        it("should place the pushed value on the stack in the correct place", function () {
                            expect(system.read({from: 0xfffd - 4, size: 2})).to.equal(0x12);
                        });
                    });

                    describe("when a 16-bit value is pushed", function () {
                        beforeEach(function (done) {
                            var assembly = util.heredoc(function (/*<<<EOS
mov ax, 0
mov ss, ax
mov esp, 0xc0defffd
;; 16-bit value cannot be immediate
mov ax, 0x1234
o32 push ax
hlt
EOS
*/) {});

                            testSystem.execute(assembly).done(function () {
                                done();
                            }).fail(function (exception) {
                                done(exception);
                            });
                        });

                        it("should decrease SP by 4", function () {
                            expect(system.getCPURegisters().sp.get()).to.equal(0xfffd - 4);
                        });

                        it("should not change the high word of ESP", function () {
                            /*jshint bitwise: false */
                            expect(system.getCPURegisters().esp.get() >>> 16).to.equal(0xc0de);
                        });

                        it("should not change SS", function () {
                            expect(system.getCPURegisters().ss.get()).to.equal(0);
                        });

                        it("should place the pushed value on the stack in the correct place", function () {
                            expect(system.read({from: 0xfffd - 4, size: 2})).to.equal(0x1234);
                        });
                    });
                });
            });
        });
    });
});
