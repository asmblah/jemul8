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
    "js/CPU",
    "tools/TestSystem"
], function (
    util,
    CPU,
    TestSystem
) {
    "use strict";

    describe("CPU 'aad' (ASCII adjust ax before division) instruction", function () {
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
            "using default base 10, no overflow": {
                registers: {
                    al: 0x2,
                    ah: 0xb,

                    cf: 1,
                    of: 1,
                    pf: 1,
                    sf: 1,
                    zf: 1
                },
                expectedRegisters: {
                    al: 0x2 + 0xb * 10,
                    ah: 0, // Should just zero-out AH

                    cf: 0,
                    of: 0,
                    pf: util.getParity(0x2 + 0xb * 10),
                    sf: 0,
                    zf: 0
                }
            },
            "using default base 10, overflow": {
                registers: {
                    al: 0xf0,
                    ah: 0xb,

                    cf: 1,
                    of: 1,
                    pf: 1,
                    sf: 1,
                    zf: 1
                },
                expectedRegisters: {
                    al: 0xf0 + 0xb * 10,
                    ah: 0, // Should just zero-out AH

                    cf: 0,
                    of: 0,
                    pf: util.getParity(0xf0 + 0xb * 10),
                    sf: 0,
                    zf: 0
                }
            }
        }, function (scenario, description) {
            describe(description, function () {
                // Test in both modes so we check support for operand-size override prefix
                util.each([true, false], function (is32BitCodeSegment) {
                    describe("when code segment is " + (is32BitCodeSegment ? 32 : 16) + "-bit", function () {
                        var exceptionVector;

                        beforeEach(function (done) {
                            var instruction = scenario.divisor ? "db 0xd5, " + scenario.divisor : "aad",
                                assembly = util.heredoc(function (/*<<<EOS
org 0x100
[BITS ${bits}]
${instruction}

hlt
EOS
*/) {}, {instruction: instruction, bits: is32BitCodeSegment ? 32 : 16});

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

                            if (scenario.hasOwnProperty("expectedExceptionVector")) {
                                system.on("exception", function (vector) {
                                    exceptionVector = vector;
                                    system.pause();
                                });
                            }

                            testSystem.execute(assembly).done(function () {
                                done();
                            }).fail(function (exception) {
                                done(exception);
                            });
                        });

                        util.each(scenario.expectedRegisters, function (value, name) {
                            it("should leave the correct value in " + name, function () {
                                if (name === 'cf') {
                                    debugger;
                                }

                                if (/f$/.test(name)) {
                                    expect(registers[name].get()).to.equal(value);
                                } else {
                                    expect(registers[name].get()).to.equal((value & registers[name].getMask()) >>> 0);
                                }
                            });
                        });

                        if (scenario.hasOwnProperty("expectedExceptionVector")) {
                            it("should raise the expected CPU exception", function () {
                                expect(exceptionVector).to.equal(scenario.expectedExceptionVector);
                            });

                            it("should save the address of the divide instruction as the return address", function () {
                                expect(registers.ss.readSegment(registers.sp.get(), 2)).to.equal(0x100);
                                expect(registers.ss.readSegment(registers.sp.get() + 2, 2)).to.equal(0);
                            });
                        }
                    });
                });
            });
        });
    });
});
