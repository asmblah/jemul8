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

        afterEach(function () {
            system.pause();
            system = null;
            testSystem = null;
        });

        describe("when counter 0 is disabled", function () {
            beforeEach(function (done) {
                var assembly = util.heredoc(function (/*<<<EOS
hang:
hlt
jmp hang
EOS
*/) {});

                testSystem.execute(assembly).done(function () {
                    done();
                }).fail(function (exception) {
                    done(exception);
                });
            });

            util.each([0, 1, 10], function (afterTicks) {
                describe("after " + afterTicks + " tick(s)", function () {
                    beforeEach(function (done) {
                        testSystem.tickForwardBy(afterTicks).done(done);
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
org 0x0100

%define PORT_PIC1_CMD   0x0020
%define PORT_PIC1_DATA  0x0021
%define PORT_PIC2_CMD   0x00a0
%define PORT_PIC2_DATA  0x00a1

;; Installs a pointer to an ISR in the IVT
%macro SET_INT_VECTOR 3
  mov ax, %3
  mov [%1*4], ax
  mov ax, %2
  mov [%1*4+2], ax
%endmacro

cli
;; Install ISR
SET_INT_VECTOR 0x08, 0x0000, irq0_int08_isr

;; Set up the PIC so IRQs can work
mov al, 0x11           ;; Send initialisation commands
out PORT_PIC1_CMD, al
out PORT_PIC2_CMD, al
mov al, 0x08
out PORT_PIC1_DATA, al
mov al, 0x70
out PORT_PIC2_DATA, al
mov al, 0x04
out PORT_PIC1_DATA, al
mov al, 0x02
out PORT_PIC2_DATA, al
mov al, 0x01
out PORT_PIC1_DATA, al
out PORT_PIC2_DATA, al
mov al, 0xfe
out PORT_PIC1_DATA, AL  ;; Master pic: unmask IRQ 0
mov al, 0xff
out PORT_PIC2_DATA, AL  ;; Slave pic: don't unmask any IRQs
sti

;; Control Word first
;; - Binary counting, Mode 2, Read or Load LSB first then MSB, Channel 0 (for IRQ 0)
mov al, 110100b
out 0x43, al

;; Then configure counter (0 ticks) - 18.2Hz
mov ax, 0
out 0x40, al   ;; LSB
xchg ah, al
out 0x40, al   ;; MSB

hang:
hlt
jmp hang

; -------------
irq0_int08_isr:
    push ecx
    mov ecx, [0x046c] ;; Read ticks dword
    inc ecx
    mov [0x046c], ecx ;; Write ticks dword
    pop ecx
    call eoi_master_pic
    iret

eoi_master_pic:
    mov al, 0x20
    out PORT_PIC1_CMD, al ;; Master PIC EOI
    ret
EOS
*/) {});

                        testSystem.execute(assembly).done(function () {
                            done();
                        }).fail(function (exception) {
                            done(exception);
                        });
                    });

                    describe("after 0 ticks", function () {
                        beforeEach(function (done) {
                            // Still tick for zero, so async events are fired
                            testSystem.tickForwardBy(0).done(done);
                        });

                        it("should not have raised counter 0's OUT", function () {
                            expect(counter0Raises).to.equal(0);
                        });

                        it("should not have raised IRQ0", function () {
                            expect(irq0Raises).to.equal(0);
                        });

                        it("should not have called the installed IRQ0 (INT08) ISR", function () {
                            expect(system.read({from: 0x046c, size: 4})).to.equal(0);
                        });
                    });

                    describe("after 1 tick", function () {
                        beforeEach(function (done) {
                            testSystem.tickForwardBy(1).done(done);
                        });

                        it("should have raised counter 0's OUT once", function () {
                            expect(counter0Raises).to.equal(1);
                        });

                        it("should not have raised IRQ0", function () {
                            expect(irq0Raises).to.equal(0);
                        });

                        it("should not have called the installed IRQ0 (INT08) ISR", function () {
                            expect(system.read({from: 0x046c, size: 4})).to.equal(0);
                        });
                    });

                    describe("after 54 milliseconds", function () {
                        beforeEach(function (done) {
                            testSystem.tickForwardBy(util.millisecondsToTicks(54)).done(done);
                        });

                        it("should not have lowered counter 0's OUT", function () {
                            expect(counter0Lowers).to.equal(0);
                        });

                        it("should not have raised IRQ0", function () {
                            expect(irq0Raises).to.equal(0);
                        });

                        it("should not have called the installed IRQ0 (INT08) ISR", function () {
                            expect(system.read({from: 0x046c, size: 4})).to.equal(0);
                        });
                    });

                    describe("after 55 milliseconds", function () {
                        beforeEach(function (done) {
                            testSystem.tickForwardBy(util.millisecondsToTicks(55)).done(done);
                        });

                        it("should have lowered counter 0's OUT once", function () {
                            expect(counter0Lowers).to.equal(1);
                        });

                        it("should have raised IRQ0 once", function () {
                            expect(irq0Raises).to.equal(1);
                        });

                        it("should have called the installed IRQ0 (INT08) ISR once", function () {
                            expect(system.read({from: 0x046c, size: 4})).to.equal(1);
                        });
                    });
                });
            });

            describe("when using mode 3 (square wave generator)", function () {
                describe("with a count of 10 ticks", function () {
                    beforeEach(function (done) {
                        var assembly = util.heredoc(function (/*<<<EOS
;; Control Word first
;; - Binary counting, Mode 3, Read or Load LSB first then MSB, Channel 0 (for IRQ 0)
mov al, 110110b
out 0x43, al

;; Then configure counter (10 ticks)
mov ax, 10
out 0x40, al   ;; LSB
xchg ah, al
out 0x40, al   ;; MSB

hang:
hlt
jmp hang
EOS
*/) {});

                        testSystem.execute(assembly).done(function () {
                            done();
                        }).fail(function (exception) {
                            done(exception);
                        });
                    });

                    describe("after 0 ticks", function () {
                        beforeEach(function (done) {
                            // Still tick for zero, so async events are fired
                            testSystem.tickForwardBy(0).done(done);
                        });

                        it("should not have raised counter 0's OUT", function () {
                            expect(counter0Raises).to.equal(0);
                        });
                    });

                    describe("after 1 tick", function () {
                        beforeEach(function (done) {
                            testSystem.tickForwardBy(1).done(done);
                        });

                        it("should have raised counter 0's OUT once", function () {
                            expect(counter0Raises).to.equal(1);
                        });
                    });

                    describe("after 4 ticks", function () {
                        beforeEach(function (done) {
                            testSystem.tickForwardBy(4).done(done);
                        });

                        it("should not have lowered counter 0's OUT", function () {
                            expect(counter0Lowers).to.equal(0);
                        });
                    });

                    describe("after 5 ticks", function () {
                        beforeEach(function (done) {
                            testSystem.tickForwardBy(5).done(done);
                        });

                        it("should have lowered counter 0's OUT once", function () {
                            expect(counter0Lowers).to.equal(1);
                        });
                    });

                    describe("after 9 ticks", function () {
                        beforeEach(function (done) {
                            testSystem.tickForwardBy(9).done(done);
                        });

                        it("should still have raised counter 0's OUT only once", function () {
                            expect(counter0Raises).to.equal(1);
                        });
                    });

                    describe("after 9 ticks", function () {
                        beforeEach(function (done) {
                            testSystem.tickForwardBy(9).done(done);
                        });

                        it("should still have lowered counter 0's OUT only once", function () {
                            expect(counter0Lowers).to.equal(1);
                        });
                    });

                    describe("after 10 ticks", function () {
                        beforeEach(function (done) {
                            testSystem.tickForwardBy(10).done(done);
                        });

                        it("should have raised counter 0's OUT twice", function () {
                            expect(counter0Raises).to.equal(2);
                        });
                    });

                    describe("after 10 ticks", function () {
                        beforeEach(function (done) {
                            testSystem.tickForwardBy(10).done(done);
                        });

                        it("should still have lowered counter 0's OUT only once", function () {
                            expect(counter0Lowers).to.equal(1);
                        });
                    });
                });
            });
        });
    });
});
