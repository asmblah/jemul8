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

    describe("CPU 'movzx' move with zero-extend instruction", function () {
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

        util.each([false, true], function (is32BitMode) {
            describe("when in " + (is32BitMode ? 32 : 16) + "-bit real mode", function () {
                /*jshint bitwise: false */
                util.each([
                    // Register to register
                    {
                        // Test extending low byte of register into high byte of low word of same register
                        destination: "ax",
                        source: "al",
                        sourceValue: 123,
                        expectedResult: 123
                    },
                    {
                        // Test extending low byte of register into all 4 bytes of another register
                        destination: "ebx",
                        source: "al",
                        sourceValue: 200,
                        expectedResult: 200
                    },
                    {
                        // Test zero-extending signed byte value into word
                        destination: "dx",
                        source: "bl",
                        sourceValue: -22,
                        expectedResult: (-22 >>> 0) & 0xff
                    },
                    {
                        // Test zero-extending signed word value into dword
                        destination: "edx",
                        source: "bx",
                        sourceValue: -1234,
                        expectedResult: (-1234 >>> 0) & 0xffff
                    },

                    // Memory to register
                    {
                        // Test zero-extending signed byte value into word
                        destination: "dx",
                        source: "byte [0x202]",
                        sourceValue: -22,
                        expectedResult: (-22 >>> 0) & 0xff
                    },
                    {
                        // Test zero-extending signed byte value into dword
                        destination: "ecx",
                        source: "byte [0x300]",
                        sourceValue: -50,
                        expectedResult: (-50 >>> 0) & 0xff
                    },
                    {
                        // Test zero-extending signed word value into dword
                        destination: "edx",
                        source: "word [0x200]",
                        sourceValue: -1234,
                        expectedResult: (-1234 >>> 0) & 0xffff
                    }
                ], function (scenario) {
                    describe("for 'movzx " + scenario.destination + ", " + scenario.source + "'", function () {
                        beforeEach(function (done) {
                            var assembly = util.heredoc(function (/*<<<EOS
org 0x100
[BITS ${bits}]
mov ${source}, ${sourceValue}
movzx ${destination}, ${source}

hlt
EOS
*/) {}, {destination: scenario.destination, source: scenario.source, sourceValue: scenario.sourceValue, bits: is32BitMode ? 32 : 16});

                            testSystem.on("pre-run", function () {
                                registers.cs.set32BitMode(is32BitMode);
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
