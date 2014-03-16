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

    describe("CPU 'lmsw' (Load Machine Status Word) instruction", function () {
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
                "store ax in msw": {
                    expression: "ax",
                    setup: function () {
                        // Set CR0 to a known value first so we can check the load works
                        // - make sure bit 0 (PE) is not set otherwise we will switch to protected mode
                        system.getCPURegisters().cr0.set(0x1234BCDE);
                        system.getCPURegisters().ax.set(0x5678);
                    },
                    // Only the low-order 4 bits are loaded into CR0
                    expectedCR0: 0x1234BCD8,
                    expectedMSW: 0xBCD8
                }
            }, function (scenario) {
                beforeEach(function (done) {
                    var assembly = util.heredoc(function (/*<<<EOS
[BITS 16]
org 0x100
lmsw ${expression}
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

                it("should leave the correct value in cr0", function () {
                    expect(system.getCPURegisters().cr0.get()).to.equal(scenario.expectedCR0);
                });

                it("should leave the correct value in msw", function () {
                    expect(system.getCPURegisters().msw.get()).to.equal(scenario.expectedMSW);
                });
            });
        });
    });
});
