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
            irq0Lowers,
            irq0Raises,
            system,
            testSystem;

        beforeEach(function (done) {
            testSystem = new TestSystem();
            system = testSystem.getSystem();

            counter0Lowers = 0;
            counter0Raises = 0;
            irq0Lowers = 0;
            irq0Raises = 0;

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

            system.on("irq high", function (irq) {
                if (irq === 0) {
                    irq0Raises++;
                }
            });

            system.on("irq low", function (irq) {
                if (irq === 0) {
                    irq0Lowers++;
                }
            });

            testSystem.stubClock();

            testSystem.init().done(function () {
                done();
            });
        });

        describe("when counter 0 is disabled", function () {
            util.each([0, 1, 10], function (afterTicks) {
                describe("after " + afterTicks + " tick(s)", function () {
                    beforeEach(function () {
                        testSystem.tickForwardBy(afterTicks);
                    });

                    it("should not have raised counter 0's OUT", function () {
                        expect(counter0Raises).to.be.zero;
                    });

                    it("should not have lowered counter 0's OUT", function () {
                        expect(counter0Lowers).to.be.zero;
                    });

                    it("should not have raised IRQ0", function () {
                        expect(irq0Raises).to.be.zero;
                    });

                    it("should not have lowered IRQ0", function () {
                        expect(irq0Lowers).to.be.zero;
                    });
                });
            });
        });

        describe("when counter 0 is enabled", function () {
            describe("when using mode 2 (rate generator)", function () {
                describe("with a count of 0 (65536 - equivalent to the input timer frequency, 18.2Hz)", function () {
                    beforeEach(function (done) {
                        var assembly = util.heredoc(function (/*<<<EOS
; Control Word first
; - Binary counting, Mode 2, Read or Load LSB first then MSB, Channel 0 (for IRQ 0)
mov al, 110100b
out 0x43, al

; Then configure counter (0 ticks) - 18.2Hz
mov ax, 0
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

                    describe("after 0 ticks", function () {
                        beforeEach(function () {
                            // Still tick for zero, so async events are fired
                            testSystem.tickForwardBy(0);
                        });

                        it("should not have raised counter 0's OUT", function () {
                            expect(counter0Raises).to.equal(0);
                        });

                        it("should not have raised IRQ0", function () {
                            expect(irq0Raises).to.equal(0);
                        });
                    });

                    describe("after 1 tick", function () {
                        beforeEach(function () {
                            testSystem.tickForwardBy(1);
                        });

                        it("should have raised counter 0's OUT once", function () {
                            expect(counter0Raises).to.equal(1);
                        });

                        it("should have raised IRQ0 once", function () {
                            expect(irq0Raises).to.equal(1);
                        });
                    });

                    describe("after 54 milliseconds", function () {
                        beforeEach(function () {
                            testSystem.tickForwardBy(util.millisecondsToTicks(54));
                        });

                        it("should not have lowered counter 0's OUT", function () {
                            expect(counter0Lowers).to.equal(0);
                        });

                        it("should not have lowered IRQ0", function () {
                            expect(irq0Lowers).to.equal(0);
                        });
                    });

                    describe("after 55 milliseconds", function () {
                        beforeEach(function () {
                            testSystem.tickForwardBy(util.millisecondsToTicks(55));
                        });

                        it("should have lowered counter 0's OUT once", function () {
                            expect(counter0Lowers).to.equal(1);
                        });

                        it("should have lowered IRQ0 once", function () {
                            expect(irq0Lowers).to.equal(1);
                        });
                    });
                });
            });

            describe("when using mode 3 (square wave generator)", function () {
                describe("with a count of 10 ticks", function () {
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

                    describe("after 0 ticks", function () {
                        beforeEach(function () {
                            // Still tick for zero, so async events are fired
                            testSystem.tickForwardBy(0);
                        });

                        it("should not have raised counter 0's OUT", function () {
                            expect(counter0Raises).to.equal(0);
                        });

                        it("should not have raised IRQ0", function () {
                            expect(irq0Raises).to.equal(0);
                        });
                    });

                    describe("after 1 tick", function () {
                        beforeEach(function () {
                            testSystem.tickForwardBy(1);
                        });

                        it("should have raised counter 0's OUT once", function () {
                            expect(counter0Raises).to.equal(1);
                        });

                        it("should have raised IRQ0 once", function () {
                            expect(irq0Raises).to.equal(1);
                        });
                    });

                    describe("after 4 ticks", function () {
                        beforeEach(function () {
                            testSystem.tickForwardBy(4);
                        });

                        it("should not have lowered counter 0's OUT", function () {
                            expect(counter0Lowers).to.equal(0);
                        });

                        it("should not have lowered IRQ0", function () {
                            expect(irq0Lowers).to.equal(0);
                        });
                    });

                    describe("after 5 ticks", function () {
                        beforeEach(function () {
                            testSystem.tickForwardBy(5);
                        });

                        it("should have lowered counter 0's OUT once", function () {
                            expect(counter0Lowers).to.equal(1);
                        });

                        it("should have lowered IRQ0 once", function () {
                            expect(irq0Lowers).to.equal(1);
                        });
                    });

                    describe("after 9 ticks", function () {
                        beforeEach(function () {
                            testSystem.tickForwardBy(9);
                        });

                        it("should still have raised counter 0's OUT only once", function () {
                            expect(counter0Raises).to.equal(1);
                        });

                        it("should still have raised IRQ0 only once", function () {
                            expect(irq0Raises).to.equal(1);
                        });
                    });

                    describe("after 9 ticks", function () {
                        beforeEach(function () {
                            testSystem.tickForwardBy(9);
                        });

                        it("should still have lowered counter 0's OUT only once", function () {
                            expect(counter0Lowers).to.equal(1);
                        });

                        it("should still have lowered IRQ0 only once", function () {
                            expect(irq0Lowers).to.equal(1);
                        });
                    });

                    describe("after 10 ticks", function () {
                        beforeEach(function () {
                            testSystem.tickForwardBy(10);
                        });

                        it("should have raised counter 0's OUT twice", function () {
                            expect(counter0Raises).to.equal(2);
                        });

                        it("should have raised IRQ0 twice", function () {
                            expect(irq0Raises).to.equal(2);
                        });
                    });

                    describe("after 10 ticks", function () {
                        beforeEach(function () {
                            testSystem.tickForwardBy(10);
                        });

                        it("should still have lowered counter 0's OUT only once", function () {
                            expect(counter0Lowers).to.equal(1);
                        });

                        it("should still have lowered IRQ0 only once", function () {
                            expect(irq0Lowers).to.equal(1);
                        });
                    });
                });
            });
        });
    });
});
