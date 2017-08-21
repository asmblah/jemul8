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

    describe("CPU 'jb' (jump if below, unsigned) instruction", function () {
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
            it("should not jump when the left operand was greater", function (done) {
                var assembly = util.heredoc(function (/*<<<EOS
org 0x100

mov dx, 7
cmp dx, 3

jb below
mov ax, 0x1234
hlt

below:
mov ax, 0x4321
hlt

EOS
*/) {});

                testSystem.execute(assembly).done(function () {
                    expect(system.getCPURegisters().ax.get()).to.equal(0x1234);
                    done();
                }).fail(function (exception) {
                    done(exception);
                });
            });

            it("should not jump when the left operand was equal", function (done) {
                var assembly = util.heredoc(function (/*<<<EOS
org 0x100

mov dx, 3
cmp dx, 3

jb below
mov ax, 0x1234
hlt

below:
mov ax, 0x4321
hlt

EOS
*/) {});

                testSystem.execute(assembly).done(function () {
                    expect(system.getCPURegisters().ax.get()).to.equal(0x1234);
                    done();
                }).fail(function (exception) {
                    done(exception);
                });
            });

            it("should jump when the left operand was smaller", function (done) {
                var assembly = util.heredoc(function (/*<<<EOS
org 0x100

mov dx, 2
cmp dx, 3

jb below
mov ax, 0x1234
hlt

below:
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

            it('should not jump when the left operand was greater but if signed would be less', function (done) {
                var assembly = util.heredoc(function (/*<<<EOS
org 0x100

mov dx, 0xfffe
cmp dx, 3

jb below
mov ax, 0x1234
hlt

below:
mov ax, 0x4321
hlt

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
