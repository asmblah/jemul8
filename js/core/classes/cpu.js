/*
 *  jemul8 - JavaScript x86 Emulator
 *  Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *
 * MODULE: IBM-PC compatible Intel CPU support
 *
 * ====
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*jslint bitwise: true, plusplus: true */
/*global define */

define([
    "../util",
    "./cpu/lazy_flags_register",
    "./register",
    "./subregister",
    "./cpu/segreg",
    "./cpu/lazy_flag",
    "./cpu/unlazy_flag",
    "./pin",
    "./cpu/instruction",
    "./cpu/operand",
    "./decoder",
    "./cpu/execute",
    "./cpu/global_table_register",
    "./cpu/local_table_register"
], function (
    util,
    LazyFlagRegister,
    Register,
    SubRegister,
    SegRegister,
    LazyFlag,
    UnlazyFlag,
    Pin,
    Instruction,
    Operand,
    Decoder,
    Execute,
    GlobalTableRegister,
    LocalTableRegister
) {
    "use strict";

    var ticksLastUpdate = Date.now(),
        ips = 0,
        yps = 0;

    // x86 CPU class constructor
    function CPU(machine, name_class) {
        util.assert(this && (this instanceof CPU),
            "CPU constructor :: error - not called properly");

        this.machine = machine;

        // Class / type of CPU (eg. 386, 486, PIII, D)
        this.name_class = name_class;
        // Hash of CPU Registers, mapped by name
        this.hsh_reg = {};

        // Lookup hash for byte-size -> accumulator register
        //    (ie. 1 is AL, 2 is AX, 4 is EAX)
        this.accumulator = null;

        // Set up by .configure()
        this.insnsPerSecond = 0;
        this.yieldsPerSecond = 0;
        this.msPerSlice = 0;
        this.max_insnsPerSlice = 0;
        this.msPerYield = 0;

        // Instruction cache (decoded Instructions are stored indexed
        //    by absolute memory address to avoid needing
        //    to redecode Instructions executed more than once,
        //    eg. in a loop or an OS scheduler)
        //    See SegRegister.set() in /classes/memory.js
        this.cache_insn = [];

        this.isHalted = true;

        // Operands & result from last flag-affecting operation
        //    (used by the Bochs-derived Lazy Flags optimisation system)
        this.insnLast = null;
        this.valLast1 = 0;
        this.valLast2 = 0;
        this.resLast = 0;

        // All x86 CPUs use the same basic registers; see this function
        this.installStdRegisters();

        // Create Instruction decoder
        this.decoder = new Decoder({
            ES: this.ES,
            CS: this.CS,
            SS: this.SS,
            DS: this.DS,
            FS: this.FS,
            GS: this.GS,

            AL: this.AL,
            AH: this.AH,
            CL: this.CL,
            CH: this.CH,
            BL: this.BL,
            BH: this.BH,
            DL: this.DL,
            DH: this.DH,

            AX: this.AX,
            EAX: this.EAX,
            CX: this.CX,
            ECX: this.ECX,
            BX: this.BX,
            EBX: this.EBX,
            DX: this.DX,
            EDX: this.EDX,
            SP: this.SP,
            ESP: this.ESP,
            BP: this.BP,
            EBP: this.EBP,
            SI: this.SI,
            ESI: this.ESI,
            DI: this.DI,
            EDI: this.EDI,

            CR0: this.CR0,
            CR1: this.CR1,
            CR2: this.CR2,
            CR3: this.CR3,
            CR4: this.CR4
        });
    }
    util.extend(CPU.prototype, {
        install: function (component) {
            switch (component.constructor) {
            // Install a compatible Register onto the emulated CPU
            case LazyFlagRegister:    // Fall through
            case Register:
            case SubRegister:
            case SegRegister:
            case GlobalTableRegister:
            case LocalTableRegister:
            // CPU pins, eg. #INTR for interrupts
            case Pin:
                component.cpu = this;
                // Don't bother for unnamed components
                if (component.name) {
                    // Hash used to get Register by its name
                    this.hsh_reg[component.name] = component;
                    // Shortcut to using hash for time-critical parts
                    this[component.name] = component;
                }
                break;
            default:
                util.panic("CPU.install :: Provided component cannot be installed into the CPU.");
            }
        },
        // Install all standard x86 Registers onto the CPU
        //    (i486 pinout: http://pclinks.xtreemhost.com/486pin.htm)
        installStdRegisters: function () {
            var EFLAGS,
                CR0;

            // Accumulator
            this.install(new Register("EAX", 4));
            this.install(new SubRegister("AX", 2, this.EAX, 0xFFFF, 0));
            this.install(new SubRegister("AH", 1, this.EAX, 0xFF, 1));
            this.install(new SubRegister("AL", 1, this.EAX, 0xFF, 0));
            this.accumulator = { 1: this.AL, 2: this.AX, 4: this.EAX };
            // Counter
            this.install(new Register("ECX", 4));
            this.install(new SubRegister("CX", 2, this.ECX, 0xFFFF, 0));
            this.install(new SubRegister("CH", 1, this.ECX, 0xFF, 1));
            this.install(new SubRegister("CL", 1, this.ECX, 0xFF, 0));
            // Base
            this.install(new Register("EBX", 4));
            this.install(new SubRegister("BX", 2, this.EBX, 0xFFFF, 0));
            this.install(new SubRegister("BH", 1, this.EBX, 0xFF, 1));
            this.install(new SubRegister("BL", 1, this.EBX, 0xFF, 0));
            // Data
            this.install(new Register("EDX", 4));
            this.install(new SubRegister("DX", 2, this.EDX, 0xFFFF, 0));
            this.install(new SubRegister("DH", 1, this.EDX, 0xFF, 1));
            this.install(new SubRegister("DL", 1, this.EDX, 0xFF, 0));
            // Base pointer
            this.install(new Register("EBP", 4));
            this.install(new SubRegister("BP", 2, this.EBP, 0xFFFF, 0));
            // Dest. index
            this.install(new Register("EDI", 4));
            this.install(new SubRegister("DI", 2, this.EDI, 0xFFFF, 0));
            // Source index
            this.install(new Register("ESI", 4));
            this.install(new SubRegister("SI", 2, this.ESI, 0xFFFF, 0));
            // Stack pointer
            this.install(new Register("ESP", 4));
            this.install(new SubRegister("SP", 2, this.ESP, 0xFFFF, 0));

            // Instruction Pointer
            this.install(new Register("EIP", 4));
            this.install(new SubRegister("IP", 2, this.EIP, 0xFFFF, 0));

            // Segment registers
            this.install(new SegRegister("CS", 2));    // Code segment
            this.install(new SegRegister("DS", 2));    // Data segment
            this.install(new SegRegister("SS", 2));    // Stack segment
            this.install(new SegRegister("ES", 2));    // Extra segment
            this.install(new SegRegister("FS", 2));    // "FS" segment
            this.install(new SegRegister("GS", 2));    // "GS" segment

            // EFlags (32-bit) register
            EFLAGS = new LazyFlagRegister("EFLAGS", 4);
            this.install(EFLAGS);
            // Flags (16-bit) register
            this.install(new SubRegister("FLAGS", 2, this.EFLAGS, 0xFFFF, 0));
            // Carry Flag
            EFLAGS.install(new LazyFlag("CF", this.EFLAGS, 0));
            /* ==== Gap ==== */
            EFLAGS.install(new UnlazyFlag(null, this.EFLAGS, 1));
            /* ==== /Gap ==== */
            // Parity Flag
            EFLAGS.install(new LazyFlag("PF", this.EFLAGS, 2));
            /* ==== Gap ==== */
            EFLAGS.install(new UnlazyFlag(null, this.EFLAGS, 3));
            /* ==== /Gap ==== */
            // Auxiliary Flag
            EFLAGS.install(new LazyFlag("AF", this.EFLAGS, 4));
            /* ==== Gap ==== */
            EFLAGS.install(new UnlazyFlag(null, this.EFLAGS, 5));
            /* ==== /Gap ==== */
            // Zero Flag
            EFLAGS.install(new LazyFlag("ZF", this.EFLAGS, 6));
            // Sign Flag
            EFLAGS.install(new LazyFlag("SF", this.EFLAGS, 7));
            // Trap Flag (Single Step)
            EFLAGS.install(new UnlazyFlag("TF", this.EFLAGS, 8));
            // Interrupt Flag
            EFLAGS.install(new UnlazyFlag("IF", this.EFLAGS, 9));
            // Direction Flag
            EFLAGS.install(new UnlazyFlag("DF", this.EFLAGS, 10));
            // Overflow Flag
            EFLAGS.install(new LazyFlag("OF", this.EFLAGS, 11));
            // IOPL (I/O Privilege Level) Flag - Intel 286+ only
            //    NB: this is a 2-bit value (privilege level - eg. level 0 is OS), not a flag
            EFLAGS.install(new UnlazyFlag("IOPL", this.EFLAGS, 12));
            EFLAGS.install(new UnlazyFlag("IOPL2", this.EFLAGS, 13));
            // NT (Nested Task) Flag - Intel 286+ only
            EFLAGS.install(new UnlazyFlag("NT", this.EFLAGS, 14));
            /* ==== Gap ==== */
            EFLAGS.install(new UnlazyFlag(null, this.EFLAGS, 15));
            /* ==== /Gap ==== */
            // Resume Flag
            EFLAGS.install(new UnlazyFlag("RF", this.EFLAGS, 16));
            // Virtual-8086 Mode Flag
            EFLAGS.install(new UnlazyFlag("VM", this.EFLAGS, 17));
            // Alignment-Check (486SX+ only)
            EFLAGS.install(new UnlazyFlag("AC", this.EFLAGS, 18));
            // Virtual Interrupt Flag (Pentium+)
            EFLAGS.install(new UnlazyFlag("VIF", this.EFLAGS, 19));
            // Virtual Interrupt Pending Flag (Pentium+)
            EFLAGS.install(new UnlazyFlag("VIP", this.EFLAGS, 20));
            // Identification Flag (Pentium+)
            EFLAGS.install(new UnlazyFlag("ID", this.EFLAGS, 21));

            /* ==== Gap ==== */
            EFLAGS.install(new UnlazyFlag(null, this.EFLAGS, 22));
            EFLAGS.install(new UnlazyFlag(null, this.EFLAGS, 23));
            EFLAGS.install(new UnlazyFlag(null, this.EFLAGS, 24));
            EFLAGS.install(new UnlazyFlag(null, this.EFLAGS, 25));
            EFLAGS.install(new UnlazyFlag(null, this.EFLAGS, 26));
            EFLAGS.install(new UnlazyFlag(null, this.EFLAGS, 27));
            EFLAGS.install(new UnlazyFlag(null, this.EFLAGS, 28));
            EFLAGS.install(new UnlazyFlag(null, this.EFLAGS, 29));
            EFLAGS.install(new UnlazyFlag(null, this.EFLAGS, 30));
            EFLAGS.install(new UnlazyFlag(null, this.EFLAGS, 31));
            /* ==== /Gap ==== */

            // Global Descriptor Table Register
            this.install(new GlobalTableRegister("GDTR"));
            // Interrupt Descriptor Table Register
            this.install(new GlobalTableRegister("IDTR"));
            // Local Descriptor Table Register
            this.install(new LocalTableRegister("LDTR", 4));
            // Task Register
            this.install(new SegRegister("TR", 4));

            // Control Register 0
            CR0 = new LazyFlagRegister("CR0", 4);
            this.install(CR0);

            // Machine Status Word
            this.install(new SubRegister("MSW", 2, this.CR0, 0xFFFF, 0));

            // Protected Mode Enable
            //  (If 1, system is in Protected Mode, else system is in Real Mode)
            CR0.install(new UnlazyFlag("PE", this.CR0, 0));
            // Monitor co-Processor
            //  (Controls interaction of WAIT/FWAIT Instructions
            //  with TS Flag in CR0)
            CR0.install(new UnlazyFlag("MP", this.CR0, 1));
            // Emulation
            CR0.install(new UnlazyFlag("EM", this.CR0, 2));
            // Task Switched
            CR0.install(new UnlazyFlag("TS", this.CR0, 3));
            // Extension Type
            CR0.install(new UnlazyFlag("ET", this.CR0, 4));
            // Numeric Error
            //  (Enable internal x87 floating point error reporting when set,
            //    else enables PC style x87 error detection)
            CR0.install(new UnlazyFlag("NE", this.CR0, 5));

            /* ==== Gap ==== */
            CR0.install(new UnlazyFlag(null, this.CR0, 6));
            CR0.install(new UnlazyFlag(null, this.CR0, 7));
            CR0.install(new UnlazyFlag(null, this.CR0, 8));
            CR0.install(new UnlazyFlag(null, this.CR0, 9));
            CR0.install(new UnlazyFlag(null, this.CR0, 10));
            CR0.install(new UnlazyFlag(null, this.CR0, 11));
            CR0.install(new UnlazyFlag(null, this.CR0, 12));
            CR0.install(new UnlazyFlag(null, this.CR0, 13));
            CR0.install(new UnlazyFlag(null, this.CR0, 14));
            CR0.install(new UnlazyFlag(null, this.CR0, 15));
            /* ==== /Gap ==== */

            // Write Protect
            CR0.install(new UnlazyFlag("WP", this.CR0, 16));

            /* ==== Gap ==== */
            CR0.install(new UnlazyFlag(null, this.CR0, 17));
            /* ==== /Gap ==== */

            // Alignment Mask
            this.AM = this.hsh_reg.AM = new UnlazyFlag("AM", this.CR0, 18);

            /* ==== Gap ==== */
            CR0.install(new UnlazyFlag(null, this.CR0, 19));
            CR0.install(new UnlazyFlag(null, this.CR0, 20));
            CR0.install(new UnlazyFlag(null, this.CR0, 21));
            CR0.install(new UnlazyFlag(null, this.CR0, 22));
            CR0.install(new UnlazyFlag(null, this.CR0, 23));
            CR0.install(new UnlazyFlag(null, this.CR0, 24));
            CR0.install(new UnlazyFlag(null, this.CR0, 25));
            CR0.install(new UnlazyFlag(null, this.CR0, 26));
            CR0.install(new UnlazyFlag(null, this.CR0, 27));
            CR0.install(new UnlazyFlag(null, this.CR0, 28));
            /* ==== /Gap ==== */

            // Not-write through
            CR0.install(new UnlazyFlag("NW", this.CR0, 29));
            // Cache Disable
            CR0.install(new UnlazyFlag("CD", this.CR0, 30));
            // Paging - (If 1, enable paging & use CR3, else disable paging)
            CR0.install(new UnlazyFlag("PG", this.CR0, 31));

            // Control Register 1 (Reserved)
            this.install(new Register("CR1", 4));
            // Control Register 2 (PFLA - Page Fault Linear Address)
            this.install(new Register("CR2", 4));
            // Control Register 3 (Virtual addresses -> Physical addresses)
            this.install(new Register("CR3", 4));
            // Control Register 4
            this.install(new Register("CR4", 4));

            // Debug Register 0
            this.install(new Register("DR0", 4));
            // Debug Register 1
            this.install(new Register("DR1", 4));
            // Debug Register 2
            this.install(new Register("DR2", 4));
            // Debug Register 3
            this.install(new Register("DR3", 4));
            // Debug Register 4
            this.install(new Register("DR4", 4));
            // Debug Register 5
            this.install(new Register("DR5", 4));
            // Debug Register 6
            this.install(new Register("DR6", 4));
            // Debug Register 7
            this.install(new Register("DR7", 4));

            /* ======= Test Registers ======= */
            // NB: Removed in newer CPUs & only numbered from 4 -> 7
            // Test Register 4
            this.install(new Register("TR4", 4));
            // Test Register 5
            this.install(new Register("TR5", 4));
            // Test Register 6
            this.install(new Register("TR6", 4));
            // Test Register 7
            this.install(new Register("TR7", 4));
            /* ======= /Test Registers ======= */

            // Bus Lock LOCK#
            this.install(new Pin("LOCK"));

            // CPU reset #RESET
            this.install(new Pin("RESET"));
            this.RESET.hook(function () {
                return 0; // Always low when read
            }, function () {
                // Asserting #RESET will perform a soft-reset
                this.cpu.reset();
            });

            // Maskable Interrupt pin #INTR
            //    (raised when a maskable interrupt is pending)
            this.install(new Pin("INTR"));
            // (N)on-(M)askable (I)nterrupt pin #NMI
            //    (raised when a non-maskable interrupt is pending)
            this.install(new Pin("NMI"));
        },
        // Determine whether the emulated CPU is in a halted state or not
        halted: function () {
            return this.isHalted;
        },
        // Force emulated CPU into a halted state
        halt: function () {
            if (!this.isHalted) {
                if (!this.IF.get()) {
                    util.warning("CPU halted with IF=0!");
                }
                this.isHalted = true;

                util.debug("CPU halted");
            }
        },
        // Command emulated CPU to run/resume from CS:EIP
        run: function () {
            if (this.isHalted) {
                this.isHalted = false;

                util.debug("CPU resumed");
            }
        },
        // Purge the decoded instruction caches
        flushInstructionCaches: function () {
            this.cache_insn.length = 0;
        },
        // Hold emulated CPU #RESET pin and release
        reset: function () {
            // Enable maskable interrupts
            this.IF.set();

            // Set all segment registers to startup state (incl. descriptor caches)
            this.CS.reset();
            this.DS.reset();
            this.SS.reset();
            this.ES.reset();
            this.FS.reset();
            this.GS.reset();

            // Start at first instruction in CMOS BIOS POST
            this.CS.set(0xF000);
            this.EIP.set(0x0000FFF0);

            // Clear all general-purpose registers
            this.EAX.set(0x00000000);
            this.EBX.set(0x00000000);
            this.ECX.set(0x00000000);
            this.EDX.set(0x00000000);
            this.EBP.set(0x00000000);
            this.ESI.set(0x00000000);
            this.EDI.set(0x00000000);
            this.ESP.set(0x00000000);

            // Descriptor Table Registers
            this.GDTR.reset(); // See GlobalTableRegister
            this.IDTR.reset(); // See GlobalTableRegister
            this.LDTR.reset(); // See LocalTableRegister

            /*
             *    - Real mode
             *    - FPU disabled
             *    - Do not emulate FPU
             *    - Use DOS-compat. FPU error reporting (assert #FERR out)
             *    - OS can write to read-only pages
             *    - Alignment Check exception disabled
             *    - Internal cache disabled
             *    - Paging disabled
             */
            this.CR0.set(0x60000010);
            /*
             *    - Single-step disabled
             *    - Recognition of external interrupts (on INTR) disabled
             *    - String instructions auto-INCREMENT address
             *    - IOPL = 0 (no effect in Real Mode)
             *    - Debug fault checking enabled after exec. of IRETD insn.
             *    - Virtual 8086 mode disabled
             *    - Alignment Checking disabled
             */
            this.EFLAGS.set(0x00000002);
            // Page Fault Linear Address of 00000000h.
            //    No effect in Real Mode (paging disabled)
            this.CR2.set(0x00000000);
            // Contains Page Directory start address of 00000000h,
            //    page directory caching set to enabled and write-back.
            // - No effect (because paging disabled)
            this.CR3.set(0x00000000);
            // Processor extensions disabled.
            //    No effect in real mode.
            this.CR4.set(0x00000000);

            /* ==== Debug ==== */
            // Disable breakpoint recognition.
            this.DR7.set(0x00000400);
            /* ==== /Debug ==== */

            // Purge the Instruction caches
            this.flushInstructionCaches();
        },
        // Configure the CPU with its working parameters
        //    (NB: Called when yield manager decides IPS is too low or high)
        configure: function (
            // CPU emulation speed (in IPS, not Hertz as there
            //    is no direct correlation in this emulator between CPU cycles
            //    and Instruction exec time)
            insnsPerSecond,
            // Yield rate of emulator (stop CPU processing and refresh video,
            //    process DOM events and translate to Interrupts, etc.)
            yieldsPerSecond,
            // Amount of time Yield lasts for before returning to CPU processing
            msPerYield
        ) {
            var msAllSlices, msPerSlice, max_insnsPerSlice;

            // Use current settings for any omitted arguments
            //    (allows eg. only changing IPS)
            if (!insnsPerSecond) { insnsPerSecond = this.insnsPerSecond; }
            if (!yieldsPerSecond) { yieldsPerSecond = this.yieldsPerSecond; }
            if (!msPerYield) { msPerYield = this.msPerYield; }

            // Amount of time available within a 1 second period for CPU processing
            msAllSlices = 1000 - msPerYield * yieldsPerSecond;

            // Ensure that we are not left with a CPU running at < 1 Instructions per slice,
            //    otherwise nothing will happen!
            if (insnsPerSecond < yieldsPerSecond) {
                insnsPerSecond = yieldsPerSecond;
            }

            // Calculate amount of time CPU processing runs for before Yielding to allow
            //    DOM processing etc., taking into account the duration of the Yield processing itself
            msPerSlice = msAllSlices / yieldsPerSecond;
            /*
             *    Calculate maximum number of Instructions to be executed
             *     by CPU before Yielding (because of the rounding used here,
             *     the specified Instructions per second may not be exactly obtained
             *      eg.    10000 insns/sec will be 333.333...,
             *              which * 30 yields/sec = 10000 insns/sec.
             *     However, after rounding, 10000 insns/sec will be 333,
             *     which * 30yields/sec = 9990 insns/sec.)
             */
            max_insnsPerSlice = Math.floor(msPerSlice * (insnsPerSecond / msAllSlices));
            // Ensure that rounding does not leave us with a CPU
            //    running at 0 Instructions per slice, otherwise nothing will happen!
            if (max_insnsPerSlice === 0) {
                max_insnsPerSlice = 1;
            }

            // Store new settings
            // FIXME: These are not used as FDE loop is self-checking:
            //        it should be self-calibrating though, calculating the
            //        optimum settings after each time-slice rather
            //        than checking Date.now() after every instruction
            this.insnsPerSecond = insnsPerSecond;
            this.yieldsPerSecond = yieldsPerSecond;
            this.msPerSlice = msPerSlice;
            this.max_insnsPerSlice = max_insnsPerSlice;
            this.msPerYield = msPerYield;
        },
        // For debugging purposes with Firebug/Chrome debugger etc.
        getState: function () {
            // Build DEBUG.COM-like Flags state text
            var textEFlags = (this.OF.get() ? "OV/1 " : "NV/0 ") +
                (this.DF.get() ? "DN/1 " : "UP/0 ") +
                (this.IF.get() ? "EI/1 " : "DI/0 ") +
                (this.SF.get() ? "NG/1 " : "PL/0 ") +
                (this.ZF.get() ? "ZR/1 " : "NZ/0 ") +
                (this.AF.get() ? "AC/1 " : "NA/0 ") +
                (this.PF.get() ? "PE/1 " : "PO/0 ") +
                (this.CF.get() ? "CY/1" : "NC/0");

            // Numbers used to ensure correct order
            return {
                "1 :: EAX": this.EAX.getHexString(),
                "2 :: EBX": this.EBX.getHexString(),
                "3 :: ECX": this.ECX.getHexString(),
                "4 :: EDX": this.EDX.getHexString(),
                "5 :: ESP": this.ESP.getHexString(),
                "6 :: EBP": this.EBP.getHexString(),
                "7 :: ESI": this.ESI.getHexString(),
                "8 :: EDI": this.EDI.getHexString(),
                "9 :: DS": this.DS.getHexString(),
                "10 :: ES": this.ES.getHexString(),
                "11 :: SS": this.SS.getHexString(),
                "12 :: CS": this.CS.getHexString(),
                "13 :: EIP": this.EIP.getHexString(),
                "14 :: EFLAGS": textEFlags
            };
        },
        // Set up the CPU - start fetch/execute cycle etc.
        init: function () {
            var machine = this.machine,
                cpu = this;

            // Config setting for max no. of DMA quantums (byte or word)
            //  that may be transferred in one bulk batch during Yield
            this.maxDMAQuantumsPerYield = machine.emu.getSetting("dma.maxQuantumsPerYield");
            if (typeof this.maxDMAQuantumsPerYield !== "number") {
                this.maxDMAQuantumsPerYield = 512;
            }

            function yieldManager() {
                // Start next set of Fetch-Decode-Execute cycles if CPU is not halted
                //    (will run until next Yield)
                if (!cpu.isHalted) {
                    cpu.fetchDecodeExecute();
                } else {
                    // Still process IRQs, DMA etc. when CPU halted
                    cpu.handleAsynchronousEvents();
                }

                // Run next time-slice as soon as possible
                self.setTimeout(yieldManager, 0);
            }

            // Don't start yield manager immediately; finish setup first
            self.setTimeout(yieldManager, 0);
        },
        // Decode one page of instructions (23)
        decodePage: function (offset) {
            var i,
                insn,
                CS = this.CS,
                decoder = this.decoder,
                asm = "";

            if (offset === undefined) {
                offset = this.EIP.get();
            }

            function read(offset, len) {
                return CS.readSegment(offset, len);
            }

            for (i = 0; i < 23 && offset <= 0xFFFF; ++i) {
                insn = Instruction.decode(decoder, read, offset, false, false);

                asm += util.sprintf("%08X: %s\n", offset, insn.toASM());

                offset += insn.getLength();
            }

            return asm;
        },
        // Private method; start next set of Fetch-Decode-Execute cycles up until next Yield is scheduled
        fetchDecodeExecute: function () {
            var machine = this.machine,
            // Address- & operand-size attributes (true = 32-bit, false = 16-bit)
                addressSizeAttr = false,
                operandSizeAttr = false,
            // CPU's instruction cache (for speed... !)
                cache_insn = this.cache_insn,
                insn,
                offset,
                CS = this.CS,
                EIP = this.EIP,
                decoder = this.decoder,
                functions = Execute.functions,
            // Total no. of instructions executed during this time-slice
                insns = 0,
                ticksSlice = Math.floor(1000 / 30),
                ticksNow = machine.getTimeMsecs(),
                ticksEndSlice = ticksNow + ticksSlice;

            // Also use next time-slice if we are already
            //    close to the end of this one
            if (ticksEndSlice - ticksNow < 3) { ticksEndSlice += ticksSlice; }

            // Fetcher
            // TODO: Currently performs memory mapping on every single read() call,
            //       which for decoder can be every byte! Need to optimise
            //       by memory mapping & then prefetching blocks of code
            function read(address, size) {
                return CS.readSegment(address, size);
            }

            do {
                // Resets for cached & uncached instructions (keep to a minimum!!)
                /** (None) **/

                // Offset is current Instruction Pointer
                offset = EIP.get();

                /*
                 *    Fast case; Cache hit - Instruction already decoded
                 *    into Instruction cache, just read from Instruction cache & exec
                 *
                 *    NB: Cache is cleared when CS register is set
                 *
                 *    TODO: detect (on memory writes) whether that byte in RAM
                 *    has been decoded, if so code is polymorphic, so (for now)
                 *    just delete rest of cache after the changed instruction
                 *    by setting the length property of the cache array
                 */
                /*insn = cache_insn[offset];

                if (insn) {
                    // Move pointer past Instruction
                    offset += insn.lenBytes;
                // Instruction needs to be decoded into cache
                } else {*/
                    // Decode & create new Instruction, then store in cache,
                    //  indexed by address for fast lookups later
                    insn = /*cache_insn[offset]
                        = */Instruction.decode(
                            decoder,
                            read,
                            offset,
                            addressSizeAttr,
                            operandSizeAttr
                        );

                    // POLYMORPHIC: Look up & store
                    //  execute function for Instruction
                    insn.execute = functions[insn.name];

                    // Move past decoded instruction
                    offset += insn.lenBytes;
                //}

                // Execute immediately
                EIP.set(offset);

                insn.execute(this);

                // FIXME
                if (CS.get() === 0xF000) {
                    // Skip BIOS-bochs-legacy _interactive_bootkey()
                    if (this.IP.get() === 0xE22E) { this.IP.set(0xE231); }
                }

                /* // Resume Flag
                if (this.RF.get()) {
                    this.RF.clear();
                } else {
                    // TODO: Handle debugging/breakpoints etc.
                }

                // Trap Flag
                if (this.TF.get()) {
                    // TODO: Handle debugging w/trap flag
                } */

                /*
                 * Internal total instruction counter for this time slice,
                 * for benchmarking and optimisation
                 */
                ++insns;

                /*
                 * Handle asynchronous events & check for end of slice
                 * after every so many instructions (otherwise we would only
                 * check during each yield, so only eg. 30 times/sec - RTC
                 * interrupt (if enabled) is every 244us,
                 * so approx. 4000 times/sec!)
                 */
                if ((insns % 40) === 0) {
                    // Stop CPU loop for this slice if we run out of time
                    if (Date.now() > ticksEndSlice) {
                        break;
                    }

                    this.handleAsynchronousEvents();
                }
            // Stop CPU loop if CPU is halted
            } while (!this.isHalted);

            // Benchmarking
            ++yps;
            ips += insns;
            if (ticksNow > (ticksLastUpdate + 1000) || this.isHalted) {
                (document.getElementById("performance") || {}).textContent =
                    "insns/sec: " + ips
                    + ", yields/sec: " + yps
                    + " :: " + (this.isHalted ? "HALTED" : "RUNNING");

                ips = yps = 0;
                ticksLastUpdate = ticksNow;
            }

            /** End of CPU loop: yield to host environment/the browser,
                allowing it to update the screen & fire DOM events etc. **/
        },
        // See end of .fetchDecodeExecute() / CPU loop
        handleAsynchronousEvents: function () {
            var idx,
                list,
                len,
                vector,
                quantums,
                maxQuantums,
                ticksNow,
                machine = this.machine,
                tmr;

            /*
             *    Priority 1: Hardware Reset and Machine Checks
             *    - RESET
             *    - Machine Check
             *    (NB: As in Bochs, jemul8 doesn't support these)
             */

            /*
             *    Priority 2: Trap on Task Switch
             *    - T flag in TSS is set
             */
            //if (BX_CPU_THIS_PTR debug_trap & BX_DEBUG_TRAP_TASK_SWITCH_BIT)
            //    exception(BX_DB_EXCEPTION, 0); // no error, not interrupt

            /*
             *    Priority 3: External Hardware Interventions
             *    - FLUSH
             *    - STOPCLK
             *    - SMI
             *    - INIT
             */
            //if (BX_CPU_THIS_PTR pending_SMI && ! BX_CPU_THIS_PTR smm_mode()) {
                // clear SMI pending flag and disable NMI when SMM was accepted
            //    BX_CPU_THIS_PTR pending_SMI = 0;
            //    enter_system_management_mode();
            //}
            //if (BX_CPU_THIS_PTR pending_INIT && ! BX_CPU_THIS_PTR disable_INIT) {
            //    #if BX_SUPPORT_VMX
            //    if (BX_CPU_THIS_PTR in_vmx_guest) {
            //    BX_ERROR(("VMEXIT: INIT pin asserted"));
            //    VMexit(0, VMX_VMEXIT_INIT, 0);
            //    }
            //    #endif
                // reset will clear pending INIT
            //    BX_CPU_THIS_PTR reset(BX_RESET_SOFTWARE);
            //}

            /*
             *    Priority 4: Traps on Previous Instruction
             *    - Breakpoints
             *    - Debug Trap Exceptions (TF flag set or data/IO breakpoint)
             */
            //if (BX_CPU_THIS_PTR debug_trap &&
            //    !(BX_CPU_THIS_PTR inhibit_mask & BX_INHIBIT_DEBUG_SHADOW)){
                // A trap may be inhibited on this boundary due to an instruction
                // which loaded SS.  If so we clear the inhibit_mask below
                // and don't execute this code until the next boundary.
            //    exception(BX_DB_EXCEPTION, 0); // no error, not interrupt
            //}

            /*
             *    Priority 5: External Interrupts
             *    - NMI Interrupts
             *    - Maskable Hardware Interrupts
             */
            /* ====== Hardware Interrupts / IRQs ====== */
            // Handle Non-Maskable Interrupts
            // FIXME: NMIs CAN be masked through a control flag
            if (this.NMI.get()) {
                this.NMI.lower(); // Will be handled now
                this.interrupt(
                    2,                           // Vector (NMI is always INT #2)
                    util.NON_MASKABLE_INTERRUPT, // Type
                    false,                       // Push error (no)
                    0                            // Error code (none)
                );
                // An NMI will wake the CPU if halted
                this.run();
            // Check interrupts are enabled/uninhibited & one is pending
            } else if (this.INTR.get() && this.IF.get()) {
                // Only EVER process one interrupt here: we have to allow
                //  the ISR to actually run!

                // (NB: This may set INTR with the next interrupt)
                vector = machine.pic.acknowledgeInterrupt();
                this.interrupt(
                    vector,                  // Vector
                    util.EXTERNAL_INTERRUPT, // Type
                    false,                   // Push error (no)
                    0                        // Error code (none)
                );
                // An enabled interrupt will wake the CPU if halted
                this.run();
            // Handle DMA
            } else if (machine.HRQ.get()) {
                // Assert Hold Acknowledge (HLDA) and go into a bus hold state,
                //  transferring up to the specified max. no of quantums
                //  (after which the bus is effectively released until the next yield)
                maxQuantums = this.maxDMAQuantumsPerYield;
                for (quantums = 0; quantums < maxQuantums; ++quantums) {
                    machine.dma.raiseHLDA();

                    // Stop if transfer is complete
                    if (!machine.HRQ.get()) { break; }
                }
            }
            /* ====== /Hardware Interrupts / IRQs ====== */

            /*
             *    Priority 6: Faults from fetching next instruction
             *    - Code breakpoint fault
             *    - Code segment limit violation (priority 7 on 486/Pentium)
             *    - Code page fault (priority 7 on 486/Pentium)
             */
            // (handled in main decode loop)

            /*
             *    Priority 7: Faults from decoding next instruction
             *    - Instruction length > 15 bytes
             *    - Illegal opcode
             *    - Coprocessor not available
             */
            // (handled in main decode loop etc)

            /*
             *    Priority 8: Faults on executing an instruction
             *    - Floating point execution
             *    - Overflow
             *    - Bound error
             *    - Invalid TSS
             *    - Segment not present
             *    - Stack fault
             *    - General protection
             *    - Data page fault
             *    - Alignment check
             */
            // (handled by rest of the code)

            /* ===== System timers ===== */
            // NB/TODO!: Checking for expired timers after EVERY SINGLE INSTRUCTION
            //    is not a good idea: however, only checking once per yield
            //    may not be often enough!
            ticksNow = machine.getTimeMsecs();
            for (idx = 0, list = machine.list_tmr, len = list.length; idx < len; ++idx) {
                // Ignore if unreg'd or inactive
                tmr = list[idx];
                if (!tmr || !tmr.isActive) { continue; }

                // Timer has expired: fire its handler
                if (tmr.ticksNextFire <= ticksNow) {
                    tmr.fn.call(tmr.obj_this, ticksNow);
                    // Continuous timers need their next expiry time calculating
                    if (tmr.isContinuous) {
                        tmr.ticksNextFire = ticksNow + tmr.intervalUsecs / 1000;
                        if (isNaN(tmr.ticksNextFire)) { debugger; }
                    // One-shot timers become deactivated after firing,
                    //    to ensure they do not trigger again
                    } else {
                        tmr.isActive = false;
                    }
                }
            }
            /* ===== /System timers ===== */
        },
        // Push data onto the Stack
        pushStack: function (val, len) {//debugger;
            // Pointer to top of Stack
            var SP = this.SS.cache.default32BitSize ? this.ESP : this.SP,
                ptrStack = SP.get();

            // Value pushed should be 16-bits or 32-bits (no sign extension)
            if (len === 1) { len = 2; }

            // Decrement by operand size
            ptrStack = (ptrStack - len) & SP.mask;

            // Update Stack pointer
            SP.set(ptrStack);

            // Write data to Stack top (SS:SP)
            this.SS.writeSegment(ptrStack, val, len);
        },
        // Pop data off the Stack
        popStack: function (len) {
            // Pointer to top of Stack
            var SP = this.SS.cache.default32BitSize ? this.ESP : this.SP,
                ptrStack = SP.get(),
                res;

            // Value popped should be 16-bits or 32-bits
            if (len !== 2 && len !== 4) {
                util.panic("CPU.popStack() :: Invalid no. of bytes to pop");
            }

            // Read data from Stack top (SS:SP)
            res = this.SS.readSegment(ptrStack, len);

            // Increment by operand size
            ptrStack = (ptrStack + len) & SP.mask;

            // Update Stack pointer
            SP.set(ptrStack);

            return res;
        },
        // Generate a CPU/software/hardware interrupt
        interrupt: function (vector, type, pushError, errorCode) {

            //util.debug("CPU.interrupt() :: Tripped INT 0x"
            //    + vector.toString(16).toUpperCase());

            // Protected-mode
            if (this.PE.get()) {
                throw new Error("CPU.interrupt() :: Protected mode not supported yet.");
            // Real-mode
            } else {
                this.realModeInterrupt(vector, pushError, errorCode);
            }
        },
        realModeInterrupt: function (vector, pushError, errorCode) {
            var IDTR = this.IDTR,
            // Calc offset as 4 bytes for every vector before this one
                offset = vector * 4,
                newCS,
                newIP;

            // Check whether vector is out of bounds (vector being read
            //    must be inside IDTR - its size is variable)
            if ((offset + 3) > IDTR.limit) {
                util.problem("CPU.realModeInterrupt() :: Error - "
                    + " interrupt vector is outside IDT limit");
                this.exception(util.GP_EXCEPTION, 0);
            }

            // Save current FLAGS and CS:IP (CPU state) on stack
            this.pushStack(this.FLAGS.get(), 2);
            this.pushStack(this.CS.get(), 2);
            this.pushStack(this.IP.get(), 2);

            // Get ISR's IP (& check it is within code segment limits)
            newIP = this.machine.mem.readLinear(IDTR.base + offset, 2, 0);
            if (newIP > this.CS.cache.limitScaled) {
                util.problem("CPU.realModeInterrupt() :: Error - "
                    + " interrupt vector is outside IDT limit");
                this.exception(util.GP_EXCEPTION, 0);
            }

            // Get ISR's CS
            newCS = this.machine.mem.readLinear(IDTR.base + offset + 2, 2, 0);

            // Jump to ISR CS:IP
            this.CS.set(newCS);
            this.EIP.set(newIP);

            this.IF.clear(); // Disable any maskable interrupts
            this.TF.clear(); // Disable any traps
            this.AC.clear(); // ???
            this.RF.clear();
        },
        // Return from Interrupt Service Routine (ISR)
        interruptReturn: function (is32) {
            var eflags,
                flags;

            if (!is32) {
                // Set all of EIP to zero-out high word
                this.EIP.set(this.popStack(2));
                this.CS.set(this.popStack(2)); // 16-bit pop

                // FIXME: Allow change of IOPL & IF here,
                //        disallow in many other places
                // Don't clear high EFLAGS word (is this right??)
                flags = this.popStack(2);

                this.FLAGS.set(flags);
            } else {
                this.EIP.set(this.popStack(4));
                // Yes, we must pop 32 bits but discard high word
                this.CS.set(this.popStack(4));
                eflags = this.popStack(4);

                // VIF, VIP, VM unchanged
                // FIXME: What is 0x1A0000 mask for? Can't remember...
                this.EFLAGS.set((eflags & 0x257FD5) | (this.EFLAGS.get() & 0x1A0000));
            }
        },
        // Current Privilege Level is the RPL of current code segment selector
        getCPL: function () {
            return this.CS.selector.rpl;
        }
    });

    // Exports
    return CPU;
});
