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
    "js/IODevice/PIT/Counter",
    "js/System",
    "js/Timer"
], function (
    util,
    Counter,
    System,
    Timer
) {
    "use strict";

    describe("PIT Counter", function () {
        var counter,
            system,
            timer;

        beforeEach(function () {
            system = sinon.createStubInstance(System);
            timer = sinon.createStubInstance(Timer);

            counter = new Counter(system, timer);
        });

        describe("receiveHalfCount()", function () {
            util.each({
                "count of 0x3456 for mode READ_LOAD_LSB_ONLY": {
                    count: 0x3456,
                    readLoadMode: Counter.READ_LOAD_LSB_ONLY,
                    expectedHalfCount: 0x56
                },
                "count of 0x3456 for mode READ_LOAD_MSB_ONLY": {
                    count: 0x7890,
                    readLoadMode: Counter.READ_LOAD_MSB_ONLY,
                    expectedHalfCount: 0x78
                }
            }, function (scenario, description) {
                describe(description, function () {
                    beforeEach(function () {
                        counter.configure(Counter.BINARY_MODE, Counter.RATE_GENERATOR, scenario.readLoadMode);
                        counter.setCount(scenario.count);
                    });

                    it("should return " + scenario.expectedHalfCount + " on first read", function () {
                        expect(counter.receiveHalfCount()).to.equal(scenario.expectedHalfCount);
                    });

                    it("should also return " + scenario.expectedHalfCount + " on second read", function () {
                        counter.receiveHalfCount(); // First read

                        expect(counter.receiveHalfCount()).to.equal(scenario.expectedHalfCount);
                    });
                });
            });

            describe("when the count has not been latched", function () {
                beforeEach(function () {
                    counter.setCount(0x4567);
                    counter.configure(0, 0, Counter.READ_LOAD_LSB_THEN_MSB);
                });

                it("should return the low byte of the count first before the count changes", function () {
                    expect(counter.receiveHalfCount()).to.equal(0x67);
                });

                it("should return the high byte of the modified count second after the count changes", function () {
                    counter.receiveHalfCount();

                    counter.setCount(0x1234); // Modify count to ensure returned MSB is different

                    expect(counter.receiveHalfCount()).to.equal(0x12);
                });
            });

            describe("after the count has been latched, then the count changes", function () {
                beforeEach(function () {
                    counter.setCount(0x4567);
                    counter.configure(0, 0, Counter.READ_LOAD_LATCH_COUNT);
                    counter.setCount(0x1234); // Modify count to ensure latched value is returned
                });

                it("should return the low byte of the latched count first", function () {
                    expect(counter.receiveHalfCount()).to.equal(0x67);
                });

                it("should return the high byte of the latched count second", function () {
                    counter.receiveHalfCount();

                    expect(counter.receiveHalfCount()).to.equal(0x45);
                });
            });
        });
    });
});
