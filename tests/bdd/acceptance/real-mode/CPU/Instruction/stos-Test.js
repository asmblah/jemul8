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

    describe("CPU 'stos' store byte/word/dword at (e)di instruction", function () {
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

        util.each((function () {
            // Ensure every combination of default and overridden operand- and address-sizes is tested
            var sizing = [];

            util.each([true, false], function (is32BitDefaultSize) {
                util.each([true, false], function (is32BitAddressSize) {
                    sizing.push({
                        is32BitDefaultSize: is32BitDefaultSize,
                        is32BitAddressSize: is32BitAddressSize
                    });
                });
            });

            return sizing;
        }()), function (sizing) {
            var prefix = "";

            if (sizing.is32BitAddressSize !== sizing.is32BitDefaultSize) {
                prefix += "a32 ";
            }

            describe("when in " + (sizing.is32BitDefaultSize ? 32 : 16) + "-bit real mode, " + (sizing.is32BitAddressSize ? 32 : 16) + "-bit address size", function () {
                util.each([
                    {
                        // Test storing one byte, no repeat prefix, (e)cx is zero (should be ignored anyway)
                        initialAddress: 0x200,
                        initialCount: 0,
                        repeatPrefix: "",
                        source: "al",
                        sourceValue: 21,
                        size: 1,
                        length: 1,
                        finalAddress: 0x200 + 1,
                        finalCount: 0
                    },
                    {
                        // Test storing one byte, no repeat prefix, (e)cx is 4 (should be ignored and not be changed)
                        initialAddress: 0x300,
                        initialCount: 4,
                        repeatPrefix: "",
                        source: "al",
                        sourceValue: 52,
                        size: 1,
                        length: 1,
                        finalAddress: 0x300 + 1,
                        finalCount: 4
                    },
                    {
                        // Test storing 5 bytes, repeat prefix, (e)cx is 5 (should be ignored and not be changed)
                        initialAddress: 0x302,
                        initialCount: 5,
                        repeatPrefix: "rep ",
                        source: "al",
                        sourceValue: 30,
                        size: 1,
                        length: 5,
                        finalAddress: 0x302 + 5,
                        finalCount: 0
                    }
                ], function (scenario) {
                    var suffix = ({1: "b", 2: "w", 4: "d"})[scenario.size];

                    describe("for 'stos" + suffix + "'", function () {
                        beforeEach(function (done) {
                            var assembly = util.heredoc(function (/*<<<EOS
org 0x100
[BITS ${bits}]
mov ${source}, ${sourceValue}
${repeatPrefix}stos${suffix}

hlt
EOS
*/) {}, {source: scenario.source, sourceValue: scenario.sourceValue, repeatPrefix: prefix + scenario.repeatPrefix, suffix: suffix, bits: sizing.is32BitDefaultSize ? 32 : 16});

                            registers[sizing.is32BitAddressSize ? "edi" : "di"].set(scenario.initialAddress);

                            registers[sizing.is32BitAddressSize ? "ecx" : "cx"].set(scenario.initialCount);

                            testSystem.on("pre-run", function () {
                                registers.cs.set32BitMode(sizing.is32BitDefaultSize);
                            });

                            testSystem.execute(assembly).done(function () {
                                done();
                            }).fail(function (exception) {
                                done(exception);
                            });
                        });

                        it("should store " + scenario.sourceValue + " " + scenario.length + " time(s) at " + util.hexify(scenario.initialAddress), function () {
                            util.from(0).to(scenario.length, function (index) {
                                expect(system.read({from: scenario.initialAddress + index * scenario.size, size: scenario.size})).to.equal(scenario.sourceValue);
                            });
                        });

                        it("should not overwrite the byte before the string", function () {
                            expect(system.read({from: scenario.initialAddress - 1, size: 1, as: "number"})).to.equal(0);
                        });

                        it("should not overwrite the byte after the string", function () {
                            expect(system.read({from: scenario.initialAddress + scenario.length * scenario.size, size: 1, as: "number"})).to.equal(0);
                        });

                        it("should leave the " + (sizing.is32BitAddressSize ? "edi" : "di") + " register with the correct value", function () {
                            expect(system.getCPURegisters()[sizing.is32BitAddressSize ? "edi" : "di"].get()).to.equal(scenario.finalAddress);
                        });

                        it("should leave the " + (sizing.is32BitAddressSize ? "ecx" : "cx") + " register with the correct value", function () {
                            expect(system.getCPURegisters()[sizing.is32BitAddressSize ? "ecx" : "cx"].get()).to.equal(scenario.finalCount);
                        });
                    });
                });
            });
        });
    });
});
