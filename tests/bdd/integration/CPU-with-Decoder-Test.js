/**
 * jemul8 - JavaScript x86 Emulator
 * http://jemul8.com/
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*global DataView, define, Uint8Array */
define([
    "js/util",
    "tools/Factory/Assembler",
    "js/Clock",
    "js/CPU",
    "js/Decoder"
], function (
    util,
    AssemblerFactory,
    Clock,
    CPU,
    Decoder
) {
    "use strict";

    describe("CPU with Decoder integration", function () {
        var assembler,
            clock,
            cpu,
            decoder,
            options,
            ramView,
            stubIO,
            stubMemory,
            stubSystem;

        beforeEach(function () {
            assembler = new AssemblerFactory().create();
            clock = new Clock();
            ramView = new Uint8Array(1 * 1024 * 1024);
            stubIO = {};
            stubMemory = {
                disablePaging: sinon.stub(),
                enablePaging: sinon.stub(),
                getView: function () {},
                linearToPhysical: function (linearAddress) {
                    return linearAddress;
                },
                readLinear: function (linearAddress, size) {
                    if (size === 1) {
                        return ramView.getUint8(linearAddress);
                    } else if (size === 2) {
                        return ramView.getUint16(linearAddress, true);
                    } else if (size === 4) {
                        return ramView.getUint32(linearAddress, true);
                    }
                },
                setPageDirectoryAddress: sinon.stub(),
                writeLinear: function (linearAddress, value, size) {
                    if (size === 1) {
                        ramView.setUint8(linearAddress, value);
                    } else if (size === 2) {
                        ramView.setUint16(linearAddress, value, true);
                    } else if (size === 4) {
                        ramView.setUint32(linearAddress, value, true);
                    }
                }
            };
            stubSystem = {
                handleAsynchronousEvents: sinon.spy(),
                isHRQHigh: sinon.stub().returns(false)
            };
            options = {};
            decoder = new Decoder();
            cpu = new CPU(stubSystem, stubIO, stubMemory, decoder, clock, options);

            decoder.bindCPU(cpu);
            cpu.init();
            cpu.reset();
        });

        afterEach(function () {
            cpu.stop();
            assembler = null;
            clock = null;
            cpu = null;
            decoder = null;
            ramView = null;
        });

        describe("when executing just a 'hlt' instruction", function () {
            beforeEach(function (done) {
                assembler.assemble("hlt").done(function (buffer) {
                    var view = new DataView(new Uint8Array(buffer).buffer);

                    sinon.stub(stubMemory, "getView").returns(view);

                    done();
                }).fail(function (exception) {
                    done(exception);
                });
            });

            it("should just halt", function (done) {
                cpu.getRegisters().cs.set(0);
                cpu.getRegisters().ip.set(0);

                cpu.run().done(function () {
                    done();
                });
            });
        });

        describe("when executing 'mov ax, 1' then 'hlt' at segment 0x100, offset 0x20", function () {
            beforeEach(function (done) {
                var assembly = util.heredoc(function (/*<<<EOS
[BITS 16]
mov ax, 1
hlt
EOS
*/) {});

                assembler.assemble(assembly).done(function (buffer) {
                    var view = new Uint8Array(buffer);

                    ramView.set(view, 0x1000 + 0x20);
                    ramView = new DataView(ramView.buffer);

                    sinon.stub(stubMemory, "getView").returns(ramView);

                    cpu.getRegisters().cs.set(0x100);
                    cpu.getRegisters().ip.set(0x20);

                    cpu.run().done(function () {
                        done();
                    }).fail(function (exception) {
                        done(exception);
                    });
                }).fail(function (exception) {
                    done(exception);
                });
            });

            it("should store 1 in ax", function () {
                expect(cpu.getRegisters().ax.get()).to.equal(1);
            });
        });

        describe("when installing an ISR and halting at segment 0x100, offset 0", function () {
            beforeEach(function (done) {
                var assembly = util.heredoc(function (/*<<<EOS
org 0x1000
[BITS 16]

;; Installs a pointer to an ISR in the IVT
%macro SET_INT_VECTOR 3
    mov ax, %3
    mov [%1*4], ax
    mov ax, %2
    mov [%1*4+2], ax
%endmacro

cli
;; Install ISR
SET_INT_VECTOR 0x09, 0x0000, int09_isr
hlt
mov ax, 0x1234
hlt

int09_isr:
mov bx, 0x4321
iret
EOS
*/) {});

                assembler.assemble(assembly).done(function (buffer) {
                    var view = new Uint8Array(buffer);

                    ramView.set(view, 0x1000);
                    ramView = new DataView(ramView.buffer);

                    sinon.stub(stubMemory, "getView").returns(ramView);

                    cpu.getRegisters().cs.set(0x100);
                    cpu.getRegisters().ip.set(0);

                    done();
                }).fail(function (exception) {
                    done(exception);
                });
            });

            it("should be able to resume execution after an interrupt", function (done) {
                // Run up to the first halt
                cpu.run().done(function () {
                    cpu.one("halt", function () {
                        // Ensure the code was resumed
                        expect(cpu.getRegisters().ax.get()).to.equal(0x1234);
                        // Ensure the ISR was actually called
                        expect(cpu.getRegisters().bx.get()).to.equal(0x4321);
                        done();
                    });
                    // Trigger interrupt to wake the CPU, which should set ax then halt again
                    cpu.interrupt(0x09);
                }).fail(function (exception) {
                    done(exception);
                });
            });
        });
    });
});
