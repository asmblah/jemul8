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

    describe("CPU 'mov' instruction", function () {
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

        util.each([
            {
                destination: "eax",
                expression: "ebx",
                setup: {
                    ebx: 12341234
                },
                expectedResult: 12341234
            },
            {
                destination: "ax",
                expression: "-1",
                expectedResult: 0xFFFF
            }
        ], function (scenario) {
            var setupSummary = JSON.stringify(scenario.setup || "<no setup>").replace(/^\{|\}$/g, "");

            // Test in both modes so we check support for operand-size override prefix
            util.each([true, false], function (is32BitCodeSegment) {
                describe("when code segment is " + (is32BitCodeSegment ? 32 : 16) + "-bit", function () {
                    describe("for 'mov " + scenario.destination + ", " + scenario.expression + "' with " + setupSummary, function () {
                        beforeEach(function (done) {
                            var assembly = util.heredoc(function (/*<<<EOS
org 0x100
[BITS ${bits}]
mov ${destination}, ${expression}

hlt
EOS
*/) {}, {destination: scenario.destination, expression: scenario.expression, bits: scenario.is32BitMode ? 32 : 16}),
                                registers = system.getCPURegisters();

                            testSystem.on("pre-run", function () {
                                registers.cs.set32BitMode(scenario.is32BitMode);
                            });

                            util.each(scenario.setup, function (value, register) {
                                registers[register].set(value);
                            });

                            testSystem.execute(assembly).done(function () {
                                done();
                            }).fail(function (exception) {
                                done(exception);
                            });
                        });

                        it("should store the correct value in " + scenario.destination, function () {
                            expect(system.getCPURegisters()[scenario.destination].get()).to.equal(scenario.expectedResult);
                        });
                    });
                });
            });
        });
    });
});
