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
    "js/browser",
    "module",
    "js/util",
    "js/IODevice/CMOS",
    "js/CPU",
    "js/IODevice/DMA",
    "js/Emulator",
    "js/IODevice/FDC",
    "js/IODevice/GuestToHost",
    "js/IO",
    "js/Memory",
    "js/IODevice/PIC",
    "js/IODevice/PIT",
    "js/IODevice/PS2",
    "js/System",
    "js/IODevice/VGA"
], function (
    browser,
    module,
    util,
    CMOS,
    CPU,
    DMA,
    Emulator,
    FDC,
    GuestToHost,
    IO,
    Memory,
    PIC,
    PIT,
    PS2,
    System,
    VGA
) {
    "use strict";

    var CMOS_OPTIONS = "cmos",
        CPU_OPTIONS = "cpu",
        DMA_OPTIONS = "dma",
        FDC_OPTIONS = "floppy",
        MEMORY_OPTIONS = "memory",
        PIC_OPTIONS = "pic",
        PIT_OPTIONS = "pit",
        PS2_OPTIONS = "ps2",
        VGA_OPTIONS = "vga",
        callback = module.defer();

    function Jemul8(options) {
        this.options = options;
    }

    util.extend(Jemul8.prototype, {
        createEmulator: function (options) {
            var cpu,
                dma,
                emulator,
                fdc,
                io,
                jemul8 = this,
                memory,
                pic,
                system,
                vga;

            options = util.extend({}, jemul8.options, options);

            io = new IO();
            memory = new Memory(options[MEMORY_OPTIONS]);
            system = new System(io, memory);
            memory.setSystem(system);
            cpu = new CPU(system, io, memory, options[CPU_OPTIONS]);
            dma = new DMA(system, io, memory, options[DMA_OPTIONS]);
            pic = new PIC(system, io, memory, options[PIC_OPTIONS]);
            system.setCPU(cpu);
            system.setDMA(dma);
            system.setPIC(pic);
            emulator = new Emulator(system, io, memory, cpu);

            io.register({
                device: new CMOS(system, io, memory, options[CMOS_OPTIONS]),
                ports: {
                    0x0070: { description: "CMOS RAM", allowedIOLengths: {1: true} },
                    0x0071: { description: "CMOS RAM", allowedIOLengths: {1: true} }
                }
            });
            io.register({
                device: dma,
                ports: (function () {
                    var port,
                        ports = {};

                    // 0x0000 ... 0x000F
                    for (port = 0x0000 ; port <= 0x000F ; ++port) {
                        ports[port] = { description: "8237 DMA", allowedIOLengths: {1: true, 2: true} };
                    }
                    // 0x0080 ... 0x008F
                    for (port = 0x0080 ; port <= 0x008F ; ++port) {
                        ports[port] = { description: "8237 DMA", allowedIOLengths: {1: true, 2: true} };
                    }
                    // 0x00C0 ... 0x00DE
                    for (port = 0x00C0 ; port <= 0x00DE ; port += 2) {
                        ports[port] = { description: "8237 DMA", allowedIOLengths: {1: true, 2: true} };
                    }

                    return ports;
                }())
            });
            fdc = new FDC(system, io, memory, options[FDC_OPTIONS]);
            io.register({
                device: fdc,
                ports: (function () {
                    var port,
                        ports = {};

                    for (port = 0x03F2 ; port <= 0x03F7 ; ++port) {
                        ports[port] = { description: "FDC", allowedIOLengths: {1: true} };
                    }

                    return ports;
                }())
            });
            dma.register(fdc);
            io.register({
                device: new GuestToHost(system, io, memory, options[CMOS_OPTIONS]),
                ports: {
                    0x0402: { description: "GuestToHost INFO_PORT", allowedIOLengths: {1: true} },
                    0x0403: { description: "GuestToHost DEBUG_PORT", allowedIOLengths: {1: true} }
                }
            });
            io.register({
                device: pic,
                ports: {
                    0x0020: { description: "PIC", allowedIOLengths: {1: true} },
                    0x0021: { description: "PIC", allowedIOLengths: {1: true} },
                    0x00A0: { description: "PIC", allowedIOLengths: {1: true} },
                    0x00A1: { description: "PIC", allowedIOLengths: {1: true} }
                }
            });
            io.register({
                device: new PIT(system, io, memory, options[PIT_OPTIONS]),
                ports: {}
            });
            io.register({
                device: new PS2(system, io, memory, options[PS2_OPTIONS]),
                ports: {
                    0x0060: { description: "PS/2", allowedIOLengths: {1: true} },
                    0x0064: { description: "PS/2", allowedIOLengths: {1: true} }
                }
            });
            vga = new VGA(system, io, memory, options[VGA_OPTIONS]);
            io.register({
                device: vga,
                ports: (function () {
                    var description = "VGA",
                        port,
                        ports = {};

                    for (port = 0x03B4 ; port <= 0x03B5; ++port) {
                        ports[port] = { description: description, allowedIOLengths: {1: true, 2: true} };
                    }

                    for (port = 0x03BA ; port <= 0x03BA ; ++port) {
                        ports[port] = { description: description, allowedIOLengths: {1: true, 2: true} };
                    }

                    for (port = 0x03C0 ; port <= 0x03CF ; ++port) {
                        ports[port] = { description: description, allowedIOLengths: {1: true, 2: true} };
                    }

                    for (port = 0x03D4 ; port <= 0x03D5 ; ++port) {
                        ports[port] = { description: description, allowedIOLengths: {1: true, 2: true} };
                    }

                    for (port = 0x03DA ; port <= 0x03DA ; ++port) {
                        ports[port] = { description: description, allowedIOLengths: {1: true, 2: true} };
                    }

                    return ports;
                }())
            });
            memory.register({
                device: vga,
                startAddress: 0xa0000,
                endAddress: 0xbffff
            });

            return emulator;
        },

        getEnvironment: function () {
            return browser;
        }
    });

    // Breaks the circular dependency between js/Jemul8.js<->js/util.js
    util.init(function () {
        callback(Jemul8);
    });
});
