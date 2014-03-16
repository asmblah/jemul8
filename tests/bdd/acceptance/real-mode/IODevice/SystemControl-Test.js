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

    describe("SystemControl I/O device", function () {
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

        describe("read from port 0x92", function () {
            it("should return a value with bit 1 set when A20 address line is enabled", function (done) {
                var assembly = util.heredoc(function (/*<<<EOS
mov dx, 0x92
in al, dx
hlt
EOS
*/) {});
                // Enable the A20 address line
                system.setEnableA20(true);

                testSystem.execute(assembly).done(function () {
                    /*jshint bitwise: false */
                    expect((system.getCPURegisters().al.get() >> 1) & 1).to.equal(1);
                    done();
                }).fail(function (exception) {
                    done(exception);
                });
            });

            it("should return a value with bit 1 clear when A20 address line is disabled", function (done) {
                var assembly = util.heredoc(function (/*<<<EOS
mov dx, 0x92
in al, dx
hlt
EOS
*/) {});
                // Disable the A20 address line
                system.setEnableA20(false);

                testSystem.execute(assembly).done(function () {
                    /*jshint bitwise: false */
                    expect((system.getCPURegisters().al.get() >> 1) & 1).to.equal(0);
                    done();
                }).fail(function (exception) {
                    done(exception);
                });
            });
        });

        describe("write to port 0x92", function () {
            it("should enable A20 address line when bit 1 is set", function (done) {
                var assembly = util.heredoc(function (/*<<<EOS
mov dx, 0x92
mov al, 2
out dx, al
hlt
EOS
*/) {});
                // First disable the A20 address line so we can check it was enabled
                system.setEnableA20(false);

                testSystem.execute(assembly).done(function () {
                    expect(system.isA20Enabled()).to.be.true;
                    done();
                }).fail(function (exception) {
                    done(exception);
                });
            });

            it("should disable A20 address line when bit 1 is clear", function (done) {
                var assembly = util.heredoc(function (/*<<<EOS
mov dx, 0x92
mov al, 0
out dx, al
hlt
EOS
*/) {});
                // First enable the A20 address line so we can check it was disabled
                system.setEnableA20(true);

                testSystem.execute(assembly).done(function () {
                    expect(system.isA20Enabled()).to.be.false;
                    done();
                }).fail(function (exception) {
                    done(exception);
                });
            });
        });
    });
});
