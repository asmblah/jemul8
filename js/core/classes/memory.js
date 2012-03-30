/*
 *    jemul8 - JavaScript x86 Emulator
 *    Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *    
 *    MODULE: Memory (RAM) <-> Northbridge/Chipset support
 */

define([
    "../util"
    , "./cpu/segreg"
    , "./iodev"
    , "./memory/buffer"
    , "./memory/rom"
    , "./cpu/selector"
    , "./cpu/descriptor"
], function (
    util
    , SegRegister
    , IODevice
    , Buffer
    , ROM
    , Selector
    , Descriptor
) { "use strict";
    
    var PHY_MEM_WIDTH = 32;
    // Memory access types (read/write/execute/rw)
    //    (NB: These are different from the BX_READ etc. constants
    //    in Bochs' bochs.h, to allow eg. "type & TYPE_READ")
    var TYPE_READ    = 1;
    var TYPE_WRITE   = 2;
    var TYPE_EXECUTE = 4;
    var TYPE_RW      = TYPE_READ | TYPE_WRITE;
    
    // 512K BIOS ROM @0xfff80000
    //   2M BIOS ROM @0xffe00000, must be a power of 2
    var BIOSROMSZ = (1 << 21);
    // ROMs @ 0xc0000-0xdffff (area 0xe0000 -> 0xfffff = BIOS-mapped)
    var EXROMSIZE = 0x20000;
    var BIOS_MASK = (BIOSROMSZ - 1);
    var EXROM_MASK = (EXROMSIZE - 1);
    
    // Memory subsystem class constructor
    function Memory( machine ) {
        util.assert(this && (this instanceof Memory)
            , "Memory constructor :: error - not called properly"
        );
        
        this.machine = machine;
        
        // Physical memory / DRAM
        this.bufDRAM = null;
        
        // ROM memory
        this.bufROMs = null;
        
        // Memory access handlers
        this.handlers = {};
    }
    // Set up memory subsystem
    Memory.prototype.init = function ( done, fail ) {
        // 32MB RAM
        // FIXME: This should be a config setting
        var sizeDRAM = 32 * 1024 * 1024;
        
        // Ask system to allocate a memory buffer to use for guest DRAM
        this.bufDRAM = Buffer.wrapMultibyteBuffer(
            Buffer.createBuffer(sizeDRAM)
        );
        this.sizeDRAM = sizeDRAM;
        
        // Allocate buffer for system (CMOS), VGA & optional expansion ROMs
        // - mem size from Bochs' [BX_MEM_C::init_memory] /memory/misc_mem.cc
        /*
         *    Memory map inside the 1st megabyte:
         *    
         *    ...
         *    0xc0000 - 0xdffff    Expansion Card BIOS and Buffer Area (128K)
         *    0xe0000 - 0xeffff    Lower BIOS Area (64K)
         *    0xf0000 - 0xfffff    Upper BIOS Area (64K)
         */
        this.bufROMs = Buffer.wrapMultibyteBuffer(
            Buffer.createBuffer(EXROMSIZE + BIOSROMSZ + 4096)
        );

        done();
    };
    Memory.prototype.destroy = function () {
        // Free memory etc. when finished
        if ( !util.support.typedArrays ) {
            this.bufDRAM.length = 0;
        }
        delete this.bufDRAM;
    };
    // Register memory read & write handlers for the specified address range
    //    (For now, until/if it causes a problem, all I/O memory mapping
    //    is hardcoded: however, this mechanism is still used to allow
    //    easy migration if this situation is ever changed.)
    Memory.prototype.registerMemoryHandlers
    = function ( addrBegin, addrEnd, fnRead, fnWrite, arg ) {
        util.assert(!isNaN(addrBegin) && addrBegin === parseInt(addrBegin)
            , "Memory.registerMemoryHandlers() ::"
            + " 'addrBegin' must be an integer");
        util.assert(!isNaN(addrEnd) && addrEnd === parseInt(addrEnd)
            , "Memory.registerMemoryHandlers() ::"
            + " 'addrEnd' must be an integer");
        util.assert(addrBegin <= addrEnd
            , "Memory.registerMemoryHandlers() ::"
            + " 'addrBegin' must be <= 'addrEnd'");
        util.assert(util.isFunction(fnRead)
            , "Memory.registerMemoryHandlers() ::"
            + " 'fnRead' must be a valid callback (function)");
        util.assert(util.isFunction(fnWrite)
            , "Memory.registerMemoryHandlers() ::"
            + " 'fnWrite' must be a valid callback (function)");
        // 'arg' may not be a device in future...!
        util.assert(arg && (arg instanceof IODevice)
            , "Memory.registerMemoryHandlers() ::"
            + " 'arg' must be an IODevice");
        
        var machine = arg.machine;
        
        // Check device is supported here,
        //    then just verify arguments with the hard-coding
        //    in SegRegister.set()
        if ( arg === machine.vga ) {
            if ( addrBegin === 0xa0000 && addrEnd === 0xbffff ) {
                this.handlers.vga = {
                    arg: arg            // Argument to handlers (eg. I/O device)
                    , fnRead: fnRead    // Memory read handler
                    , fnWrite: fnWrite    // Memory write handler
                };
            } else {
                util.panic("Memory.registerMemoryHandlers() :: VGA addresses"
                    + " do not match the hard-coded ones");
            }
        // Unsupported device (!)
        } else {
            util.panic("Memory.registerMemoryHandlers() :: Registered"
                + " memory handlers for unsupported device '"
                + arg.getName() + "' (memory-mapped I/O address ranges"
                + " are hardcoded in /classes/memory.js)");
        }
        
        util.info("Memory.registerMemoryHandlers() ::"
            + " Registered memory handlers for device '" + arg.getName()
            + "' from " + util.format("hex", addrBegin)
            + " -> " + util.format("hex", addrEnd));
        
        return true;
    };
    // Converts a Linear address to a Physical one
    //  - if paging disabled, no translation is performed
    Memory.prototype.linearToPhysical = function ( addrLinear ) {
        var cpu = this.machine.cpu;
        var addrPhysical = addrLinear;
        
        // Paging enabled - need to translate Linear address to Physical address
        //  by way of Paging table
        if ( cpu.PG.get() ) {
            util.panic("Memory.linearToPhysical() :: No paging support yet.");
        }
        
        return addrPhysical;
    };
    // Linear addresses - calculated from Virtual addresses by segment translation
    Memory.prototype.readLinear = function ( addrLinear, size, cpl ) {
        return this.readPhysical(
            // Translate Linear to Physical address
            this.linearToPhysical(addrLinear)
            , size
        );
    };
    Memory.prototype.writeLinear = function ( addrLinear, val, size, cpl ) {
        this.writePhysical(
            // Translate Linear to Physical address
            this.linearToPhysical(addrLinear)
            , val, size
        );
    };
    // Physical addresses - calculated from Linear addresses by paging
    //  (if paging disabled, linear addresses === physical addresses)
    Memory.prototype.readPhysical = function ( addrPhysical, size ) {
        var accessor = this.mapPhysical(addrPhysical, size);
        var addrA20 = accessor.addrA20;
        var buf = accessor.buf;
        var handler;
        
        // Read/write memory buffer
        if ( buf ) {
            if ( size === 1 ) {
                return buf.getUint8(addrA20 - accessor.addrStart_buf, true);
            } else if ( size === 2 ) {
                return buf.getUint16(addrA20 - accessor.addrStart_buf, true);
            } else if ( size === 4 ) {
                return buf.getUint32(addrA20 - accessor.addrStart_buf, true);
            } else {
                util.panic("Data length > 4");
                return 0;
            }
        // Read via handler function
        } else {
            handler = accessor.handler;
            return handler.fnRead(addrA20, size, handler.arg);
        }
    };
    Memory.prototype.writePhysical = function ( addrPhysical, val, size ) {
        var accessor = this.mapPhysical(addrPhysical, size);
        var addrA20 = accessor.addrA20;
        var buf = accessor.buf;
        var handler;
        
        // Read/write memory buffer
        if ( buf ) {
            if ( size === 1 ) {
                buf.setUint8(addrA20 - accessor.addrStart_buf, val, true);
            } else if ( size === 2 ) {
                buf.setUint16(addrA20 - accessor.addrStart_buf, val, true);
            } else if ( size === 4 ) {
                buf.setUint32(addrA20 - accessor.addrStart_buf, val, true);
            } else {
                util.panic("Data length > 4");
            }
        // Write via handler function
        } else {
            handler = accessor.handler;
            handler.fnWrite(addrA20, val, size, handler.arg);
        }
    };
    // Fetches the raw bytes of a descriptor from GDT
    Memory.prototype.fetchRawDescriptor = function ( selector, exceptionType ) {
        var machine = this.machine;
        var mem = machine.mem;
        var cpu = this.machine.cpu;
        var index = selector.index;
        var offset;
        
        // GDT is the table to fetch from
        if ( selector.table === 0 ) {
            if ( (index * 8 + 7) > cpu.GDTR.limit ) {
                util.problem(util.sprintf(
                    "Memory.fetchRawDescriptor() :: GDT: index (%x) %x > limit (%x)"
                    , index * 8 + 7
                    , index
                    , cpu.GDTR.limit
                ));
                cpu.exception(exceptionType, selector.getValue() & 0xFFFC);
            }
            // Calculate address of raw descriptor to read in memory
            offset = cpu.GDTR.base + index * 8;
        // LDT is the table to fetch from
        } else {
            // For LDT, we have to check whether it is valid first
            if ( !cpu.LDTR.isValid() ) {
                util.problem("Memory.fetchRawDescriptor(): LDTR.valid = false");
                cpu.exception(exceptionType, selector.getValue() & 0xFFFC);
            }
            if ( (index * 8 + 7) > cpu.LDTR.cache.limitScaled ) {
                util.problem(util.sprintf(
                    "Memory.fetchRawDescriptor() :: LDT: index (%x) %x > limit (%x)"
                    , index * 8 + 7
                    , index
                    , cpu.LDTR.cache.limitScaled
                ));
                cpu.exception(exceptionType, selector.getValue() & 0xFFFC);
            }
            // Calculate address of raw descriptor to read in memory
            offset = cpu.LDTR.cache.base + index * 8;
        }
        
        //raw_descriptor = system_read_qword(offset);
        
        //*dword1 = GET32L(raw_descriptor);
        //*dword2 = GET32H(raw_descriptor);
        
        // Pass back 64-bit result as two 32-bit values
        return {
            dword1: mem.readLinear(offset, 4, 0)
            , dword2: mem.readLinear(offset + 4, 4, 0)
        };
    };
    // "Touch" a memory segment to mark it as accessed (if not already marked)
    Memory.prototype.touchSegment = function ( selector, descriptor ) {
        var cpu = this.machine.cpu;
        var ARByte;
        
        if ( descriptor.isSegmentAccessed() == false ) {
            // Set Accessed bit in Access Rights byte
            ARByte = descriptor.getARByte();
            ARByte |= 1;
            descriptor.segmentAccessed();
            
            // GDT
            if ( selector.table == 0 ) {
                this.writeLinear(cpu.GDTR.base + selector.index * 8 + 5, ARByte, 1, 0);
            // LDT
            } else {
                this.writeLinear(cpu.LDTR.cache.base + selector.index * 8 + 5, ARByte, 1, 0);
            }
        }
    };
    // Map/translate Physical address to A20 & buffer/handler mapped there
    //  - Simulates the address bus connection from CPU->MMU/Northbridge
    Memory.prototype.mapPhysical = function ( addrPhysical, size ) {
        var machine = this.machine;
        var mem = this;
        // Apply A20 mask to physical address
        var addrA20 = addrPhysical & machine.maskA20;
        // Determine whether we are in CMOS ROM
        var isBIOS = (addrA20 >= (~BIOS_MASK >>> 0));
        var buf = null;
        var addrStart_buf;
        var handler = null;
        
        /*
         *    Memory map inside the 1st megabyte:
         *    
         *    0x00000 - 0x7ffff    DOS area (512K)
         *    0x80000 - 0x9ffff    Optional fixed memory hole (128K)
         *    0xa0000 - 0xbffff    Standard PCI/ISA Video Mem / SMMRAM (128K)
         *    0xc0000 - 0xdffff    Expansion Card BIOS and Buffer Area (128K)
         *    0xe0000 - 0xeffff    Lower BIOS Area (64K)
         *    0xf0000 - 0xfffff    Upper BIOS Area (64K)
         */
        
        // Normal DRAM/physical memory read/write
        //    (must be within the non-memory-mapped area of memory
        //    & not addressing the CMOS BIOS @ top-end of address space)
        //    - Read/write/execute are all permitted here
        if ( (addrA20 < 0x000a0000 || addrA20 >= 0x00100000) && !isBIOS ) {
            // Check access is within guest DRAM size
            if ( addrA20 < mem.sizeDRAM ) {
                // DRAM starts (of course) from address 0x00
                buf = mem.bufDRAM;
                addrStart_buf = 0;
            } else {
                // TODO: It is ok to set a segreg to an invalid value,
                //    just not to then reference using the invalid value,
                //    so we need to delay any error msgs until then
                util.problem("SegRegister.set() ::"
                    + " Address " + util.format("hex", addrA20)
                    + " beyond end of DRAM");
            }
        // VGA's I/O-mapped memory may be read from or written to
        //    (TODO: For now, this allows VGA memory to be executed;
        //    although this would probably never happen,
        //    should it be blocked?)
        } else if ( addrA20 >= 0x000a0000 && addrA20 < 0x000c0000 ) {
            handler = mem.handlers.vga;
        // ROMs & lower/upper BIOS areas
        } else if ( addrA20 >= 0x000c0000 && addrA20 < 0x00100000
                && !isBIOS ) {
            
            // CMOS BIOS
            // - 0xE0000 -> 0xEFFFF    "Lower BIOS Area" (64K)
            // - 0xF0000 -> 0xFFFFF    "Upper BIOS Area" (64K)
            if ( (addrA20 & 0xfffe0000) === 0x000e0000 ) {
                // ROM memory buffer begins at 0xC0000 in physical memory
                // FIXME: Should be Read Only...?
                buf = mem.bufROMs;
                addrStart_buf = 0xC0000;
            /*
             *    Expansion ROMs/BIOSes
             *    0xC0000 -> 0xDFFFF "Exp. Card BIOS and Buffer Area" (128K)
             *    - (NB: For some reason, expansion ROM BIOS code area is not
             *      read-only - the VGABIOS writes to those addresses -
             *      unlike the CMOS one)
             */
            } else {
                // ROM memory buffer begins at 0xC0000 in physical memory
                buf = mem.bufROMs;
                addrStart_buf = 0xC0000;
            }
        } else if ( isBIOS ) {
            // ROM memory buffer begins at 0xC0000 in physical memory
            // FIXME: Should be Read Only...?
            buf = mem.bufROMs;
            addrStart_buf = 0xC0000;
        } else {
            util.problem("SegRegister.set() ::"
                + " Address " + util.format("hex", addrA20) + " is out-of-bounds");
        }
        
        // Accessor data
        return {
            addrA20: addrA20
            , buf: buf
            , addrStart_buf: addrStart_buf
            , handler: handler
        };
    };
    util.extend(Memory.prototype, ROM);
    
    // Exports
    return Memory;
});
