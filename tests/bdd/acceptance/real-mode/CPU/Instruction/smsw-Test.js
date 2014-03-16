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

    describe("CPU 'smsw' (Store Machine Status Word) instruction", function () {
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
            util.each({
                "store msw in ax": {
                    expression: "ax",
                    setup: function () {
                        system.getCPURegisters().cr0.set(0x56784321);
                    },
                    expectedRegisters: {
                        ax: 0x4321,
                        // Make sure these haven't been changed
                        cr0: 0x56784321,
                        msw: 0x4321
                    }
                }
            }, function (scenario) {
                beforeEach(function (done) {
                    var assembly = util.heredoc(function (/*<<<EOS
[BITS 16]
org 0x100
smsw ${expression}
hlt
EOS
*/) {}, {expression: scenario.expression});

                    scenario.setup();

                    testSystem.execute(assembly).done(function () {
                        done();
                    }).fail(function (exception) {
                        done(exception);
                    });
                });

                util.each(scenario.expectedRegisters, function (value, name) {
                    it("should leave the correct value in " + name, function () {
                        expect(system.getCPURegisters()[name].get()).to.equal(value);
                    });
                });
            });
        });
    });
});
