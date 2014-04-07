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

    describe("CPU 'lea' instruction", function () {
        var registers,
            system,
            testSystem;

        beforeEach(function (done) {
            testSystem = new TestSystem();
            system = testSystem.getSystem();
            registers = system.getCPURegisters();

            testSystem.init().done(function () {
                done();
            });
        });

        afterEach(function () {
            system.stop();
            registers = null;
            system = null;
            testSystem = null;
        });

        util.each([
            {
                is32BitMode: false,
                destination: "eax",
                expression: "[ebp]",
                setup: {
                    ebp: 12341234
                },
                expectedResult: 12341234
            },
            {
                is32BitMode: false,
                destination: "eax",
                expression: "[ebp+2]",
                setup: {
                    ebp: 89898989
                },
                expectedResult: 89898989 + 2
            },
            {
                is32BitMode: false,
                destination: "eax",
                expression: "[edx+ebp+2]",
                setup: {
                    ebp: 10241024,
                    edx: 4
                },
                expectedResult: 4 + 10241024 + 2
            },
            {
                is32BitMode: true,
                destination: "eax",
                expression: "[edx+ebp+16]",
                setup: {
                    ebp: 12341234,
                    edx: 82
                },
                expectedResult: 82 + 12341234 + 16
            }
        ], function (scenario) {
            describe("for 'lea " + scenario.destination + ", " + scenario.expression + "'", function () {
                beforeEach(function (done) {
                    var assembly = util.heredoc(function (/*<<<EOS
org 0x100
[BITS ${bits}]
lea ${destination}, ${expression}

hlt
EOS
*/) {}, {destination: scenario.destination, expression: scenario.expression, bits: scenario.is32BitMode ? 32 : 16});

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
