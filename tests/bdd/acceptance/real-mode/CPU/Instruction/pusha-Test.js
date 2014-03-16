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

    describe("CPU 'pusha' instruction", function () {
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

        describe("when the address-size attribute of the stack segment is 16-bit", function () {
            beforeEach(function (done) {
                var assembly = util.heredoc(function (/*<<<EOS
mov ax, 0
mov ss, ax
;; Set high word of ESP so we can test that it is ignored in 16-bit mode
mov esp, 0xc0defffd

mov eax, 0x09871234
mov ecx, 0x98762345
mov edx, 0x87653456
mov ebx, 0x76544567
;; Skip ESP
mov ebp, 0x54326789
mov esi, 0x43217890
mov edi, 0x32108901

hlt
EOS
*/) {});

                testSystem.execute(assembly).done(function () {
                    done();
                }).fail(function (exception) {
                    done(exception);
                });
            });

            describe("when the operand-size of the current code segment is 16-bit", function () {
                describe("when the operand-size of the current instruction is 16-bit (no override)", function () {
                    beforeEach(function (done) {
                        var assembly = util.heredoc(function (/*<<<EOS
pusha
hlt
EOS
*/) {});

                        testSystem.execute(assembly).done(function () {
                            done();
                        }).fail(function (exception) {
                            done(exception);
                        });
                    });

                    it("should decrease SP by 16", function () {
                        expect(system.getCPURegisters().sp.get()).to.equal(0xfffd - 16);
                    });

                    it("should not change the high word of ESP", function () {
                        /*jshint bitwise: false */
                        expect(system.getCPURegisters().esp.get() >>> 16).to.equal(0xc0de);
                    });

                    it("should not change SS", function () {
                        expect(system.getCPURegisters().ss.get()).to.equal(0);
                    });

                    it("should place the value of AX on the stack in the correct place", function () {
                        expect(system.read({from: 0xfffd - 2, size: 2})).to.equal(0x1234);
                    });

                    it("should place the value of CX on the stack in the correct place", function () {
                        expect(system.read({from: 0xfffd - 4, size: 2})).to.equal(0x2345);
                    });

                    it("should place the value of DX on the stack in the correct place", function () {
                        expect(system.read({from: 0xfffd - 6, size: 2})).to.equal(0x3456);
                    });

                    it("should place the value of BX on the stack in the correct place", function () {
                        expect(system.read({from: 0xfffd - 8, size: 2})).to.equal(0x4567);
                    });

                    it("should place the value of SP as it was before the instruction on the stack in the correct place", function () {
                        expect(system.read({from: 0xfffd - 10, size: 2})).to.equal(0xfffd);
                    });

                    it("should place the value of BP on the stack in the correct place", function () {
                        expect(system.read({from: 0xfffd - 12, size: 2})).to.equal(0x6789);
                    });

                    it("should place the value of SI on the stack in the correct place", function () {
                        expect(system.read({from: 0xfffd - 14, size: 2})).to.equal(0x7890);
                    });

                    it("should place the value of DI on the stack in the correct place", function () {
                        expect(system.read({from: 0xfffd - 16, size: 2})).to.equal(0x8901);
                    });
                });

                describe("when the operand-size of the current instruction is 32-bit (with override)", function () {
                    beforeEach(function (done) {
                        var assembly = util.heredoc(function (/*<<<EOS
o32 pusha
hlt
EOS
*/) {});

                        testSystem.execute(assembly).done(function () {
                            done();
                        }).fail(function (exception) {
                            done(exception);
                        });
                    });

                    it("should decrease ESP by 32", function () {
                        expect(system.getCPURegisters().esp.get()).to.equal(0xc0defffd - 32);
                    });

                    it("should not change SS", function () {
                        expect(system.getCPURegisters().ss.get()).to.equal(0);
                    });

                    it("should place the value of EAX on the stack in the correct place", function () {
                        expect(system.read({from: 0xfffd - 4, size: 4})).to.equal(0x09871234);
                    });

                    it("should place the value of CX on the stack in the correct place", function () {
                        expect(system.read({from: 0xfffd - 8, size: 4})).to.equal(0x98762345);
                    });

                    it("should place the value of DX on the stack in the correct place", function () {
                        expect(system.read({from: 0xfffd - 12, size: 4})).to.equal(0x87653456);
                    });

                    it("should place the value of BX on the stack in the correct place", function () {
                        expect(system.read({from: 0xfffd - 16, size: 4})).to.equal(0x76544567);
                    });

                    it("should place the value of ESP as it was before the instruction on the stack in the correct place", function () {
                        expect(system.read({from: 0xfffd - 20, size: 4})).to.equal(0xc0defffd);
                    });

                    it("should place the value of BP on the stack in the correct place", function () {
                        expect(system.read({from: 0xfffd - 24, size: 4})).to.equal(0x54326789);
                    });

                    it("should place the value of SI on the stack in the correct place", function () {
                        expect(system.read({from: 0xfffd - 28, size: 4})).to.equal(0x43217890);
                    });

                    it("should place the value of DI on the stack in the correct place", function () {
                        expect(system.read({from: 0xfffd - 32, size: 4})).to.equal(0x32108901);
                    });
                });
            });
        });
    });
});
