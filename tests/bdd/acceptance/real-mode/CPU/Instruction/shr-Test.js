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

    describe("CPU 'shr' (unsigned bit shift right) instruction", function () {
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
            system.stop();
            system = null;
            testSystem = null;
        });

        // Test in both modes so we check support for operand-size override prefix
        util.each([true, false], function (is32BitCodeSegment) {
            var bits = is32BitCodeSegment ? 32 : 16,
                registers;

            describe("when code segment is " + bits + "-bit", function () {
                util.each({
                    "shift al right by immediate 1 to divide it by 2": {
                        destination: "al",
                        count: "1",
                        setup: function () {
                            registers.al.set(46);
                        },
                        expectedRegisters: {
                            al: 23
                        }
                    },
                    "shift al right by immediate 2 to divide it by 4": {
                        destination: "al",
                        count: "2",
                        setup: function () {
                            registers.al.set(20);
                        },
                        expectedRegisters: {
                            al: 5
                        }
                    },
                    "shift bl right by cl(2) to divide it by 4": {
                        destination: "bl",
                        count: "cl",
                        setup: function () {
                            registers.bl.set(40);
                            registers.cl.set(2);
                        },
                        expectedRegisters: {
                            bl: 10
                        }
                    }
                }, function (scenario, description) {
                    describe(description, function () {
                        beforeEach(function (done) {
                            var assembly = util.heredoc(function (/*<<<EOS
[BITS ${bits}]
org 0x100
shr ${destination}, ${count}
hlt
EOS
*/) {}, {bits: bits, destination: scenario.destination, count: scenario.count});

                            registers = system.getCPURegisters();

                            testSystem.on("pre-run", function () {
                                registers.cs.set32BitMode(is32BitCodeSegment);
                            });

                            scenario.setup();

                            testSystem.execute(assembly).done(function () {
                                done();
                            }).fail(function (exception) {
                                done(exception);
                            });
                        });

                        util.each(scenario.expectedRegisters, function (value, name) {
                            it("should leave the correct value in " + name, function () {
                                expect(registers[name].get()).to.equal(value);
                            });
                        });
                    });
                });
            });
        });
    });
});
