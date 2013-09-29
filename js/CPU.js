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
    "js/EventEmitter",
    "js/core/classes/cpu",
    "js/Promise"
], function (
    util,
    EventEmitter,
    LegacyCPU,
    Promise
) {
    "use strict";

    function CPU(system, io, memory, options) {
        EventEmitter.call(this);

        this.io = io;
        this.memory = memory;
        this.options = options;
        this.running = false;
        this.system = system;

        this.legacyCPU = new LegacyCPU({
            cpu: {
                getCPL: function () {
                    return 0;
                },
                PE: {
                    get: function () {
                        return 0;
                    }
                },
                PG: {
                    get: function () {
                        return 0;
                    }
                },
                VM: {
                    get: function () {
                        return 0;
                    }
                }
            },
            dma: {
                raiseHLDA: function () {
                    system.raiseHLDA();
                }
            },
            emu: {
                getSetting: function (name) {
                    if (name === "dma.maxQuantumsPerYield") {
                        return 512;
                    }

                    throw new Error("Unknown");
                }
            },
            getTimeMsecs: function () {
                return Date.now();
            },
            io: {
                read: function (port, length) {
                    return io.read(port, length);
                },
                write: function (port, value, length) {
                    io.write(port, value, length);
                }
            },
            list_tmr: [],
            mem: {
                linearToPhysical: function (linearAddress) {
                    return memory.linearToPhysical(linearAddress);
                },
                mapPhysical: function (physicalAddress) {
                    return memory.mapPhysical(physicalAddress);
                },
                readLinear: function (linearAddress, size) {
                    return memory.readLinear(linearAddress, size);
                },
                writeLinear: function (linearAddress, value, size) {
                    memory.writeLinear(linearAddress, value, size);
                }
            },
            pic: {
                acknowledgeInterrupt: function () {
                    return system.acknowledgeInterrupt();
                }
            },
            HRQ: {
                get: function () {
                    return system.isHRQHigh();
                }
            }
        });

        (function (cpu, legacyCPU) {
            // Monkey-patch a trap for interrupts
            legacyCPU.interrupt = (function (interrupt) {
                return function (vector) {
                    cpu.emit("interrupt", vector);
                    interrupt.apply(this, arguments);
                };
            }(legacyCPU.interrupt));

            // Monkey-patch a trap for halt
            legacyCPU.halt = (function (halt) {
                return function () {
                    cpu.halt();
                    halt.apply(this, arguments);
                };
            }(legacyCPU.halt));
        }(this, this.legacyCPU));
    }

    util.inherit(CPU).from(EventEmitter);

    util.extend(CPU.prototype, {
        getRegisters: function () {
            var cpu = this.legacyCPU;

            return {
                eax: cpu.EAX,
                ax: cpu.AX,
                al: cpu.AL,
                ah: cpu.AH,

                ecx: cpu.ECX,
                cx: cpu.CX,
                cl: cpu.CL,
                ch: cpu.CH,

                ebx: cpu.EBX,
                bx: cpu.BX,
                bl: cpu.BL,
                bh: cpu.BH,

                edx: cpu.EDX,
                dx: cpu.DX,
                dl: cpu.DL,
                dh: cpu.DH,

                ebp: cpu.EBP,
                bp: cpu.BP,

                edi: cpu.EDI,
                di: cpu.DI,

                esi: cpu.ESI,
                si: cpu.SI,

                esp: cpu.ESP,
                sp: cpu.SP,

                eip: cpu.EIP,
                ip: cpu.IP,

                cs: cpu.CS,
                ds: cpu.DS,
                es: cpu.ES,
                fs: cpu.FS,
                gs: cpu.GS,
                ss: cpu.SS
            };
        },

        halt: function () {
            var cpu = this;

            cpu.running = false;
            cpu.emit("halt");

            return cpu;
        },

        init: function () {
            var cpu = this,
                promise = new Promise();

            // Set up the CPU's working parameters
            //  (IPS, yields/sec, ms/yield)
            cpu.legacyCPU.configure(100000, 30, 20);

            cpu.legacyCPU.init();

            return promise.resolve();
        },

        lowerINTR: function () {
            this.legacyCPU.INTR.lower();
        },

        raiseINTR: function () {
            this.legacyCPU.INTR.raise();
        },

        reset: function () {
            this.legacyCPU.RESET.raise();
        },

        run: function () {
            var cpu = this,
                promise = new Promise();

            cpu.running = true;
            cpu.one("halt", function () {
                promise.resolve();
            });
            cpu.legacyCPU.run();
            cpu.emit("run");

            return promise;
        }
    });

    return CPU;
});
