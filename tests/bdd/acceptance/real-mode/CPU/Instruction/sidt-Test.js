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

    describe("CPU 'sidt' instruction", function () {
        var system,
            testSystem;

        beforeEach(function (done) {
            testSystem = new TestSystem();
            system = testSystem.getSystem();

            testSystem.init().done(function () {
                done();
            });
        });

        describe("when the operand-size attribute is 16-bit", function () {
            describe("when IDTR contains 0x00123456FABC", function () {
                beforeEach(function (done) {
                    var assembly = util.heredoc(function (/*<<<EOS
org 0x100
[BITS 16]
sidt [0x501]

hlt
EOS
*/) {});

                    system.getCPURegisters().idtr.setBase(0x00123456);
                    system.getCPURegisters().idtr.setLimit(0xFABC);

                    testSystem.execute(assembly).done(function () {
                        done();
                    }).fail(function (exception) {
                        done(exception);
                    });
                });

                it("should store the limit in the lower two bytes", function () {
                    expect(system.read({from: 0x501, size: 2})).to.equal(0xFABC);
                });

                it("should store the 24-bit base address in the third, fourth and fifth bytes", function () {
                    /*jshint bitwise: false */
                    expect(system.read({from: 0x501 + 2, size: 4}) & 0xFFFFFF).to.equal(0x123456);
                });

                it("should store 0 in the 6th byte", function () {
                    expect(system.read({from: 0x501 + 5, size: 1})).to.equal(0);
                });
            });
        });

        describe("when the operand-size attribute is 32-bit", function () {
            describe("when IDTR contains 0x12345678ABCD", function () {
                beforeEach(function (done) {
                    var assembly = util.heredoc(function (/*<<<EOS
org 0x100
[BITS 16]
o32 sidt [0x501]

hlt
EOS
*/) {});

                    system.getCPURegisters().idtr.setBase(0x12345678);
                    system.getCPURegisters().idtr.setLimit(0xABCD);

                    testSystem.execute(assembly).done(function () {
                        done();
                    }).fail(function (exception) {
                        done(exception);
                    });
                });

                it("should store the limit in the lower two bytes", function () {
                    expect(system.read({from: 0x501, size: 2})).to.equal(0xABCD);
                });

                it("should store the 32-bit base address in the third, fourth and fifth bytes", function () {
                    expect(system.read({from: 0x501 + 2, size: 4})).to.equal(0x12345678);
                });
            });
        });
    });
});
