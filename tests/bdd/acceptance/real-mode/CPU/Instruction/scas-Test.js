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

    describe("CPU 'scas' (scan string) instruction", function () {
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
            "8-bit scan for single byte when identical": {
                is32BitCodeSegment: false,
                size: "b",
                registers: {
                    al: "y".charCodeAt(0),
                    df: 0,
                    es: 0x900,
                    di: 0x200
                },
                memory: [{
                    to: (0x900 << 4) + 0x200,
                    data: "y"
                }],
                expectedRegisters: {
                    al: "y".charCodeAt(0), // Accumulator should be left unchanged
                    es: 0x900,
                    di: 0x201, // Destination index register should have been incremented by one
                    sf: 0,     // Result is positive (zero)
                    zf: 1      // Characters are equal
                },
                // Ensure data is not modified
                expectedMemory: [{
                    expected: "y",
                    from: (0x900 << 4) + 0x200,
                    as: "string",
                    size: 1
                }]
            },
            "8-bit scan for single byte with #REPNE prefix": {
                is32BitCodeSegment: false,
                prefix: "repne ",
                size: "b",
                registers: {
                    al: "l".charCodeAt(0),
                    cx: 7,
                    df: 0,
                    es: 0x900,
                    di: 0x200
                },
                memory: [{
                    to: (0x900 << 4) + 0x200,
                    data: "welcome"
                }],
                expectedRegisters: {
                    al: "l".charCodeAt(0), // Accumulator should be left unchanged
                    cx: 4,
                    es: 0x900,
                    di: 0x203, // Destination index register should point to "c"
                    sf: 0,     // Result is positive (zero)
                    zf: 1      // Characters are equal
                },
                // Ensure data is not modified
                expectedMemory: [{
                    expected: "welcome",
                    from: (0x900 << 4) + 0x200,
                    as: "string",
                    size: 7
                }]
            },
            "8-bit scan for single byte with #REPNE prefix when CX is zero": {
                is32BitCodeSegment: false,
                prefix: "repne ",
                size: "b",
                registers: {
                    al: "l".charCodeAt(0),
                    cx: 0,
                    df: 0,
                    es: 0x900,
                    di: 0x200
                },
                memory: [{
                    to: (0x900 << 4) + 0x200,
                    data: "welcome"
                }],
                expectedRegisters: {
                    al: "l".charCodeAt(0), // Accumulator should be left unchanged
                    cx: 0,
                    es: 0x900,
                    di: 0x200,
                    sf: 0,     // Result is positive (zero)
                    zf: 0      // Characters are not equal, no comparison occurred
                },
                // Ensure data is not modified
                expectedMemory: [{
                    expected: "welcome",
                    from: (0x900 << 4) + 0x200,
                    as: "string",
                    size: 7
                }]
            }
        }, function (scenario, description) {
            var is32BitCodeSegment = scenario.is32BitCodeSegment;

            describe("when code segment is " + (is32BitCodeSegment ? 32 : 16) + "-bit", function () {
                describe(description, function () {
                    beforeEach(function (done) {
                        var assembly = util.heredoc(function (/*<<<EOS
org 0x100
[BITS ${bits}]
${prefix}scas${size}

hlt
EOS
*/) {}, {prefix: scenario.prefix || "", size: scenario.size, bits: is32BitCodeSegment ? 32 : 16});

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
