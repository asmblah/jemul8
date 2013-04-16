/*
 *  jemul8 - JavaScript x86 Emulator
 *  Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *
 * MODULE: Segment Register class support
 *
 * ====
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*jslint bitwise: true, plusplus: true */
/*global define, require */

define([
    "../../util",
    "../register",
    "./selector",
    "./descriptor"
], function (
    util,
    Register,
    Selector,
    Descriptor
) {
    "use strict";

    // Segment Register (eg. CS, DS, ES, FS, GS) class constructor
    function SegRegister(name, size) {
        util.assert(this && (this instanceof SegRegister)
            , "SegRegister constructor :: error - not called properly"
        );

        Register.call(this, name, size);

        this.mask = util.generateMask(size);

        // Visible part of segment selector
        this.selector = new Selector();

        // Hidden "cache" for segment descriptors, populated
        //  when segment register's value is updated
        this.cache = new Descriptor();

        // Memory accessor (from MMU)
        //this.accessor = new Accessor();
    }
    util.inherit(SegRegister, Register); // Inheritance
    util.extend(SegRegister.prototype, {
        // Read a data quantum from this segment by virtual address/offset
        readSegment: function (addrVirtual, size) {
            //return this.accessor.read(addrVirtual, size);

            var machine = this.cpu.machine;
            var cpu = machine.cpu;
            var descriptor = this.cache;
            // Translate virtual address to linear by segmentation
            var addrLinear = descriptor.base + addrVirtual;
            var cpl = cpu.getCPL();

            if (addrVirtual > descriptor.limitScaled) {
                debugger;

                util.problem("SegRegister.readSegment() :: Segment limit violation");
                cpu.exception(this.getExceptionVector(), 0);
            }

            return machine.mem.readLinear(addrLinear, size, cpl);
        }, readSegmentBlock: function (addrVirtual, buffer, size) {
            //return this.accessor.read(addrVirtual, size);

            var machine = this.cpu.machine;
            var cpu = machine.cpu;
            var descriptor = this.cache;
            // Translate virtual address to linear by segmentation
            var addrLinear = descriptor.base + addrVirtual;
            var cpl = cpu.getCPL();

            if (addrVirtual > descriptor.limitScaled) {
                debugger;

                util.problem("SegRegister.readSegment() :: Segment limit violation");
                cpu.exception(this.getExceptionVector(), 0);
            }

            machine.mem.readLinearBlock(addrLinear, buffer, size, cpl);
        // Write data quantum to this segment by virtual address/offset
        }, writeSegment: function (addrVirtual, val, size) {
            //this.accessor.write(addrVirtual, val, size);

            var machine = this.cpu.machine;
            var cpu = machine.cpu;
            var descriptor = this.cache;
            // Translate virtual address to linear by segmentation
            var addrLinear = descriptor.base + addrVirtual;
            var cpl = cpu.getCPL();

            if (addrVirtual > descriptor.limitScaled) {
                util.problem("SegRegister.writeSegment() :: Segment limit violation");
                cpu.exception(this.getExceptionVector(), 0);
            }

            return machine.mem.writeLinear(addrLinear, val, size, cpl);
        // Translates a Virtual address to a Linear one by segmentation
        //  (NB: Not used in .read/writeSegment() as no handling is performed
        //  for memory protection etc.)
        }, virtualToLinear: function (addrVirtual) {
            return this.cache.base + addrVirtual;
        // Sets the Segment register back to its startup state
        }, reset: function () {
            var cache = this.cache;

            cache.accessType = util.ACCESS_VALID_CACHE
                | util.ACCESS_ROK
                | util.ACCESS_WOK;
            cache.present = true;
            cache.dpl = 0;
            cache.segment = 1; // Data/code segment
            cache.type = util.DESC_DATA_READ_WRITE_ACCESSED;

            cache.base = 0;
            // No scaling applied (x1) as byte-granular
            cache.limitScaled = 0xFFFF;
            cache.available = 0;
            cache.use4KPages = false;
            cache.default32BitSize = false;

            if (this === this.cpu.CS) {
                cache.base = 0xFFFF0000;
            }

            // Clear raw value too
            this.value = 0;
        // Loads a null selector into the segreg
        }, loadNullSelector: function (val) {
            util.assert((val & 0xFFFC) == 0
                , "SegRegister.loadNullSelector() :: Invalid value"
            );

            var selector = this.selector, cache = this.cache;

            selector.index = 0;
            selector.table = 0;
            selector.rpl = Selector.parse(val).rpl;

            cache.accessType = util.ACCESS_INVALID; // Invalidate null selector
            cache.present = false;
            cache.dpl = 0;
            cache.segment = true; // Code/data segment
            cache.type = 0;

            cache.base = 0;
            cache.limitScaled = 0;
            cache.use4KPages = false;
            cache.default32BitSize = false;
            cache.available = 0;
        // Segment Registers need special handling when set,
        //  eg. parsing selector & mapping
        }, set: function (val) {
            var machine = this.cpu.machine;
            var cpu = machine.cpu;
            var mem = machine.mem;
            var selector;
            var rawDescriptor;
            var descriptor;
            var cpl;

            // Mask out bits of value outside Register's bit-width
            val &= this.mask;

            // This is still a register: store its value
            this.value = val;

            // When (C)ode (S)egment is changed, eg. for a [far jmp],
            //  Instruction cache needs to be flushed
            if (this === cpu.CS) {
                cpu.flushInstructionCaches();
            }

            // Protected mode
            if (cpu.PE.get() && !cpu.VM.get()) {
                // Find out the Current Privilege Level
                //  for enforcing memory protection
                cpl = cpu.getCPL();
                debugger;
                // Loading Segment Selector is special
                if (this === cpu.SS) {
                    // Parse raw selector into components
                    selector = Selector.parse(val);

                    // Null selector
                    if ((val & 0xFFFC) === 0) {
                        util.problem("SS.set() :: Loading null selector");
                        cpu.exception(util.GP_EXCEPTION, val & 0xFFFC);
                    }

                    // Fetch raw descriptor as specified by selector
                    rawDescriptor = mem.fetchRawDescriptor(selector, util.GP_EXCEPTION);

                    /* selector's RPL must = CPL, else #GP(selector) */
                    if (selector.rpl != cpl) {
                        util.problem("SS.set() :: RPL != CPL");
                        cpu.exception(util.GP_EXCEPTION, val & 0xFFFC);
                    }

                    // Parse raw descriptor into components
                    descriptor = Descriptor.parse(rawDescriptor);

                    if (descriptor.isValid() == false) {
                        util.problem("SS.set() :: Valid bit cleared");
                        cpu.exception(util.GP_EXCEPTION, val & 0xFFFC);
                    }

                    // AR byte must indicate a writable data segment else #GP(selector)
                    if ( descriptor.isSegment() == false
                        || descriptor.isCodeSegment()
                        || descriptor.isDataSegmentWriteable() == false
                    ) {
                        util.problem("SS.set() :: Not writable data segment");
                        cpu.exception(util.GP_EXCEPTION, val & 0xFFFC);
                    }

                    // DPL in the AR byte must equal CPL else #GP(selector)
                    if (descriptor.dpl != cpl) {
                        util.problem("SS.set() :: DPL != CPL");
                        cpu.exception(util.GP_EXCEPTION, val & 0xFFFC);
                    }

                    // Segment must be marked PRESENT else #SS(selector)
                    if (descriptor.isPresent() == false) {
                        util.problem("SS.set() :: Not present");
                        cpu.exception(util.SS_EXCEPTION, val & 0xFFFC);
                    }

                    // Mark segment as accessed
                    mem.touchSegment(selector, descriptor);

                    // Load SS with selector, load SS cache with descriptor
                    // FIXME: Can we not reuse the same Descriptor object
                    //        instead of creating a new one each time?
                    //        Only may be an issue when exceptions are generated...
                    this.selector         = selector;
                    this.cache            = descriptor;
                    this.cache.accessType = util.ACCESS_VALID_CACHE;
                // DS, ES, FS or GS
                } else {
                    // Null selector
                    if ((val & 0xFFFC) == 0) {
                        this.loadNullSelector(val);
                        return;
                    }

                    // Parse raw selector into components
                    selector = Selector.parse(val);

                    // Fetch raw descriptor as specified by selector
                    rawDescriptor = mem.fetchRawDescriptor(selector, util.GP_EXCEPTION);

                    // Parse raw descriptor into components
                    descriptor = Descriptor.parse(rawDescriptor);

                    if (descriptor.isValid() == false) {
                        util.problem(util.sprintf(
                            "load_seg_reg(%s, 0x%04x): invalid segment"
                            , this.getName(), val
                        ));
                        cpu.exception(util.GP_EXCEPTION, val & 0xFFFC);
                    }

                    // AR byte must indicate data
                    //  or readable code segment else #GP(selector)
                    if ( descriptor.isSegment() == false
                        || (descriptor.isCodeSegment()
                            && descriptor.isCodeSegmentReadable() == false
                        )
                    ) {
                        util.problem(util.sprintf(
                            "load_seg_reg(%s, 0x%04x): not data or readable code"
                            , this.getName(), val
                        ));
                        cpu.exception(util.GP_EXCEPTION, val & 0xFFFC);
                    }

                    // If data or non-conforming code, then both the RPL and the CPL
                    //  must be less than or equal to DPL in AR byte else #GP(selector)
                    if ( descriptor.isDataSegment()
                        || descriptor.isCodeSegmentNonConforming()
                    ) {
                        if ( (selector.rpl > descriptor.dpl)
                            || (cpl > descriptor.dpl)
                        ) {
                            util.problem(util.sprintf(
                                "load_seg_reg(%s, 0x%04x): RPL & CPL must be <= DPL"
                                , this.getName(), val
                            ));
                            cpu.exception(util.GP_EXCEPTION, val & 0xFFFC);
                        }
                    }

                    // Segment must be marked PRESENT else #NP(selector)
                    if (descriptor.isPresent() == false) {
                        util.problem(util.sprintf(
                            "load_seg_reg(%s, 0x%04x): segment not present"
                            , this.getName(), val
                        ));
                        cpu.exception(util.NP_EXCEPTION, val & 0xFFFC);
                    }

                    // Mark segment as accessed
                    mem.touchSegment(selector, descriptor);

                    // Load segment register with selector,
                    //  & load segment register-cache with descriptor
                    this.selector         = selector;
                    this.cache            = descriptor;
                    this.cache.accessType = util.ACCESS_VALID_CACHE;
                }
            // Real- or V8086-mode
            } else {
                /*
                 * www.x86.org:
                 * ============
                 * According  to  Intel, each time any segment register is loaded in real
                 * mode,  the  base  address is calculated as 16 times the segment value,
                 * while  the  access  rights  and size limit attributes are given fixed,
                 * "real-mode  compatible" values. This is not true. In fact, only the CS
                 * descriptor  caches  for  the  286,  386, and 486 get loaded with fixed
                 * values  each  time  the segment register is loaded. Loading CS, or any
                 * other segment register in real mode, on later Intel processors doesn't
                 * change  the  access rights or the segment size limit attributes stored
                 * in  the  descriptor  cache  registers.  For these segments, the access
                 * rights and segment size limit attributes from any previous setting are
                 * honored.
                 */

                selector = this.selector;
                descriptor = this.cache;

                selector.rpl = cpu.VM.get() ? 3 : 0; // RPL = 3 in V8086-mode
                descriptor.accessType = util.ACCESS_VALID_CACHE;
                descriptor.base = val << 4; // Apply real-mode segment shift
                descriptor.segment = true;  // Data/code segment
                descriptor.present = true;  // Segment always present/resident

                // V8086-mode
                if (cpu.VM.get()) {
                    util.warning("No V8086 support yet");

                    descriptor.type = util.DESC_DATA_READ_WRITE_ACCESSED;
                    descriptor.dpl = 3; // We are in V8086-mode
                    // Again, note that limit is only reset in V8086-mode,
                    //  not in normal real mode, to allow "Unreal-mode"
                    descriptor.limitScaled = 0xFFFF;
                    descriptor.use4KPages = false; // Byte-granular
                    descriptor.default32BitSize = false // Default 16-bit
                    descriptor.available = 0; // The user/OS-defined free bit
                }
            }
        // Stack exceptions are different
        }, getExceptionVector: function () {
            if (this === this.cpu.SS) {
                return util.SS_EXCEPTION;
            } else {
                return util.GP_EXCEPTION;
            }
        }
    });

    // Exports
    return SegRegister;
});
