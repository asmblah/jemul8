/**
 * jemul8 - JavaScript x86 Emulator
 * http://jemul8.com/
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*global define */
/*jshint bitwise: false */
define([
    "js/util",
    "tools/TestSystem"
], function (
    util,
    TestSystem
) {
    "use strict";

    describe("CPU 'imul' (signed multiply) instruction", function () {
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
            describe("1-operand form", function () {
                util.each([
                    {
                        al: 32,
                        operand: {register: "bl", value: 3},
                        expectedAX: 96,
                        expectedCFOF: 0
                    },
                    {
                        al: 64,
                        operand: {register: "bh", value: -2},
                        expectedAX: -128,
                        expectedCFOF: 0
                    },
                    {
                        al: -32,
                        operand: {register: "cl", value: 3},
                        expectedAX: -96,
                        expectedCFOF: 0
                    },
                    {
                        al: -16,
                        operand: {register: "ch", value: -4},
                        expectedAX: 64,
                        expectedCFOF: 0
                    },
                    {
                        al: -32,
                        operand: {register: "dl", value: 3},
                        expectedAX: -96,
                        expectedCFOF: 0
                    },
                    {
                        al: -16,
                        operand: {register: "dh", value: -4},
                        expectedAX: 64,
                        expectedCFOF: 0
                    }
                ], function (scenario) {
                    var operandName = scenario.operand.register,
                        operandValue = scenario.operand.value;

                    describe("when multiplying al(" + scenario.al + ") with " + operandName + "(" + operandValue + ")", function () {
                        beforeEach(function (done) {
                            var assembly = util.heredoc(function (/*<<<EOS
mov al, ${al}
mov ${operandName}, ${operandValue}
imul ${operandName}
hlt
EOS
*/) {}, {al: scenario.al, operandName: operandName, operandValue: operandValue});

                            testSystem.execute(assembly).done(function () {
                                done();
                            }).fail(function (exception) {
                                done(exception);
                            });
                        });

                        it("should leave " + scenario.expectedAX + " in ax", function () {
                            expect(system.getCPURegisters().ax.get()).to.equal((scenario.expectedAX & 0xFFFF) >>> 0);
                        });

                        it("should leave CF " + (scenario.expectedCFOF ? "set" : "not set"), function () {
                            expect(system.getCPURegisters().cf.get()).to.equal(scenario.expectedCFOF);
                        });

                        it("should leave OF " + (scenario.expectedCFOF ? "set" : "not set"), function () {
                            expect(system.getCPURegisters().of.get()).to.equal(scenario.expectedCFOF);
                        });
                    });
                });

                util.each([
                    {
                        ax: 32,
                        operand: {register: "bx", value: 3},
                        expectedDX: 0,
                        expectedAX: 96,
                        expectedCFOF: 0
                    },
                    {
                        ax: 64,
                        operand: {register: "cx", value: -2},
                        expectedDX: 0xFFFF, // High bits set for negative result
                        expectedAX: -128,
                        expectedCFOF: 0
                    },
                    {
                        ax: -32,
                        operand: {register: "dx", value: 3},
                        expectedDX: 0xFFFF, // High bits set for negative result
                        expectedAX: -96,
                        expectedCFOF: 0
                    },
                    // Test calculation resulting in largest signed number that fits in 16-bits
                    // all significant figures still fit in 16-bits: 01111111 11111111, so no overflow
                    {
                        ax: 0x7fff,
                        operand: {register: "dx", value: 1},
                        expectedDX: 0,
                        expectedAX: 0x7fff,
                        expectedCFOF: 0
                    },
                    // Test calculation resulting in smallest signed number that needs 17th bit
                    // 00000000 10000000 00000000 - 17th bit (0) needed to indicate positive number, so there is overflow
                    {
                        ax: 0x8000/4,
                        operand: {register: "dx", value: 4},
                        expectedDX: 0,
                        expectedAX: 0x8000,
                        expectedCFOF: 1
                    }
                ], function (scenario) {
                    var operandName = scenario.operand.register,
                        operandValue = scenario.operand.value;

                    describe("when multiplying ax(" + scenario.ax + ") with " + operandName + "(" + operandValue + ")", function () {
                        beforeEach(function (done) {
                            var assembly = util.heredoc(function (/*<<<EOS
mov ax, ${ax}
mov ${operandName}, ${operandValue}
imul ${operandName}
hlt
EOS
*/) {}, {ax: scenario.ax, operandName: operandName, operandValue: operandValue});

                            testSystem.execute(assembly).done(function () {
                                done();
                            }).fail(function (exception) {
                                done(exception);
                            });
                        });

                        it("should leave " + scenario.expectedDX + " in dx", function () {
                            expect(system.getCPURegisters().dx.get()).to.equal((scenario.expectedDX & 0xFFFF) >>> 0);
                        });

                        it("should leave " + scenario.expectedAX + " in ax", function () {
                            expect(system.getCPURegisters().ax.get()).to.equal((scenario.expectedAX & 0xFFFF) >>> 0);
                        });

                        it("should leave CF " + (scenario.expectedCFOF ? "set" : "not set"), function () {
                            expect(system.getCPURegisters().cf.get()).to.equal(scenario.expectedCFOF);
                        });

                        it("should leave OF " + (scenario.expectedCFOF ? "set" : "not set"), function () {
                            expect(system.getCPURegisters().of.get()).to.equal(scenario.expectedCFOF);
                        });
                    });
                });

                util.each([
                    {
                        eax: 32,
                        operand: {register: "ebx", value: 3},
                        expectedEDX: 0,
                        expectedEAX: 96
                    },
                    {
                        eax: 64,
                        operand: {register: "ecx", value: -2},
                        expectedEDX: 0xFFFFFFFF, // High bits set for negative result
                        expectedEAX: -128
                    },
                    {
                        eax: -32,
                        operand: {register: "edx", value: 3},
                        expectedEDX: 0xFFFFFFFF, // High bits set for negative result
                        expectedEAX: -96
                    }
                ], function (scenario) {
                    var operandName = scenario.operand.register,
                        operandValue = scenario.operand.value;

                    describe("when multiplying eax(" + scenario.eax + ") with " + operandName + "(" + operandValue + ")", function () {
                        beforeEach(function (done) {
                            var assembly = util.heredoc(function (/*<<<EOS
[BITS 16]
mov eax, ${eax}
mov ${operandName}, dword ${operandValue}
imul ${operandName}
hlt
EOS
*/) {}, {eax: scenario.eax, operandName: operandName, operandValue: operandValue});

                            testSystem.execute(assembly).done(function () {
                                done();
                            }).fail(function (exception) {
                                done(exception);
                            });
                        });

                        it("should leave " + scenario.expectedEDX + " in edx", function () {
                            expect(system.getCPURegisters().edx.get()).to.equal(scenario.expectedEDX >>> 0);
                        });

                        it("should leave " + scenario.expectedEAX + " in eax", function () {
                            expect(system.getCPURegisters().eax.get()).to.equal(scenario.expectedEAX >>> 0);
                        });
                    });
                });
            });

            describe("2-operand form", function () {
                util.each([
                    {
                        destination: {register: "ax", value: 32},
                        source: {register: "bx", value: 3},
                        expectedResult: 96,
                        expectedResultSize: 2
                    },
                    {
                        destination: {register: "cx", value: -16},
                        source: {register: "dx", value: 2},
                        expectedResult: -32,
                        expectedResultSize: 2
                    },
                    {
                        destination: {register: "ecx", value: 2000000},
                        source: {register: "edx", value: -2},
                        expectedResult: -4000000,
                        expectedResultSize: 4
                    },
                    // Test the sign-extended immediate byte form
                    {
                        destination: {register: "ax", value: 2},
                        source: {immediate: "byte -2"}, // Use byte prefix to force byte form
                        expectedResult: -4,
                        expectedResultSize: 2
                    }
                ], function (scenario) {
                    var destinationName = scenario.destination.register,
                        destinationValue = scenario.destination.value,
                        mask = util.generateMask(scenario.expectedResultSize),
                        sourceName = scenario.source.register || "immediate",
                        sourceValue = scenario.source.value || scenario.source.immediate;

                    describe("when multiplying " + destinationName + "(" + destinationValue + ") with " + sourceName + "(" + sourceValue + ")", function () {
                        beforeEach(function (done) {
                            var assembly;

                            if (sourceName === "immediate") {
                                assembly = util.heredoc(function (/*<<<EOS
mov ${destinationName}, ${destinationValue}
imul ${destinationName}, ${immediate}
hlt
EOS
*/) {}, {destinationName: destinationName, destinationValue: destinationValue, immediate: sourceValue});
                            } else {
                                assembly = util.heredoc(function (/*<<<EOS
mov ${destinationName}, ${destinationValue}
mov ${sourceName}, ${sourceValue}
imul ${destinationName}, ${sourceName}
hlt
EOS
*/) {}, {destinationName: destinationName, destinationValue: destinationValue, sourceName: sourceName, sourceValue: sourceValue});
                            }

                            testSystem.execute(assembly).done(function () {
                                done();
                            }).fail(function (exception) {
                                done(exception);
                            });
                        });

                        it("should leave " + scenario.expectedResult + " in " + destinationName, function () {
                            expect(system.getCPURegisters()[destinationName].get()).to.equal((scenario.expectedResult & mask) >>> 0);
                        });

                        if (sourceName !== "immediate") {
                            it("should not alter " + sourceName, function () {
                                expect(system.getCPURegisters()[sourceName].get()).to.equal((sourceValue & mask) >>> 0);
                            });
                        }
                    });
                });
            });

            describe("3-operand form", function () {
                util.each([
                    {
                        destination: {register: "ax", value: 32},
                        source1: {register: "bx", value: 3},
                        source2: {immediate: 1},
                        expectedResult: 3,
                        expectedResultSize: 2
                    },
                    {
                        destination: {register: "ecx", value: 32},
                        source1: {register: "edx", value: 2},
                        source2: {immediate: -23},
                        expectedResult: -46,
                        expectedResultSize: 4
                    }
                ], function (scenario) {
                    var destinationName = scenario.destination.register,
                        destinationValue = scenario.destination.value,
                        mask = util.generateMask(scenario.expectedResultSize),
                        source1Name = scenario.source1.register,
                        source1Value = scenario.source1.value,
                        source2Immediate = scenario.source2.immediate;

                    describe("when multiplying " + destinationName + "(" + destinationValue + ") with " + source1Name + "(" + source1Value + ") and immediate(" + source2Immediate + ")", function () {
                        beforeEach(function (done) {
                            var assembly = util.heredoc(function (/*<<<EOS
mov ${destinationName}, ${destinationValue}
mov ${source1Name}, ${source1Value}
imul ${destinationName}, ${source1Name}, ${source2Immediate}
hlt
EOS
*/) {}, {
                                destinationName: destinationName,
                                destinationValue: destinationValue,
                                source1Name: source1Name,
                                source1Value: source1Value,
                                source2Immediate: source2Immediate
                            });

                            testSystem.execute(assembly).done(function () {
                                done();
                            }).fail(function (exception) {
                                done(exception);
                            });
                        });

                        it("should leave " + scenario.expectedResult + " in " + destinationName, function () {
                            expect(system.getCPURegisters()[destinationName].get()).to.equal((scenario.expectedResult & mask) >>> 0);
                        });

                        it("should not alter " + source1Name, function () {
                            expect(system.getCPURegisters()[source1Name].get()).to.equal((source1Value & mask) >>> 0);
                        });
                    });
                });
            });
        });
    });
});
