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

    describe("CPU 'cmps' (compare string) instruction", function () {
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
            "8-bit compare of single character when identical": {
                is32BitCodeSegment: false,
                size: "b",
                registers: {
                    df: 0,
                    ds: 0x800,
                    si: 0x100,
                    es: 0x900,
                    di: 0x200
                },
                memory: [{
                    to: (0x800 << 4) + 0x100,
                    data: "y"
                }, {
                    to: (0x900 << 4) + 0x200,
                    data: "y"
                }],
                expectedRegisters: {
                    ds: 0x800,
                    si: 0x101, // Source index register should have been incremented by one
                    es: 0x900,
                    di: 0x201, // Destination index register should have been incremented by one
                    zf: 1      // Characters are equal
                },
                // Ensure data is not modified
                expectedMemory: [{
                    expected: "y",
                    from: (0x800 << 4) + 0x100,
                    as: "string",
                    size: 1
                }, {
                    expected: "y",
                    from: (0x900 << 4) + 0x200,
                    as: "string",
                    size: 1
                }]
            },
            "8-bit compare of single character when result is negative": {
                is32BitCodeSegment: false,
                size: "b",
                registers: {
                    df: 0,
                    ds: 0x800,
                    si: 0x100,
                    es: 0x900,
                    di: 0x200
                },
                memory: [{
                    to: (0x800 << 4) + 0x100,
                    data: 0x26,
                    size: 1
                }, {
                    to: (0x900 << 4) + 0x200,
                    data: 0x36,
                    size: 1
                }],
                expectedRegisters: {
                    ds: 0x800,
                    si: 0x101, // Source index register should have been incremented by one
                    es: 0x900,
                    di: 0x201, // Destination index register should have been incremented by one
                    pf: util.getParity(0x26 - 0x36),
                    sf: 1,     // Result of (0x26 - 0x36) is negative
                    zf: 0      // Characters differ
                },
                // Ensure data is not modified
                expectedMemory: [{
                    expected: 0x26,
                    from: (0x800 << 4) + 0x100,
                    as: "number",
                    size: 1
                }, {
                    expected: 0x36,
                    from: (0x900 << 4) + 0x200,
                    as: "number",
                    size: 1
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
cmps${size}

hlt
EOS
*/) {}, {size: scenario.size, bits: is32BitCodeSegment ? 32 : 16});

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
