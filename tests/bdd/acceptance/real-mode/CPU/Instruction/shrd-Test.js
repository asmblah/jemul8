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

    describe("CPU 'shrd' (shift right with double precision) instruction", function () {
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

        util.each({
            "bx:ax >>> 4": {
                is32BitCodeSegment: false,
                dest: "ax",
                source: "bx",
                count: "4",
                registers: {
                    ax: parseInt("0101011101110101", 2),
                    bx: parseInt("1110001101001111", 2),
                },
                expectedRegisters: {
                    ax: parseInt("1111010101110111", 2),
                    bx: parseInt("1110001101001111", 2), // Source should be left unchanged

                    cf: 0 // Last bit shifted out of dest operand
                }
            },
            "bx:ax >>> 5": {
                is32BitCodeSegment: false,
                dest: "ax",
                source: "bx",
                count: "5",
                registers: {
                    ax: parseInt("0101011101110101", 2),
                    bx: parseInt("1110001101001111", 2),
                },
                expectedRegisters: {
                    ax: parseInt("0111101010111011", 2),
                    bx: parseInt("1110001101001111", 2), // Source should be left unchanged

                    cf: 1 // Last bit shifted out of dest operand
                }
            },
            "ebx:eax >>> 6": {
                is32BitCodeSegment: false,
                dest: "eax",
                source: "ebx",
                count: "6",
                registers: {
                    eax: parseInt("01010111011101010100101111001011", 2),
                    ebx: parseInt("11100011010011110100011110000111", 2),
                },
                expectedRegisters: {
                    eax: parseInt("00011101010111011101010100101111", 2),
                    ebx: parseInt("11100011010011110100011110000111", 2), // Source should be left unchanged

                    cf: 0 // Last bit shifted out of dest operand
                }
            }
        }, function (scenario, description) {
            var is32BitCodeSegment = scenario.is32BitCodeSegment;

            describe("when code segment is " + (is32BitCodeSegment ? 32 : 16) + "-bit", function () {
                describe(description, function () {
                    beforeEach(function (done) {
                        var assembly = util.heredoc(function (/*<<<EOS
org 0x100
[BITS ${bits}]
shrd ${dest}, ${source}, ${count}

hlt
EOS
*/) {}, {source: scenario.source, dest: scenario.dest, count: scenario.count, bits: is32BitCodeSegment ? 32 : 16});

                        testSystem.on("pre-run", function () {
                            registers.cs.set32BitMode(is32BitCodeSegment);
                        });

                        if (scenario.setup) {
                            scenario.setup(registers);
                        }

                        util.each(scenario.registers, function (value, register) {
                            registers[register][/f$/.test(register) ? "setBin" : "set"](value);
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

                    util.each(scenario.expectedRegisters, function (expectedValue, register) {
                        it("should set " + register + " correctly", function () {
                            expect(registers[register].get()).to.equal(expectedValue);
                        });
                    });

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
