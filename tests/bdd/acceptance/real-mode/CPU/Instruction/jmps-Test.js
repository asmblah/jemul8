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

    describe("CPU 'jmps' (jump short) instruction", function () {
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

        describe("when under 16-bit real mode", function () {
            it("should be able to jump forward, within a few bytes", function (done) {
                var assembly = util.heredoc(function (/*<<<EOS
jmp short set_value
mov ax, 0x1234
set_value:
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

            it("should be able to jump backward, within a few bytes", function (done) {
                var assembly = util.heredoc(function (/*<<<EOS
mov ax, 0
increment_one:
inc ax
cmp ax, 4
je done
jmp short increment_one
done:
hlt
EOS
*/) {});

                testSystem.execute(assembly).done(function () {
                    expect(system.getCPURegisters().ax.get()).to.equal(4);
                    done();
                }).fail(function (exception) {
                    done(exception);
                });
            });
        });
    });
});
