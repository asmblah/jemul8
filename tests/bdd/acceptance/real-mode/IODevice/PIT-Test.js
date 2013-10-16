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

    describe("PIT I/O device", function () {
        var counter0Lowers,
            counter0Raises,
            system,
            testSystem;

        beforeEach(function (done) {
            testSystem = new TestSystem();
            system = testSystem.getSystem();

            counter0Lowers = 0;
            counter0Raises = 0;

            system.loadPlugin({
                setupIODevices: function () {
                    return {
                        "PIT": function (pit) {
                            pit.on("counter out high", function (counter) {
                                if (counter === 0) {
                                    counter0Raises++;
                                }
                            });
                            pit.on("counter out low", function (counter) {
                                if (counter === 0) {
                                    counter0Lowers++;
                                }
                            });
                        }
                    };
                }
            });

            testSystem.stubClock();

            testSystem.init().done(function () {
                done();
            });
        });

        describe("when counter 0 is disabled", function () {
            util.each([0, 1, 10], function (afterTicks) {
                it("should not have raised counter 0's OUT after " + afterTicks + " tick(s)", function () {
                    testSystem.tickForwardBy(afterTicks);

                    expect(counter0Raises).to.be.zero;
                });

                it("should not have lowered counter 0's OUT after " + afterTicks + " tick(s)", function () {
                    testSystem.tickForwardBy(afterTicks);

                    expect(counter0Lowers).to.be.zero;
                });
            });
        });

        describe("when using mode 3 (square wave generator)", function () {
            describe("when counter 0 is enabled with a count of 10 ticks", function () {
                beforeEach(function (done) {
                    var assembly = util.heredoc(function (/*<<<EOS
; Control Word first
; - Binary counting, Mode 3, Read or Load LSB first then MSB, Channel 0 (for IRQ 0)
mov al, 110110b
out 0x43, al

; Then configure counter (10 ticks)
mov ax, 10
out 0x40, al   ; LSB
xchg ah, al
out 0x40, al   ; MSB
hlt
EOS
*/) {});

                    testSystem.execute(assembly).done(function () {
                        done();
                    }).fail(function (exception) {
                        done(exception);
                    });
                });

                it("should not have raised counter 0's OUT after 0 ticks", function () {
                    // Still tick for zero, so async events are fired
                    testSystem.tickForwardBy(0);

                    expect(counter0Raises).to.equal(0);
                });

                it("should have raised counter 0's OUT once after 1 tick", function () {
                    testSystem.tickForwardBy(1);

                    expect(counter0Raises).to.equal(1);
                });

                it("should not have lowered counter 0's OUT after 4 ticks", function () {
                    testSystem.tickForwardBy(4);

                    expect(counter0Lowers).to.equal(0);
                });

                it("should have lowered counter 0's OUT once after 5 ticks", function () {
                    testSystem.tickForwardBy(5);

                    expect(counter0Lowers).to.equal(1);
                });

                it("should still have raised counter 0's OUT only once after 9 ticks", function () {
                    testSystem.tickForwardBy(9);

                    expect(counter0Raises).to.equal(1);
                });

                it("should still have lowered counter 0's OUT only once after 9 ticks", function () {
                    testSystem.tickForwardBy(9);

                    expect(counter0Lowers).to.equal(1);
                });

                it("should have raised counter 0's OUT twice after 10 ticks", function () {
                    testSystem.tickForwardBy(10);

                    expect(counter0Raises).to.equal(2);
                });

                it("should still have lowered counter 0's OUT only once after 10 ticks", function () {
                    testSystem.tickForwardBy(10);

                    expect(counter0Lowers).to.equal(1);
                });
            });
        });
    });
});
