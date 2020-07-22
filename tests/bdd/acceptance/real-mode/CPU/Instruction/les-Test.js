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

    describe("CPU 'les' (load far pointer with ES) instruction", function () {
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
            "les di,[bx+si-46]": {
                is32BitCodeSegment: false,
                operand1: "di",
                operand2: "[bx+si-46]",
                registers: {
                    ds: 0x200,
                    bx: 0x1001,
                    si: 0x300
                },
                memory: [{
                    to: (0x200 << 4) + 0x1001 + 0x300 - 46,
                    data: 0x56781234,
                    size: 4
                }],
                expectedRegisters: {
                    ds: 0x200,
                    bx: 0x1001,
                    si: 0x300,

                    es: 0x5678,
                    di: 0x1234
                }
            },
            "les bx,[es:0x120] (use of ES for memory segment whilst also loading ES, 16-bit)": {
                is32BitCodeSegment: false,
                operand1: "bx",
                operand2: "[es:0x120]",
                registers: {
                    es: 0x200
                },
                memory: [{
                    to: (0x200 << 4) + 0x120,
                    data: 0x56781234,
                    size: 4
                }],
                expectedRegisters: {
                    es: 0x5678,
                    bx: 0x1234
                }
            },
            "les ebx,[es:0x140] (use of ES for memory segment whilst also loading ES, 32-bit)": {
                is32BitCodeSegment: false,
                operand1: "ebx",
                operand2: "[es:0x140]",
                registers: {
                    es: 0x300
                },
                memory: [{
                    to: (0x300 << 4) + 0x140,
                    data: [0x78, 0x56, 0x34, 0x12, 0xcd, 0xab]
                }],
                expectedRegisters: {
                    es: 0xabcd,
                    ebx: 0x12345678
                }
            },
            "les bx,[fs:0x120]": {
                is32BitCodeSegment: false,
                operand1: "bx",
                operand2: "[fs:0x120]",
                registers: {
                    fs: 0x200
                },
                memory: [{
                    to: (0x200 << 4) + 0x120,
                    data: 0x56781234,
                    size: 4
                }],
                expectedRegisters: {
                    fs: 0x200,

                    es: 0x5678,
                    bx: 0x1234
                }
            },
            "les ebx,[fs:0x140]": {
                is32BitCodeSegment: false,
                operand1: "ebx",
                operand2: "[fs:0x140]",
                registers: {
                    fs: 0x300
                },
                memory: [{
                    to: (0x300 << 4) + 0x140,
                    data: [0x78, 0x56, 0x34, 0x12, 0xcd, 0xab]
                }],
                expectedRegisters: {
                    fs: 0x300,

                    es: 0xabcd,
                    ebx: 0x12345678
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
les ${operand1}, ${operand2}

hlt
EOS
*/) {}, {operand1: scenario.operand1, operand2: scenario.operand2, bits: is32BitCodeSegment ? 32 : 16});

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
