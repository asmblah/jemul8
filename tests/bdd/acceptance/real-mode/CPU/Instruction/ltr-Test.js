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

    describe("CPU 'ltr' (Load Task Register) instruction", function () {
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
            it("should raise exception 6 (Undefined Opcode)", function (done) {
                var assembly = util.heredoc(function (/*<<<EOS
org 0x100

[BITS 16]
mov ax, 1234
ltr ax
EOS
*/) {});

                testSystem.getSystem().on('exception', function (vector) {
                    expect(vector).to.equal(util.UD_EXCEPTION);

                    system.stop();
                    done(); // Passed!
                });

                testSystem.execute(assembly).fail(function (exception) {
                    done(exception);
                });
            });
        });
    });
});
