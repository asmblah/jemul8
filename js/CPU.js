/**
 * jemul8 - JavaScript x86 Emulator
 * http://jemul8.com/
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*global clearImmediate, define, setImmediate */
define([
    "js/util",
    "js/CPU/CPUException",
    "js/CPU/CPUHalt",
    "js/EventEmitter",
    "js/core/classes/cpu/execute",
    "js/core/classes/cpu/global_table_register",
    "js/core/classes/cpu/lazy_flag",
    "js/core/classes/cpu/lazy_flags_register",
    "js/core/classes/cpu/local_table_register",
    "js/core/classes/cpu/segreg",
    "js/core/classes/subregister",
    "js/core/classes/cpu/unlazy_flag",
    "js/Pin",
    "js/Promise",
    "js/Register",
    "vendor/setImmediate/setImmediate"
], function (
    util,
    CPUException,
    CPUHalt,
    EventEmitter,
    LegacyExecute,
    LegacyGlobalTableRegister,
    LegacyLazyFlag,
    LegacyLazyFlagRegister,
    LegacyLocalTableRegister,
    LegacySegmentRegister,
    LegacySubRegister,
    LegacyUnlazyFlag,
    Pin,
    Promise,
    Register
) {
    "use strict";

    var BRANCHING_INSTRUCTIONS = (function (names) {
            var hash = {};

            util.each(names, function (name) {
                hash[name] = true;
            });

            return hash;
        }([
            "CALLF",
            "CALLN",
            "HLT",
            //"IN",
            //"INS",
            "INT",
            "INTO",
            "IRET",
            "JO",
            "JNO",
            "JB",
            "JNB",
            "JE",
            "JNE",
            "JBE",
            "JNBE",
            "JS",
            "JNS",
            "JP",
            "JNP",
            "JL",
            "JNL",
            "JLE",
            "JNLE",
            "JCXZ",
            "JMPF",
            "JMPN",
            "JMPS",
            "LOOP",
            "LOOPE",
            "LOOPNE",
            //"OUT",
            //"OUTS",
            "RETF",
            "RETF_P",
            "RETN",
            "RETN_P"
        ])),
        DIVIDE_ERROR = 0,
        INSN_LIST = [];

    function CPU(system, io, memory, decoder, clock, options) {
        /*jshint bitwise: false */
        var index,
            registers = {};

        EventEmitter.call(this);

        this.clock = clock;
        this.currentInstructionOffset = 0;
        this.decoder = decoder;
        this.intr = new Pin();
        this.io = io;
        this.memory = memory;
        this.options = options;
        this.pages = [];
        this.registers = registers;
        this.running = false;
        this.stats = {
            fragmentHitsPerSecond: 0,
            fragmentMissesPerSecond: 0,
            instructionsPerSecond: 0,
            microsecondsLastUpdate: 0,
            yieldsPerSecond: 0
        };
        this.system = system;
        this.timeout = null;

        this.yieldsPerSecond = null;
        this.yieldDurationMicroseconds = null;
        this.timeSliceDurationMicroseconds = null;

        registers.cs = new LegacySegmentRegister("CS", 2); // Code segment
        registers.ds = new LegacySegmentRegister("DS", 2); // Data segment
        registers.ss = new LegacySegmentRegister("SS", 2); // Stack segment
        registers.es = new LegacySegmentRegister("ES", 2); // Extra segment
        registers.fs = new LegacySegmentRegister("FS", 2); // "FS" segment
        registers.gs = new LegacySegmentRegister("GS", 2); // "GS" segment

        registers.eax = new Register(4, "EAX");
        registers.ax = registers.eax.createSubRegister(0, 2, "AX");
        registers.ah = registers.eax.createSubRegister(1, 1, "AH");
        registers.al = registers.eax.createSubRegister(0, 1, "AL");

        registers.ecx = new Register(4, "ECX");
        registers.cx = registers.ecx.createSubRegister(0, 2, "CX");
        registers.ch = registers.ecx.createSubRegister(1, 1, "CH");
        registers.cl = registers.ecx.createSubRegister(0, 1, "CL");

        registers.ebx = new Register(4, "EBX");
        registers.bx = registers.ebx.createSubRegister(0, 2, "BX");
        registers.bh = registers.ebx.createSubRegister(1, 1, "BH");
        registers.bl = registers.ebx.createSubRegister(0, 1, "BL");

        registers.edx = new Register(4, "EDX");
        registers.dx = registers.edx.createSubRegister(0, 2, "DX");
        registers.dh = registers.edx.createSubRegister(1, 1, "DH");
        registers.dl = registers.edx.createSubRegister(0, 1, "DL");

        registers.esp = new Register(4, "ESP");
        registers.sp = registers.esp.createSubRegister(0, 2, "SP");
        registers.ebp = new Register(4, "EBP");
        registers.bp = registers.ebp.createSubRegister(0, 2, "BP");
        registers.esi = new Register(4, "ESI");
        registers.si = registers.esi.createSubRegister(0, 2, "SI");
        registers.edi = new Register(4, "EDI");
        registers.di = registers.edi.createSubRegister(0, 2, "DI");

        registers.eip = new Register(4, "EIP");
        registers.ip = registers.eip.createSubRegister(0, 2, "IP");

        // EFlags (32-bit) register
        registers.eflags = new LegacyLazyFlagRegister("EFLAGS", 4);
        // Flags (16-bit) register
        registers.flags = new LegacySubRegister("FLAGS", 2, registers.eflags, 0xFFFF, 0);
        // Carry Flag
        registers.cf = registers.eflags.install(new LegacyLazyFlag("CF", registers.eflags, 0));
        /* ==== Gap ==== */
        registers.eflags.install(new LegacyUnlazyFlag(null, registers.eflags, 1));
        /* ==== /Gap ==== */
        // Parity Flag
        registers.pf = registers.eflags.install(new LegacyLazyFlag("PF", registers.eflags, 2));
        /* ==== Gap ==== */
        registers.eflags.install(new LegacyUnlazyFlag(null, registers.eflags, 3));
        /* ==== /Gap ==== */
        // Auxiliary Flag
        registers.af = registers.eflags.install(new LegacyLazyFlag("AF", registers.eflags, 4));
        /* ==== Gap ==== */
        registers.eflags.install(new LegacyUnlazyFlag(null, registers.eflags, 5));
        /* ==== /Gap ==== */
        // Zero Flag
        registers.zf = registers.eflags.install(new LegacyLazyFlag("ZF", registers.eflags, 6));
        // Sign Flag
        registers.sf = registers.eflags.install(new LegacyLazyFlag("SF", registers.eflags, 7));
        // Trap Flag (Single Step)
        registers.tf = registers.eflags.install(new LegacyUnlazyFlag("TF", registers.eflags, 8));
        // Interrupt Flag
        registers.if = registers.eflags.install(new LegacyUnlazyFlag("IF", registers.eflags, 9));
        // Direction Flag
        registers.df = registers.eflags.install(new LegacyUnlazyFlag("DF", registers.eflags, 10));
        // Overflow Flag
        registers.of = registers.eflags.install(new LegacyLazyFlag("OF", registers.eflags, 11));
        // IOPL (I/O Privilege Level) Flag - Intel 286+ only
        //    NB: this is a 2-bit value (privilege level - eg. level 0 is OS), not a flag
        registers.eflags.install(new LegacyUnlazyFlag("IOPL", registers.eflags, 12));
        registers.eflags.install(new LegacyUnlazyFlag("IOPL2", registers.eflags, 13));
        // NT (Nested Task) Flag - Intel 286+ only
        registers.nt = registers.eflags.install(new LegacyUnlazyFlag("NT", registers.eflags, 14));
        /* ==== Gap ==== */
        registers.eflags.install(new LegacyUnlazyFlag(null, registers.eflags, 15));
        /* ==== /Gap ==== */
        // Resume Flag
        registers.rf = registers.eflags.install(new LegacyUnlazyFlag("RF", registers.eflags, 16));
        // Virtual-8086 Mode Flag
        registers.vm = registers.eflags.install(new LegacyUnlazyFlag("VM", registers.eflags, 17));
        // Alignment-Check (486SX+ only)
        registers.ac = registers.eflags.install(new LegacyUnlazyFlag("AC", registers.eflags, 18));
        // Virtual Interrupt Flag (Pentium+)
        registers.vif = registers.eflags.install(new LegacyUnlazyFlag("VIF", registers.eflags, 19));
        // Virtual Interrupt Pending Flag (Pentium+)
        registers.vip = registers.eflags.install(new LegacyUnlazyFlag("VIP", registers.eflags, 20));
        // Identification Flag (Pentium+)
        registers.id = registers.eflags.install(new LegacyUnlazyFlag("ID", registers.eflags, 21));

        /* ==== Gap ==== */
        registers.eflags.install(new LegacyUnlazyFlag(null, registers.eflags, 22));
        registers.eflags.install(new LegacyUnlazyFlag(null, registers.eflags, 23));
        registers.eflags.install(new LegacyUnlazyFlag(null, registers.eflags, 24));
        registers.eflags.install(new LegacyUnlazyFlag(null, registers.eflags, 25));
        registers.eflags.install(new LegacyUnlazyFlag(null, registers.eflags, 26));
        registers.eflags.install(new LegacyUnlazyFlag(null, registers.eflags, 27));
        registers.eflags.install(new LegacyUnlazyFlag(null, registers.eflags, 28));
        registers.eflags.install(new LegacyUnlazyFlag(null, registers.eflags, 29));
        registers.eflags.install(new LegacyUnlazyFlag(null, registers.eflags, 30));
        registers.eflags.install(new LegacyUnlazyFlag(null, registers.eflags, 31));
        /* ==== /Gap ==== */

        // Global Descriptor Table Register
        registers.gdtr = new LegacyGlobalTableRegister("GDTR");
        // Interrupt Descriptor Table Register
        registers.idtr = new LegacyGlobalTableRegister("IDTR");
        // Local Descriptor Table Register
        registers.ldtr = new LegacyLocalTableRegister("LDTR", 4);
        // Task Register
        registers.tr = new LegacySegmentRegister("TR", 2);

        // Task Descriptor Register - a fake segment register used for loading TSS or Task Gate descriptors
        registers.tdr = new LegacySegmentRegister("TDR", 2);

        // Control Register 0
        registers.cr0 = new LegacyLazyFlagRegister("CR0", 4);

        // Machine Status Word
        registers.msw = new LegacySubRegister("MSW", 2, registers.cr0, 0xFFFF, 0);

        // Protected Mode Enable
        //  (If 1, system is in Protected Mode, else system is in Real Mode)
        registers.pe = registers.cr0.install(new LegacyUnlazyFlag("PE", registers.cr0, 0));
        // Monitor co-Processor
        //  (Controls interaction of WAIT/FWAIT Instructions
        //  with TS Flag in CR0)
        registers.mp = registers.cr0.install(new LegacyUnlazyFlag("MP", registers.cr0, 1));
        // Emulation
        registers.em = registers.cr0.install(new LegacyUnlazyFlag("EM", registers.cr0, 2));
        // Task Switched
        registers.ts = registers.cr0.install(new LegacyUnlazyFlag("TS", registers.cr0, 3));
        // Extension Type
        registers.et = registers.cr0.install(new LegacyUnlazyFlag("ET", registers.cr0, 4));
        // Numeric Error
        //  (Enable internal x87 floating point error reporting when set,
        //    else enables PC style x87 error detection)
        registers.ne = registers.cr0.install(new LegacyUnlazyFlag("NE", registers.cr0, 5));

        /* ==== Gap ==== */
        registers.cr0.install(new LegacyUnlazyFlag(null, registers.cr0, 6));
        registers.cr0.install(new LegacyUnlazyFlag(null, registers.cr0, 7));
        registers.cr0.install(new LegacyUnlazyFlag(null, registers.cr0, 8));
        registers.cr0.install(new LegacyUnlazyFlag(null, registers.cr0, 9));
        registers.cr0.install(new LegacyUnlazyFlag(null, registers.cr0, 10));
        registers.cr0.install(new LegacyUnlazyFlag(null, registers.cr0, 11));
        registers.cr0.install(new LegacyUnlazyFlag(null, registers.cr0, 12));
        registers.cr0.install(new LegacyUnlazyFlag(null, registers.cr0, 13));
        registers.cr0.install(new LegacyUnlazyFlag(null, registers.cr0, 14));
        registers.cr0.install(new LegacyUnlazyFlag(null, registers.cr0, 15));
        /* ==== /Gap ==== */

        // Write Protect
        registers.wp = registers.cr0.install(new LegacyUnlazyFlag("WP", registers.cr0, 16));

        /* ==== Gap ==== */
        registers.cr0.install(new LegacyUnlazyFlag(null, registers.cr0, 17));
        /* ==== /Gap ==== */

        // Alignment Mask
        registers.AM = new LegacyUnlazyFlag("AM", registers.cr0, 18);

        /* ==== Gap ==== */
        registers.cr0.install(new LegacyUnlazyFlag(null, registers.cr0, 19));
        registers.cr0.install(new LegacyUnlazyFlag(null, registers.cr0, 20));
        registers.cr0.install(new LegacyUnlazyFlag(null, registers.cr0, 21));
        registers.cr0.install(new LegacyUnlazyFlag(null, registers.cr0, 22));
        registers.cr0.install(new LegacyUnlazyFlag(null, registers.cr0, 23));
        registers.cr0.install(new LegacyUnlazyFlag(null, registers.cr0, 24));
        registers.cr0.install(new LegacyUnlazyFlag(null, registers.cr0, 25));
        registers.cr0.install(new LegacyUnlazyFlag(null, registers.cr0, 26));
        registers.cr0.install(new LegacyUnlazyFlag(null, registers.cr0, 27));
        registers.cr0.install(new LegacyUnlazyFlag(null, registers.cr0, 28));
        /* ==== /Gap ==== */

        // Not-write through
        registers.nw = registers.cr0.install(new LegacyUnlazyFlag("NW", registers.cr0, 29));
        // Cache Disable
        registers.cd = registers.cr0.install(new LegacyUnlazyFlag("CD", registers.cr0, 30));
        // Paging - (If 1, enable paging & use CR3, else disable paging)
        registers.pg = registers.cr0.install(new LegacyUnlazyFlag("PG", registers.cr0, 31));

        // Control Register 1 (Reserved)
        registers.cr1 = new Register(4, "CR1");
        // Control Register 2 (PFLA - Page Fault Linear Address)
        registers.cr2 = new Register(4, "CR2");
        // Control Register 3 (Virtual addresses -> Physical addresses)
        registers.cr3 = new Register(4, "CR3");
        // Control Register 4
        registers.cr4 = new Register(4, "CR4");

        // Debug Register 0
        registers.dr0 = new Register(4, "DR0");
        // Debug Register 1
        registers.dr1 = new Register(4, "DR1");
        // Debug Register 2
        registers.dr2 = new Register(4, "DR2");
        // Debug Register 3
        registers.dr3 = new Register(4, "DR3");
        // Debug Register 4
        registers.dr4 = new Register(4, "DR4");
        // Debug Register 5
        registers.dr5 = new Register(4, "DR5");
        // Debug Register 6
        registers.dr6 = new Register(4, "DR6");
        // Debug Register 7
        registers.dr7 = new Register(4, "DR7");

        /* ======= Test Registers ======= */
        // NB: Removed in newer CPUs & only numbered from 4 -> 7
        // Test Register 4
        registers.tr4 = new Register(4, "TR4");
        // Test Register 5
        registers.tr5 = new Register(4, "TR5");
        // Test Register 6
        registers.tr6 = new Register(4, "TR6");
        // Test Register 7
        registers.tr7 = new Register(4, "TR7");
        /* ======= /Test Registers ======= */

        registers.cr3.set = function (value) {
            memory.setPageDirectoryAddress(value);

            Register.prototype.set.call(this, value);
        };

        registers.pg.clear = function () {
            memory.disablePaging();

            LegacyUnlazyFlag.prototype.clear.call(this);
        };
        registers.pg.set = function () {
            memory.enablePaging();

            LegacyUnlazyFlag.prototype.set.call(this);
        };
        registers.pg.setBin = function (set) {
            if (set) {
                memory.enablePaging();
            } else {
                memory.disablePaging();
            }

            LegacyUnlazyFlag.prototype.setBin.call(this, set);
        };

        this.legacyCPU = (function (cpu) {
            var legacyCPU = {
                    ES: registers.es,
                    CS: registers.cs,
                    SS: registers.ss,
                    DS: registers.ds,
                    FS: registers.fs,
                    GS: registers.gs,

                    AL: registers.al,
                    AH: registers.ah,
                    CL: registers.cl,
                    CH: registers.ch,
                    BL: registers.bl,
                    BH: registers.bh,
                    DL: registers.dl,
                    DH: registers.dh,

                    AX: registers.ax,
                    EAX: registers.eax,
                    CX: registers.cx,
                    ECX: registers.ecx,
                    BX: registers.bx,
                    EBX: registers.ebx,
                    DX: registers.dx,
                    EDX: registers.edx,
                    SP: registers.sp,
                    ESP: registers.esp,
                    BP: registers.bp,
                    EBP: registers.ebp,
                    SI: registers.si,
                    ESI: registers.esi,
                    DI: registers.di,
                    EDI: registers.edi,

                    EIP: registers.eip,
                    IP: registers.ip,

                    CR0: registers.cr0,
                    CR1: registers.cr1,
                    CR2: registers.cr2,
                    CR3: registers.cr3,
                    CR4: registers.cr4,

                    NT: registers.nt,
                    TS: registers.ts,

                    MSW: registers.msw,

                    GDTR: registers.gdtr,
                    IDTR: registers.idtr,
                    LDTR: registers.ldtr,

                    TR: registers.tr,
                    TDR: registers.tdr,

                    EFLAGS: registers.eflags,
                    FLAGS: registers.flags,

                    CF: registers.cf,
                    PF: registers.pf,
                    AF: registers.af,
                    ZF: registers.zf,
                    SF: registers.sf,
                    TF: registers.tf,
                    IF: registers.if,
                    DF: registers.df,
                    OF: registers.of,
                    PE: registers.pe,
                    VM: registers.vm,

                    exception: function (vector, code) {
                        cpu.exception(vector, code);
                    },

                    fetchRawDescriptor: function (selector, exceptionType) {
                        return cpu.fetchRawDescriptor(selector, exceptionType);
                    },

                    getCPL: function () {
                        return 0;
                    },

                    halt: function () {
                        cpu.halt();
                    },

                    interrupt: function (vector) {
                        cpu.interrupt(vector);
                    },

                    // Return from Interrupt Service Routine (ISR)
                    interruptReturn: function (is32) {
                        cpu.interruptReturn(is32);
                    },

                    popStack: function (length) {
                        return cpu.popStack(length);
                    },

                    purgeAllPages: function () {
                        cpu.purgeAllPages();
                    },

                    pushStack: function (value, length) {
                        cpu.pushStack(value, length);
                    }
                },
                legacyMachine = {
                    cpu: legacyCPU,
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
                        readPhysicalBlock: function (physicalAddress, toBuffer, size) {
                            return memory.readPhysicalBlock(physicalAddress, toBuffer, size);
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
                };

            legacyCPU.machine = legacyMachine;

            util.each([
                registers.cs,
                registers.ds,
                registers.ss,
                registers.es,
                registers.fs,
                registers.gs,

                registers.tr,
                registers.tdr,

                registers.cf,
                registers.pf,
                registers.af,
                registers.zf,
                registers.sf,
                registers.of
            ], function (legacyObject) {
                legacyObject.cpu = legacyCPU;
            });

            return legacyCPU;
        }(this));
    }

    util.inherit(CPU).from(EventEmitter);

    util.extend(CPU, {
        DIVIDE_ERROR: DIVIDE_ERROR
    });

    util.extend(CPU.prototype, {
        cycle: function () {
            var cpu = this,
                useRecompiler = true;

            if (useRecompiler) {
                cpu.cycleWithRecompiler();
            } else {
                cpu.cycleWithInterpreter();
            }
        },

        updateStats: function (instructionsThisSlice, fragmentMissesThisSlice, fragmentHitsThisSlice) {
            var cpu = this;

            // Benchmarking
            cpu.stats.yieldsPerSecond++;
            cpu.stats.instructionsPerSecond += instructionsThisSlice;
            cpu.stats.fragmentHitsPerSecond += fragmentHitsThisSlice;
            cpu.stats.fragmentMissesPerSecond += fragmentMissesThisSlice;

            if (cpu.clock.getMicrosecondsNow() > (cpu.stats.microsecondsLastUpdate + 1000000) || !cpu.running) {
                if (util.global.document) {
                    (util.global.document.getElementById("performance") || {}).textContent =
                        "insns/sec: " + cpu.stats.instructionsPerSecond + ", " +
                        "yields/sec: " + cpu.stats.yieldsPerSecond + ", " +
                        "jit frag hits/sec: " + cpu.stats.fragmentHitsPerSecond + ", " +
                        "jit frag misses/sec: " + cpu.stats.fragmentMissesPerSecond +
                        " :: " + (cpu.running ? "RUNNING" : "HALTED");

                    cpu.stats.fragmentHitsPerSecond = 0;
                    cpu.stats.fragmentMissesPerSecond = 0;
                    cpu.stats.instructionsPerSecond = 0;
                    cpu.stats.yieldsPerSecond = 0;
                    cpu.stats.microsecondsLastUpdate = cpu.clock.getMicrosecondsNow();
                }
            }
        },

        cycleWithInterpreter: function () {
            /*global Uint8Array */
            /*jshint bitwise: false */
            var cpu = this,
                endOfSliceMicroseconds = cpu.clock.getMicrosecondsNow() + cpu.timeSliceDurationMicroseconds,
                legacyCPU = cpu.legacyCPU,
                registers = cpu.registers,
                cs = registers.cs,
                decoder = cpu.decoder,
                ip,
                instruction,
                instructionsThisSlice = 0,
                is32Bit,
                linearOffset,
                memoryBufferDataView,
                memoryBufferByteView,
                offset,
                page,
                pages = cpu.pages,
                physicalOffset;

            if (cpu.running) {
                memoryBufferDataView = cpu.memory.getView();
                memoryBufferByteView = new Uint8Array(memoryBufferDataView.buffer);
            }

            while (cpu.running) {
                is32Bit = cs.cache.default32BitSize;
                ip = is32Bit ? registers.eip : registers.ip;
                offset = ip.get();

                linearOffset = cs.cache.base + offset;

                physicalOffset = cpu.memory.linearToPhysical(linearOffset);

                page = physicalOffset >>> 8;

                if (!pages[page]) {
                    pages[page] = [];
                }

                instruction = pages[page][physicalOffset];

                if (!instruction) {
                    instruction = decoder.decode(memoryBufferByteView, physicalOffset, is32Bit);

                    pages[page][physicalOffset] = instruction;
                }

                cpu.currentInstructionOffset = offset;

                // Update (e)ip before executing instruction
                ip.set(offset + instruction.length);

                try {
                    if (!instruction.execute) {
                        // Invalid or undefined opcode
                        cpu.exception(util.UD_EXCEPTION, null);
                    }

                    instruction.execute(legacyCPU);
                } catch (error) {
                    if (error instanceof CPUHalt) {
                        // CPU has halted - stop
                        break;
                    }

                    // Ignore if a CPU exception, as we will have handled it already.
                    // The failed instruction should be retried on the next cycle
                    if (!(error instanceof CPUException)) {
                        throw error;
                    }
                }

                /*
                 * Internal total instruction counter for this time slice,
                 * for benchmarking and optimisation
                 */
                ++instructionsThisSlice;

                /*
                 * Handle asynchronous events & check for end of slice
                 * after every so many instructions (otherwise we would only
                 * check during each yield, so only eg. 30 times/sec - RTC
                 * interrupt (if enabled) is every 244us,
                 * so approx. 4000 times/sec!)
                 */
                if ((instructionsThisSlice % 5000) === 0) {
                    // Stop CPU loop for this slice if we run out of time
                    if (cpu.clock.getMicrosecondsNow() > endOfSliceMicroseconds) {
                        break;
                    }

                    cpu.handleAsynchronousEvents();
                }
            }

            // Set timeout to perform next set of CPU cycles after yield
            cpu.timeout = setImmediate(function () {
                cpu.timeout = null;
                cpu.cycleWithInterpreter();
            });

            cpu.handleAsynchronousEvents();

            cpu.updateStats(instructionsThisSlice, 0, 0);
        },

        cycleWithRecompiler: function () {
            /*global Uint8Array */
            /*jshint bitwise: false */
            var cpu = this,
                endOfSliceMicroseconds = cpu.clock.getMicrosecondsNow() + cpu.timeSliceDurationMicroseconds,
                fragmentHitsThisSlice = 0,
                fragmentMissesThisSlice = 0,
                legacyCPU = cpu.legacyCPU,
                registers = cpu.registers,
                cs = registers.cs,
                decoder = cpu.decoder,
                fragment,
                fragmentOffset,
                index,
                ip,
                instruction,
                instructions,
                instructionsThisFragment,
                instructionsThisSlice = 0,
                is32Bit,
                isBranch,
                linearOffset,
                memoryBufferDataView,
                memoryBufferByteView,
                offset,
                page,
                pages = cpu.pages,
                parts = [],
                physicalOffset;

            if (cpu.running) {
                memoryBufferDataView = cpu.memory.getView();
                memoryBufferByteView = new Uint8Array(memoryBufferDataView.buffer);
            }

            while (cpu.running) {
                is32Bit = cs.cache.default32BitSize;
                ip = is32Bit ? registers.eip : registers.ip;
                offset = ip.get();

                linearOffset = cs.cache.base + offset;

                physicalOffset = cpu.memory.linearToPhysical(linearOffset);

                page = physicalOffset >>> 8;

                if (!pages[page]) {
                    pages[page] = [];
                }

                fragment = pages[page][physicalOffset];

                if (fragment && fragment !== true && fragment.is32Bit !== is32Bit) {
                    fragment = null;
                }

                if (!fragment) {
                    // Instruction has not been run yet; record hit and interpret
                    pages[page][physicalOffset] = true;

                    instruction = decoder.decode(memoryBufferByteView, physicalOffset, is32Bit);

                    cpu.currentInstructionOffset = offset;

                    // Update (e)ip before executing instruction
                    ip.set(offset + instruction.length);

                    try {
                        if (!instruction.execute) {
                            // Invalid or undefined opcode
                            cpu.exception(util.UD_EXCEPTION, null);
                        }

                        instruction.execute(legacyCPU);
                    } catch (error) {
                        if (error instanceof CPUHalt) {
                            // CPU has halted - stop
                            break;
                        }

                        // Ignore if a CPU exception, as we will have handled it already.
                        // The failed instruction should be retried on the next cycle
                        if (!(error instanceof CPUException)) {
                            throw error;
                        }
                    }

                    instructionsThisFragment = 1;
                    fragmentMissesThisSlice++;
                } else {
                    if (fragment === true) {
                        // Instruction was previously hit; hot code found - compile!
                        instructions = [];
                        parts.length = 0;

                        fragmentOffset = physicalOffset;

                        for (index = 0; index < 128; index++) {
                            // TODO: When switching to protected mode, make sure the far jump
                            //       causes the current fragment to be exited.
                            //       (Clearing the entire fragment cache shouldn't be needed,
                            //       as caching is done by physical address, and the data there
                            //       will not change just because PE is set to 1.)

                            instruction = decoder.decode(memoryBufferByteView, fragmentOffset, is32Bit);

                            if (!instruction.execute) {
                                // Invalid or undefined opcode
                                cpu.exception(util.UD_EXCEPTION, null);
                            }

                            instructions[index] = instruction;

                            isBranch = BRANCHING_INSTRUCTIONS[instruction.opcodeData.name];

                            parts.push("cpu.currentInstructionOffset = " + offset + "; ");

                            offset += instruction.length;
                            fragmentOffset += instruction.length;

                            parts.push("ip.set(" + offset + ");\n");
                            parts.push("instructions[" + index + "].execute(legacyCPU);\n");

                            if (isBranch) {
                                index++; // Keep instruction count consistent
                                break;
                            }
                        }

                        /*jshint evil: true */
                        fragment = new Function(
                            "cpu, ip, instructions, legacyCPU",
                            "return function () {\n" + parts.join("") + "};"
                        )(
                            cpu,
                            ip,
                            instructions,
                            legacyCPU
                        );
                        fragment.instructionCount = index;
                        fragment.is32Bit = is32Bit;

                        pages[page][physicalOffset] = fragment;
                        fragmentMissesThisSlice++;
                    } else {
                        fragmentHitsThisSlice++;
                    }

                    try {
                        fragment();
                    } catch (error) {
                        if (error instanceof CPUHalt) {
                            // CPU has halted - stop
                            break;
                        }

                        // Ignore if a CPU exception, as we will have handled it already.
                        // The failed instruction should be retried on the next cycle
                        if (!(error instanceof CPUException)) {
                            throw error;
                        }
                    }

                    instructionsThisFragment = fragment.instructionCount;
                }

                /*
                 * Internal instruction count stats for this time slice,
                 * for benchmarking and optimisation
                 */
                instructionsThisSlice += instructionsThisFragment;

                /*
                 * Handle asynchronous events & check for end of slice
                 * after every so many instructions (otherwise we would only
                 * check during each yield, so only eg. 30 times/sec - RTC
                 * interrupt (if enabled) is every 244us,
                 * so approx. 4000 times/sec!)
                 */
                if ((((instructionsThisSlice / 1000) >>> 0) % 5) === 0) { // Roughly every 5000 instructions
                    // Stop CPU loop for this slice if we run out of time
                    if (cpu.clock.getMicrosecondsNow() > endOfSliceMicroseconds) {
                        break;
                    }

                    cpu.handleAsynchronousEvents();
                }
            }

            // Set timeout to perform next set of CPU cycles after yield
            cpu.timeout = setImmediate(function () {
                cpu.timeout = null;
                cpu.cycleWithRecompiler();
            });

            cpu.handleAsynchronousEvents();

            cpu.updateStats(instructionsThisSlice, fragmentMissesThisSlice, fragmentHitsThisSlice);
        },

        // Decode one page of instructions (23)
        decodePage: function (offset, is32Bit) {
            var cpu = this,
                registers = cpu.registers,
                i,
                cs = registers.cs,
                decoder = cpu.decoder,
                asm = "",
                linearOffset,
                memoryBufferDataView = cpu.memory.getView(),
                memoryBufferByteView = new Uint8Array(memoryBufferDataView.buffer),
                instruction,
                ip = is32Bit ? registers.eip : registers.ip,
                physicalOffset;

            if (offset === undefined) {
                offset = ip.get();
            }

            for (i = 0; i < 23; ++i) {
                linearOffset = cs.cache.base + offset;
                physicalOffset = cpu.memory.linearToPhysical(linearOffset);

                try {
                    instruction = decoder.decode(memoryBufferByteView, physicalOffset, is32Bit);
                } catch (e) {
                    instruction = {
                        length: 1,
                        toASM: function () {
                            return "#UNKNOWN";
                        }
                    };
                }

                asm += util.hexify(offset) + ": " + instruction.toASM() + "\n";

                offset += instruction.length;
            }

            return asm;
        },

        exception: function (vector, code) {
            var cpu = this,
                registers = cpu.registers;

            // Point to the instruction that caused the exception (we'll have jumped past it by now)
            registers.eip.set(cpu.currentInstructionOffset);

            cpu.interrupt(vector);

            // Push a code if the exception provides one - but never in real mode
            if (code !== null && registers.pe.get()) {
                if (typeof code !== 'number') {
                    throw new Error('Invalid exception code "' + code + '" given');
                }

                cpu.pushStack(code, 4);
            }

            cpu.emit("exception", vector);

            throw new CPUException(vector, code);
        },

        fetchRawDescriptor: function (selector/*, exceptionType*/) {
            var cpu = this,
                index = selector.index,
                memory = cpu.memory,
                offset;

            // GDT is the table to fetch from
            if (selector.table === 0) {
                /*if ((index * 8 + 7) > cpu.GDTR.limit) {
                    util.problem(util.sprintf(
                        "Memory.fetchRawDescriptor() :: GDT: index (%x) %x > limit (%x)",
                        index * 8 + 7,
                        index,
                        cpu.GDTR.limit
                    ));
                    cpu.exception(exceptionType, selector.getValue() & 0xFFFC);
                }*/
                // Calculate address of raw descriptor to read in memory
                offset = cpu.legacyCPU.GDTR.base + index * 8;
            // LDT is the table to fetch from
            } else {
                // For LDT, we have to check whether it is valid first
                /*if (!cpu.LDTR.isValid()) {
                    util.problem("Memory.fetchRawDescriptor(): LDTR.valid = false");
                    cpu.exception(exceptionType, selector.getValue() & 0xFFFC);
                }
                if ((index * 8 + 7) > cpu.LDTR.cache.limitScaled) {
                    util.problem(util.sprintf(
                        "Memory.fetchRawDescriptor() :: LDT: index (%x) %x > limit (%x)",
                        index * 8 + 7,
                        index,
                        cpu.LDTR.cache.limitScaled
                    ));
                    cpu.exception(exceptionType, selector.getValue() & 0xFFFC);
                }*/
                // Calculate address of raw descriptor to read in memory
                offset = cpu.legacyCPU.LDTR.cache.base + index * 8;
            }

            //raw_descriptor = system_read_qword(offset);

            //*dword1 = GET32L(raw_descriptor);
            //*dword2 = GET32H(raw_descriptor);

            // Pass back 64-bit result as two 32-bit values
            return {
                dword1: memory.readLinear(offset, 4, 0),
                dword2: memory.readLinear(offset + 4, 4, 0)
            };
        },

        getRegisters: function () {
            return this.registers;
        },

        halt: function () {
            var cpu = this;

            cpu.running = false;
            cpu.emit("halt");

            return cpu;
        },

        handleAsynchronousEvents: function () {
            var cpu = this,
                system = cpu.system;

            system.handleAsynchronousEvents();

            cpu.serviceIRQs();

            // Handle DMA
            if (system.isHRQHigh()) {
                (function () {
                    var quantums;

                    // Assert Hold Acknowledge (HLDA) and go into a bus hold state,
                    //  transferring up to the specified max. no of quantums
                    //  (after which the bus is effectively released until the next yield)
                    for (quantums = 0; quantums < 512; ++quantums) {
                        system.raiseHLDA();

                        // Stop if transfer is complete
                        if (!system.isHRQHigh()) {
                            break;
                        }
                    }
                }());
            }
        },

        init: function () {
            var cpu = this,
                decoder = cpu.decoder,
                promise = new Promise();

            cpu.yieldsPerSecond = 60;
            cpu.yieldDurationMicroseconds = 1;
            cpu.timeSliceDurationMicroseconds = (1000000 - cpu.yieldDurationMicroseconds * cpu.yieldsPerSecond) / (cpu.yieldsPerSecond + 1);

            decoder.on("pre init", function (args) {
                /*jshint bitwise: false */

                var partials = args.partials,
                    readNonPointer = function (/*offset, size*/) {
                        // NB: Immediate value will be zero
                        //     if none specified in instruction
                        return this.immed + (this.reg ? this.reg.get() : 0);
                    },
                    readWithPointer = function (offset, size) {
                        return this.effectiveSegReg.readSegment(this.getPointerAddress(offset), size || this.size);
                    },
                    writeNonPointer = function (val /*, offset, size*/) {
                        // NB: Must be to a register
                        this.reg.set(val);
                    },
                    writeWithPointer = function (val, offset, size) {
                        this.getSegReg().writeSegment(this.getPointerAddress(offset), val, size || this.size);
                    };

                util.extend(partials, {
                    "operand": {
                        "getPointerAddress": function (offset) {
                            var operand = this;

                            /*jshint bitwise: false */
                            return (
                                (operand.reg ? operand.reg.get() : 0) * operand.scale +
                                (operand.reg2 ? operand.reg2.get() : 0) +
                                (offset || 0) +
                                operand.displacement
                            ) & operand.addressMask;
                        },
                        "read": function (offset, size) {
                            var operand = this;

                            if (operand.isPointer) {
                                operand.effectiveSegReg = operand.getSegReg();
                                operand.read = readWithPointer;
                            } else {
                                operand.read = readNonPointer;
                            }

                            // operand.read = operand.isPointer ? readWithPointer : readNonPointer;
                            return operand.read(offset, size);
                        },
                        "readSelectorAndOffset": function (offset, size) {
                            var operand = this,
                                result = operand.read(offset, size);

                            if (operand.size < 4) {
                                throw new Error('Selector and offset requires at least 4 bytes');
                            }

                            if (operand.size === 4) {
                                return {
                                    selector: result >>> 16,
                                    offset: result & 0xFFFF
                                };
                            }

                            // Otherwise must be a 6-byte selector+offset:
                            return operand.isPointer ? {
                                selector: result.high16,
                                offset: result.low32
                            } : {
                                selector: this.highImmed,
                                offset: this.immed
                            };
                        },
                        "signExtend": function (to) {
                            var operand = this;

                            return util.signExtend(
                                operand.read(),
                                operand.size,
                                to || operand.insn.operand1.size
                            );
                        },
                        "write": function (val, offset, size) {
                            var operand = this;

                            operand.write = operand.isPointer ? writeWithPointer : writeNonPointer;
                            operand.write(val, offset, size);
                        }
                    }
                });
            });

            decoder.on("init operand", function (args) {
                /*jshint multistr: true */

                args.addSet("getPointerAddress", "partials.operand.getPointerAddress");
                args.addSet("signExtend", "partials.operand.signExtend");

                // Accessors: lazily set polymorphically on first use
                args.addSet("read", "partials.operand.read");
                args.addSet("readSelectorAndOffset", "partials.operand.readSelectorAndOffset");
                args.addSet("write", "partials.operand.write");
            });

            LegacyExecute.functions["#FPU"] = function () {
                // No FPU support yet
                console.log('FPU instruction - ' + this.getName());

                if (cpu.registers.em.get()) {
                    cpu.exception(0x06, null);
                    // return;
                }

                // TODO: Figure out when this should be raised - when a certain flag is set in CR0?
                // (See http://wiki.osdev.org/Exceptions#Device_Not_Available)
                // cpu.exception(0x07, null);
            };

            decoder.on("post init", function (args) {
                util.each(args.opcodeMap, function (opcodeData) {
                    opcodeData.execute = LegacyExecute.functions[opcodeData.name];
                });

                util.each(args.opcodeExtensionMap, function (opcodeData) {
                    opcodeData.execute = LegacyExecute.functions[opcodeData.name];
                });
            });

            decoder.init();

            return promise.resolve();
        },

        interrupt: function (vector) {
            /*jshint bitwise: false */
            var cpu = this,
                registers = cpu.registers,
                idtr = registers.idtr,
                ipSize = registers.pe.get() ? 4 : 2,
                descriptorSize = ipSize * 2,
            // Calc offset as 4 bytes for every vector before this one
                tableOffset = vector * descriptorSize,
                newCS,
                newIP;

            cpu.emit("interrupt", vector);
            cpu.running = true;

            // Check whether vector is out of bounds (vector being read
            //    must be inside IDTR - its size is variable)
            if ((tableOffset + descriptorSize - 1) > idtr.limit) {
                util.problem("CPU.interrupt() :: Error - interrupt vector is outside IDT limit");
                cpu.exception(util.GP_EXCEPTION, 0);
            }

            // Save current (E)FLAGS and CS:(E)IP (CPU state) on stack
            cpu.pushStack(registers.eflags.get(), ipSize);
            cpu.pushStack(registers.cs.get(), ipSize);
            cpu.pushStack(registers.eip.get(), ipSize);

            // Get ISR's IP (& check it is within code segment limits)
            if (registers.pe.get()) {
                // Read lower 2 bytes of offset
                newIP = cpu.memory.readLinear(idtr.base + tableOffset, 2, 0);

                // Read upper 2 bytes of offset
                newIP |= ((cpu.memory.readLinear(idtr.base + tableOffset + 6, 2, 0)) << 16) >>> 0;
            } else {
                newIP = cpu.memory.readLinear(idtr.base + tableOffset, 2, 0);
            }

            // FIXME
            /*if (newIP > registers.cs.cache.limitScaled) {
                util.problem("CPU.interrupt() :: Error - interrupt vector is outside IDT limit");
                cpu.exception(util.GP_EXCEPTION, 0);
            }*/

            // Get ISR's CS
            newCS = cpu.memory.readLinear(idtr.base + tableOffset + 2, 2, 0);

            // Jump to ISR CS:IP
            registers.cs.set(newCS);
            registers.eip.set(newIP);

            registers.if.clear(); // Disable any maskable interrupts
            registers.tf.clear(); // Disable any traps
            /*registers.ac.clear(); // ???
            registers.rf.clear();*/
        },

        // Return from Interrupt Service Routine (ISR)
        interruptReturn: function (is32) {
            /*jshint bitwise: false */
            var cpu = this,
                eflags,
                flags,
                registers = cpu.registers,
                tssBase;

            if (!is32) {
                // Set all of EIP to zero-out high word
                registers.eip.set(cpu.popStack(2));
                registers.cs.set(cpu.popStack(2)); // 16-bit pop

                // FIXME: Allow change of IOPL & IF here,
                //        disallow in many other places
                // Don't clear high EFLAGS word (is this right??)
                flags = cpu.popStack(2);

                registers.flags.set(flags);
            } else {
                // FIXME: Try not popping from the stack until the CS load is successful,
                //        in case a CPU exception is raised leaving the registers in an odd state (?)

                if (registers.pe.get() && registers.nt.get()) {
                    // Return from nested task
                    // TODO: Check for v8086 mode (?)

                    // TODO: Should TR be set to the old value again?
                    registers.tdr.set(cpu.memory.readLinear(registers.tr.base, 2));

                    if (!registers.tdr.cache.isBusyTSSDescriptor()) {
                        // Not a TSS descriptor OR it is but is not marked Busy
                        cpu.exception(util.TS_EXCEPTION, registers.tdr.get());
                    }

                    // TODO: Additional checks on target TSS

                    registers.tr.set(registers.tdr.get());

                    // Restore calling task's register state
                    tssBase = registers.tr.cache.base;
                    registers.eip.set(cpu.memory.readLinear(tssBase + 0x20, 4));
                    registers.eflags.set(cpu.memory.readLinear(tssBase + 0x24, 4));
                    registers.eax.set(cpu.memory.readLinear(tssBase + 0x28, 4));
                    registers.ecx.set(cpu.memory.readLinear(tssBase + 0x2C, 4));
                    registers.edx.set(cpu.memory.readLinear(tssBase + 0x30, 4));
                    registers.ebx.set(cpu.memory.readLinear(tssBase + 0x34, 4));
                    registers.esp.set(cpu.memory.readLinear(tssBase + 0x38, 4));
                    registers.ebp.set(cpu.memory.readLinear(tssBase + 0x3C, 4));
                    registers.esi.set(cpu.memory.readLinear(tssBase + 0x40, 4));
                    registers.edi.set(cpu.memory.readLinear(tssBase + 0x44, 4));

                    registers.es.set(cpu.memory.readLinear(tssBase + 0x48, 2));
                    registers.cs.set(cpu.memory.readLinear(tssBase + 0x4C, 2));
                    registers.ss.set(cpu.memory.readLinear(tssBase + 0x50, 2));
                    registers.ds.set(cpu.memory.readLinear(tssBase + 0x54, 2));
                    registers.fs.set(cpu.memory.readLinear(tssBase + 0x58, 2));
                    registers.gs.set(cpu.memory.readLinear(tssBase + 0x5C, 2));

                    // Mark target (called) TSS segment descriptor as no longer busy
                    var offset = registers.gdtr.base + registers.tr.selector.index * 8;
                    var byte5 = cpu.memory.readLinear(offset + 5, 1);
                    byte5 &= ~2; // Clear second bit (Busy bit)
                    cpu.memory.writeLinear(offset + 5, byte5, 1);

                    return;
                }

                registers.eip.set(cpu.popStack(4));
                // Yes, we must pop 32 bits but discard high word
                registers.cs.set(cpu.popStack(4));
                eflags = cpu.popStack(4);

                // VIF, VIP, VM unchanged
                // FIXME: What is 0x1A0000 mask for? Can't remember...
                registers.eflags.set((eflags & 0x257FD5) | (registers.eflags.get() & 0x1A0000));
            }
        },

        lowerINTR: function () {
            this.intr.lower();
        },

        // Pop data off the Stack
        popStack: function (length) {
            /*jshint bitwise: false */

            // Pointer to top of Stack
            var registers = this.registers,
                sp = registers.ss.cache.default32BitSize ? registers.esp : registers.sp,
                ptrStack = sp.get(),
                res;

            // Value popped should be 16-bits or 32-bits
            if (length !== 2 && length !== 4) {
                util.panic("CPU.popStack() :: Invalid no. of bytes to pop");
            }

            // Read data from Stack top (SS:SP)
            res = registers.ss.readSegment(ptrStack, length);

            // Increment by operand size
            ptrStack = (ptrStack + length) & sp.getMask();

            // Update Stack pointer
            sp.set(ptrStack);

            return res;
        },

        purgeAllPages: function () {
            this.pages = [];
        },

        purgePage: function (page) {
            //this.pages[page].length = 0;
            this.pages[page] = [];
        },

        // Push data onto the Stack
        pushStack: function (value, length) {
            /*jshint bitwise: false */

            // Pointer to top of Stack
            var registers = this.registers,
                sp = registers.ss.cache.default32BitSize ? registers.esp : registers.sp,
                ptrStack = sp.get();

            // Value pushed should be 16-bits or 32-bits (no sign extension)
            if (length === 1) {
                length = 2;
            }

            // Decrement by operand size
            ptrStack = (ptrStack - length) & sp.getMask();

            // Update Stack pointer
            sp.set(ptrStack);

            // Write data to Stack top (SS:SP)
            registers.ss.writeSegment(ptrStack, value, length);
        },

        raiseINTR: function () {
            this.intr.raise();
        },

        reset: function () {
            var cpu = this,
                registers = cpu.registers;

            // Set all segment registers to startup state (incl. descriptor caches)
            registers.cs.reset();
            registers.ds.reset();
            registers.ss.reset();
            registers.es.reset();
            registers.fs.reset();
            registers.gs.reset();

            // Start at first instruction in CMOS BIOS POST
            registers.cs.set(0xF000);
            registers.eip.set(0x0000FFF0);

            // Clear all general-purpose registers
            registers.eax.set(0x00000000);
            registers.ebx.set(0x00000000);
            registers.ecx.set(0x00000000);
            registers.edx.set(0x00000000);
            registers.ebp.set(0x00000000);
            registers.esi.set(0x00000000);
            registers.edi.set(0x00000000);
            registers.esp.set(0x00000000);

            // Descriptor Table Registers
            registers.gdtr.reset(); // See GlobalTableRegister
            registers.idtr.reset(); // See GlobalTableRegister
            registers.ldtr.reset(); // See LocalTableRegister

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
            registers.cr0.set(0x60000010);
            /*
             *    - Single-step disabled
             *    - Recognition of external interrupts (on INTR) disabled
             *    - String instructions auto-INCREMENT address
             *    - IOPL = 0 (no effect in Real Mode)
             *    - Debug fault checking enabled after exec. of IRETD insn.
             *    - Virtual 8086 mode disabled
             *    - Alignment Checking disabled
             */
            registers.eflags.set(0x00000002);
            // Page Fault Linear Address of 00000000h.
            //    No effect in Real Mode (paging disabled)
            registers.cr2.set(0x00000000);
            // Contains Page Directory start address of 00000000h,
            //    page directory caching set to enabled and write-back.
            // - No effect (because paging disabled)
            registers.cr3.set(0x00000000);
            // Processor extensions disabled.
            //    No effect in real mode.
            registers.cr4.set(0x00000000);

            /* ==== Debug ==== */
            // Disable breakpoint recognition.
            registers.dr7.set(0x00000400);
            /* ==== /Debug ==== */
        },

        run: function () {
            var cpu = this,
                promise = new Promise();

            cpu.one("halt", function () {
                promise.resolve();
            });

            if (!cpu.running) {
                cpu.running = true;
                cpu.emit("run");
            }

            if (cpu.timeout === null) {
                // Start the Fetch-Decode-Execute process if we stopped (vs. just a halt) for some reason
                cpu.timeout = setImmediate(function () {
                    cpu.timeout = null;
                    cpu.cycle();
                });
            }

            return promise;
        },

        serviceIRQs: function () {
            var cpu = this,
                vector;

            // Check interrupts are enabled/uninhibited & one is pending
            if (cpu.intr.isHigh() && cpu.registers.if.isHigh()) {
                // Only EVER process one interrupt here: we have to allow the ISR to actually run!

                // (NB: This may set INTR with the next interrupt)
                vector = cpu.system.acknowledgeInterrupt();

                try {
                    cpu.interrupt(vector);
                } catch (error) {
                    if (error instanceof CPUHalt) {
                        // CPU has halted - don't restart it again
                        return true;
                    }

                    // Ignore if a CPU exception, as we will have handled it already.
                    // The failed instruction should be retried on the next cycle
                    if (!(error instanceof CPUException)) {
                        throw error;
                    }
                }

                // An enabled interrupt will wake the CPU if halted
                cpu.running = true;

                return true;
            }

            return false;
        },

        stop: function () {
            var cpu = this;

            clearImmediate(cpu.timeout);
            cpu.pages.length = 0;
            cpu.timeout = null;
            cpu.running = false;
        }
    });

    return CPU;
});
