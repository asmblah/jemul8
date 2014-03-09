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

    describe("CPU 'out' (write to I/O port) instruction", function () {
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

        describe("when under 16-bit real mode", function () {
            util.each([
                {
                    expectedLength: 1,
                    expectedPort: 6,
                    expectedValue: 4,
                    port: {
                        immediate: 6
                    },
                    value: {
                        al: 4
                    }
                }
            ], function (scenario, index) {
                describe("for scenario #" + index, function () {
                    var actualLength,
                        actualPort,
                        actualValue;

                    beforeEach(function (done) {
                        var assembly,
                            port,
                            value;

                        if (scenario.port.hasOwnProperty("immediate")) {
                            port = scenario.port.immediate;
                        }

                        if (scenario.value.hasOwnProperty("al")) {
                            system.getCPURegisters().al.set(scenario.value.al);

                            value = "al";
                        }

                        assembly = util.heredoc(function (/*<<<EOS
out ${port}, ${value}
hlt
EOS
*/) {}, {port: port, value: value});

                        system.one("io write", function (port, value, length) {
                            actualLength = length;
                            actualPort = port;
                            actualValue = value;
                        });

                        testSystem.execute(assembly).done(function () {
                            done();
                        }).fail(function (exception) {
                            done(exception);
                        });
                    });

                    it("should output to the correct port", function () {
                        expect(actualPort).to.equal(scenario.expectedPort);
                    });

                    it("should output the correct I/O length", function () {
                        expect(actualLength).to.equal(scenario.expectedLength);
                    });

                    it("should output the correct value", function () {
                        expect(actualValue).to.equal(scenario.expectedValue);
                    });
                });
            });
        });
    });
});
