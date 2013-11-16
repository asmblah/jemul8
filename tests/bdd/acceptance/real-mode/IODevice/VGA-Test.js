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

    describe("VGA I/O device", function () {
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
            system.pause();
            system = null;
            testSystem = null;
        });

        it("should return 0xFF from the first byte of I/O-mapped VGA memory when not configured", function (done) {
            var assembly = util.heredoc(function (/*<<<EOS
org 0x100
mov bx, 0xa000
mov ds, bx
;; First byte of I/O-mapped VGA memory is @ 0xa0000
mov al, [0x0000]
hlt
EOS
*/) {});

            testSystem.execute(assembly).done(function () {
                expect(system.getCPURegisters().al.get()).to.equal(0xFF);
                done();
            }).fail(function (exception) {
                done(exception);
            });
        });
    });
});
