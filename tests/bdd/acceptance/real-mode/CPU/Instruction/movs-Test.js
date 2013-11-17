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

    describe("CPU 'movs' instruction", function () {
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

        describe("when using the #REP prefix to repeat while (E)CX > 0", function () {
            util.each([
                // 16-bit address size
                {
                    operandSize: 8,
                    addressSize: 16,
                    string: "hello world!",
                    quantums: 12,
                    from: 0x300,
                    to: 0x500,
                    expectedSI: 0x300 + 12,
                    expectedDI: 0x500 + 12
                },
                {
                    operandSize: 16,
                    addressSize: 16,
                    string: "hello again!",
                    quantums: 6,
                    from: 0x300,
                    to: 0x500,
                    expectedSI: 0x300 + 12,
                    expectedDI: 0x500 + 12
                },
                {
                    operandSize: 32,
                    addressSize: 16,
                    string: "greetings..!",
                    quantums: 3,
                    from: 0x300,
                    to: 0x500,
                    expectedSI: 0x300 + 12,
                    expectedDI: 0x500 + 12
                },

                // 32-bit address size
                {
                    operandSize: 8,
                    addressSize: 32,
                    string: "hello!",
                    quantums: 6,
                    from: 0x280000,
                    to: 0x290000,
                    expectedSI: 0x280000 + 6,
                    expectedDI: 0x290000 + 6
                },
            ], function (scenario) {
                var description = "when the operand-size attribute is " + scenario.operandSize + "-bit " +
                        "and the address-size attribute is " + scenario.addressSize + "-bit " +
                        "and '" + scenario.string + "' is in memory at " + util.hexify(scenario.from),
                    prefix = (scenario.addressSize === 32 ? "a32 " : "a16 "),
                    register32 = scenario.addressSize === 32 ? "e" : "",
                    suffix = {8: "b", 16: "w", 32: "d"}[scenario.operandSize];

                describe(description, function () {
                    beforeEach(function (done) {
                        var assembly = util.heredoc(function (/*<<<EOS
org 0x100
[BITS 16]
cld
mov ${register32}si, ${from}
mov ${register32}di, ${to}
mov ${register32}cx, ${quantums}
${prefix}rep movs${suffix}

hlt
EOS
*/) {}, {prefix: prefix, register32: register32, quantums: scenario.quantums, from: scenario.from, to: scenario.to, suffix: suffix});

                        // Allow access to high memory even though we are in real mode
                        system.getCPURegisters().cs.setLimit(0xffffffff);
                        system.getCPURegisters().ds.setLimit(0xffffffff);
                        system.getCPURegisters().es.setLimit(0xffffffff);

                        system.write({data: scenario.string, to: scenario.from});

                        testSystem.execute(assembly).done(function () {
                            done();
                        }).fail(function (exception) {
                            done(exception);
                        });
                    });

                    it("should copy the string to " + util.hexify(scenario.to), function () {
                        expect(system.read({from: scenario.to, size: scenario.string.length, as: "string"})).to.equal(scenario.string);
                    });

                    it("should not overwrite the byte before the string", function () {
                        expect(system.read({from: scenario.to - 1, size: 1, as: "number"})).to.equal(0);
                    });

                    it("should not overwrite the byte after the string", function () {
                        expect(system.read({from: scenario.to + scenario.string.length, size: 1, as: "number"})).to.equal(0);
                    });

                    it("should leave the " + register32 + "si register with the correct value", function () {
                        expect(system.getCPURegisters()[scenario.addressSize === 32 ? "esi" : "si"].get()).to.equal(scenario.expectedSI);
                    });

                    it("should leave the " + register32 + "di register with the correct value", function () {
                        expect(system.getCPURegisters()[scenario.addressSize === 32 ? "edi" : "di"].get()).to.equal(scenario.expectedDI);
                    });

                    it("should leave the " + register32 + "cx register with the correct value", function () {
                        expect(system.getCPURegisters()[scenario.addressSize === 32 ? "ecx" : "cx"].get()).to.equal(0);
                    });
                });
            });
        });
    });
});
