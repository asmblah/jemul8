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

    describe("SIB (Scale/Index/Base) byte test", function () {
        var system,
            testSystem;

        beforeEach(function (done) {
            testSystem = new TestSystem();
            system = testSystem.getSystem();

            testSystem.init().done(function () {
                done();
            });
        });

        describe("when under 16-bit real mode", function () {
            it("should be able to perform a complex calculation using LEA with no displacement", function (done) {
                var assembly = util.heredoc(function (/*<<<EOS
org 0x100

[BITS 16]
mov ebx, 10
mov esi, 20
lea ax, [ebx * 4 + esi]
hlt
EOS
*/) {});

                testSystem.execute(assembly).done(function () {
                    expect(system.getCPURegisters().ax.get()).to.equal(10 * 4 + 20);
                    done();
                }).fail(function (exception) {
                    done(exception);
                });
            });

            it("should be able to perform a complex calculation using LEA with a displacement", function (done) {
                var assembly = util.heredoc(function (/*<<<EOS
org 0x100

[BITS 16]
mov ebx, 10
mov esi, 20
lea dx, [ebx * 8 + esi + 32]
hlt
EOS
*/) {});

                testSystem.execute(assembly).done(function () {
                    expect(system.getCPURegisters().dx.get()).to.equal(10 * 8 + 20 + 32);
                    done();
                }).fail(function (exception) {
                    done(exception);
                });
            });
        });
    });
});
