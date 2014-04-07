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
        /*jshint bitwise: false */
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
            },
            // Test for support for implicit SS segment when pointer involving BP is used
            {
                destination: "ebx",
                expression: "[bp]",
                memory: [{
                    to: (0x300 << 4) + 0x10,
                    data: 0x56781234,
                    size: 4
                }],
                setup: {
                    ss: 0x300,
                    bp: 0x10
                },
                expectedResult: 0x56781234
            },
            // Test support for negative displacements
            {
                // mov al, [bp-7]
                destination: "al",
                expression: "[bp - 7]",
                memory: [{
                    to: (0x300 << 4) + 10 - 7,
                    data: 0x45,
                    size: 1
                }],
                setup: {
                    ss: 0x300,
                    bp: 10
                },
                expectedResult: 0x45
            },
            {
                destination: "[esp+2]",
                expression: "dword 0xe3dbffff",
                setup: {
                    ss: 0x300,
                    esp: 10
                },
                expectedMemory: [{
                    from: (0x300 << 4) + 10 + 2,
                    size: 4,
                    expected: 0xe3dbffff
                }]
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
*/) {}, {destination: scenario.destination, expression: scenario.expression, bits: scenario.is32BitMode ? 32 : 16});

                            testSystem.on("pre-run", function () {
                                registers.cs.set32BitMode(scenario.is32BitMode);
                            });

                            util.each(scenario.setup, function (value, register) {
                                registers[register].set(value);
                            });

                            util.each(scenario.memory, function (options) {
                                system.write(options);
                            });

                            testSystem.execute(assembly).done(function () {
                                done();
                            }).fail(function (exception) {
                                done(exception);
                            });
                        });

                        if (scenario.hasOwnProperty("expectedResult")) {
                            it("should store the correct value in " + scenario.destination, function () {
                                expect(system.getCPURegisters()[scenario.destination].get()).to.equal(scenario.expectedResult);
                            });
                        }

                        util.each(scenario.expectedMemory, function (data) {
                            var expectedValue = data.expected;

                            it("should store " + util.hexify(expectedValue) + " at " + util.hexify(data.from), function () {
                                expect(system.read(data)).to.equal(expectedValue);
                            });
                        });
                    });
                });
            });
        });
    });
});
