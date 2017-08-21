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
    "js/Clock",
    "js/IODevice/CMOS",
    "js/IODevice/PIT/Counter",
    "js/CPU",
    "js/Decoder",
    "js/IODevice/DMA",
    "js/IODevice/FDC",
    "js/IODevice/GuestToHost",
    "js/IO",
    "js/Memory",
    "js/IODevice/NE2K",
    "js/IODevice/PIC",
    "js/IODevice/PIT",
    "js/IODevice/PS2",
    "js/System",
    "js/IODevice/SystemControl",
    "js/IODevice/VGA"
], function (
    browser,
    module,
    util,
    Clock,
    CMOS,
    Counter,
    CPU,
    Decoder,
    DMA,
    FDC,
    GuestToHost,
    IO,
    Memory,
    NE2K,
    PIC,
    PIT,
    PS2,
    System,
    SystemControl,
    VGA
) {
    "use strict";

    var CMOS_OPTIONS = "cmos",
        CPU_OPTIONS = "cpu",
        DMA_OPTIONS = "dma",
        FDC_OPTIONS = "floppy",
        MEMORY_OPTIONS = "memory",
        NE2K_OPTIONS = "ne2k",
        PIC_OPTIONS = "pic",
        PIT_OPTIONS = "pit",
        PS2_OPTIONS = "ps2",
        VGA_OPTIONS = "vga";

    function SystemFactory(memoryAllocator, options) {
        this.memoryAllocator = memoryAllocator;
        this.options = options;
    }

    util.extend(SystemFactory.prototype, {
        create: function (options) {
            var clock = new Clock(),
                cpu,
                decoder,
                dma,
                fdc,
                io,
                factory = this,
                memory,
                pic,
                system,
                vga;

            options = util.extend({}, factory.options, options);

            io = new IO();
            memory = new Memory(factory.memoryAllocator, options[MEMORY_OPTIONS]);
            system = new System(clock, io, memory);
            memory.setSystem(system);

            decoder = new Decoder();
            cpu = new CPU(system, io, memory, decoder, clock, options[CPU_OPTIONS]);
            decoder.bindCPU(cpu);
            memory.setCPU(cpu);

            dma = new DMA(system, io, memory, options[DMA_OPTIONS]);
            pic = new PIC(system, io, memory, options[PIC_OPTIONS]);
            system.setCPU(cpu);
            system.setDMA(dma);
            system.setPIC(pic);

            io.register(new CMOS(system, io, memory, options[CMOS_OPTIONS]));
            io.register(dma);
            fdc = new FDC(system, io, memory, options[FDC_OPTIONS]);
            io.register(fdc);
            dma.register(fdc);
            io.register(new GuestToHost(system, io, memory, options[CMOS_OPTIONS]));
            io.register(pic);

            io.register(new PIT(
                system,
                io,
                memory,
                new Counter(system, system.createTimer()),
                new Counter(system, system.createTimer()),
                new Counter(system, system.createTimer()),
                options[PIT_OPTIONS]
            ));

            io.register(new PS2(system, io, memory, options[PS2_OPTIONS]));
            vga = new VGA(system, io, memory, options[VGA_OPTIONS]);
            io.register(vga);
            memory.register({
                device: vga,
                startAddress: 0xa0000,
                endAddress: 0xbffff
            });
            io.register(new NE2K(system, io, memory, options[NE2K_OPTIONS]));
            io.register(new SystemControl(system, io, memory));

            return system;
        }
    });

    return SystemFactory;
});
