/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *	
 *	MODULE: Memory (RAM) <-> Northbridge/Chipset support
 */

define([
	"../util"
	, "./cpu/segreg"
	, "./iodev"
	, "./memory/buffer"
	, "./memory/rom"
	, "./cpu/selector"
	, "./cpu/descriptor"
	, "./memory/accessor"
], function (
	util
	, SegRegister
	, IODevice
	, Buffer
	, ROM
	, Selector
	, Descriptor
	, Accessor
) { "use strict";
	
	var PHY_MEM_WIDTH = 32
		// Memory access types (read/write/execute/rw)
		//	(NB: These are different from the BX_READ etc. constants
		//	in Bochs' bochs.h, to allow eg. "type & TYPE_READ")
		, TYPE_READ		= 1
		, TYPE_WRITE	= 2
		, TYPE_EXECUTE	= 4
		, TYPE_RW		= TYPE_READ | TYPE_WRITE
		
		// 512K BIOS ROM @0xfff80000
		//   2M BIOS ROM @0xffe00000, must be a power of 2
		, BIOSROMSZ = (1 << 21)
		// ROMs @ 0xc0000-0xdffff (area 0xe0000 -> 0xfffff = BIOS-mapped)
		, EXROMSIZE = 0x20000
		, BIOS_MASK = (BIOSROMSZ - 1)
		, EXROM_MASK = (EXROMSIZE - 1);
	
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
		
		// For direct physical memory access
		this.accessor = new Accessor();
	}
	// Set up memory subsystem
	Memory.prototype.init = function () {
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
		 *	Memory map inside the 1st megabyte:
		 *	
		 *	...
		 *	0xc0000 - 0xdffff    Expansion Card BIOS and Buffer Area (128K)
		 *	0xe0000 - 0xeffff    Lower BIOS Area (64K)
		 *	0xf0000 - 0xfffff    Upper BIOS Area (64K)
		 */
		this.bufROMs = Buffer.wrapMultibyteBuffer(
			Buffer.createBuffer(EXROMSIZE + BIOSROMSZ + 4096)
		);
	};
	Memory.prototype.destroy = function () {
		// Free memory etc. when finished
		if ( !util.support.typedArrays ) {
			this.bufDRAM.length = 0;
		}
		delete this.bufDRAM;
	};
	// Register memory read & write handlers for the specified address range
	//	(For now, until/if it causes a problem, all I/O memory mapping
	//	is hardcoded: however, this mechanism is still used to allow
	//	easy migration if this situation is ever changed.)
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
		//	then just verify arguments with the hard-coding
		//	in SegRegister.set()
		if ( arg === machine.vga ) {
			if ( addrBegin === 0xa0000 && addrEnd === 0xbffff ) {
				this.handlers.vga = {
					arg: arg			// Argument to handlers (eg. I/O device)
					, fnRead: fnRead	// Memory read handler
					, fnWrite: fnWrite	// Memory write handler
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
		this.loadAccessorFromPhysical(this.accessor, addrPhysical);
		return this.accessor.read(0, size);
	};
	Memory.prototype.writePhysical = function ( addrPhysical, val, size ) {
		this.loadAccessorFromPhysical(this.accessor, addrPhysical);
		this.accessor.write(0, val, size);
	};
	// Fetches the raw bytes of a descriptor from GDT
	Memory.prototype.fetchRawDescriptor = function ( selector, exceptionType ) {
		var machine = this.machine, mem = machine.mem, cpu = this.machine.cpu
			, index = selector.index
			, offset;
		
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
		var cpu = this.machine.cpu
			, ARByte;
		
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
	// Load memory accessor from Physical address (simulates the address bus
	//  connection from CPU->MMU/Northbridge)
	Memory.prototype.loadAccessorFromPhysical = function ( accessor, addrPhysical ) {
		var machine = this.machine;
        var mem = this;
		// Apply A20 mask to physical address
		var addrA20 = addrPhysical & machine.maskA20;
		// Determine whether we are in CMOS ROM
		var isBIOS = (addrA20 >= (~BIOS_MASK >>> 0));
		// Start address of the page containing segment
		//	Warning: "Unreal mode", where cpu is switched to protected mode,
		//	 segment limit set to > 64K & then switched back to Real Mode,
		//	 will mean that addresses _ARE_ valid outside the 64K page.
		//var addrPage = addrA20 & 0xFFFF0000;
		
		/*
		 *	Memory map inside the 1st megabyte:
		 *	
		 *	0x00000 - 0x7ffff    DOS area (512K)
		 *	0x80000 - 0x9ffff    Optional fixed memory hole (128K)
		 *	0xa0000 - 0xbffff    Standard PCI/ISA Video Mem / SMMRAM (128K)
		 *	0xc0000 - 0xdffff    Expansion Card BIOS and Buffer Area (128K)
		 *	0xe0000 - 0xeffff    Lower BIOS Area (64K)
		 *	0xf0000 - 0xfffff    Upper BIOS Area (64K)
		 */
		
		// Normal DRAM/physical memory read/write
		//	(must be within the non-memory-mapped area of memory
		//	& not addressing the CMOS BIOS @ top-end of address space)
		//	- Read/write/execute are all permitted here
		if ( (addrA20 < 0x000a0000 || addrA20 >= 0x00100000) && !isBIOS ) {
			// Check access is within guest DRAM size
			if ( addrA20 < mem.sizeDRAM ) {
				// DRAM starts (of course) from address 0x00
				accessor.setupBuffer(mem.bufDRAM, 0, addrA20);
			} else {
				// TODO: It is ok to set a segreg to an invalid value,
				//	just not to then reference using the invalid value,
				//	so we need to delay any error msgs until then
				util.problem("SegRegister.set() ::"
					+ " Address " + util.format("hex", addrA20)
					+ " beyond end of DRAM");
			}
		// VGA's I/O-mapped memory may be read from or written to
		//	(TODO: For now, this allows VGA memory to be executed;
		//	although this would probably never happen,
		//	should it be blocked?)
		} else if ( addrA20 >= 0x000a0000 && addrA20 < 0x000c0000 ) {
			accessor.setupHandler(mem.handlers.vga, addrA20);
		// ROMs & lower/upper BIOS areas
		} else if ( addrA20 >= 0x000c0000 && addrA20 < 0x00100000
				&& !isBIOS ) {
			
			// CMOS BIOS
			// - 0xE0000 -> 0xEFFFF	"Lower BIOS Area" (64K)
			// - 0xF0000 -> 0xFFFFF	"Upper BIOS Area" (64K)
			if ( (addrA20 & 0xfffe0000) === 0x000e0000 ) {
				// ROM memory buffer begins at 0xC0000 in physical memory
				// FIXME: Should be Read Only...?
				accessor.setupBuffer(mem.bufROMs, 0xC0000, addrA20);
			/*
			 *	Expansion ROMs/BIOSes
			 *	0xC0000 -> 0xDFFFF "Exp. Card BIOS and Buffer Area" (128K)
			 *	- (NB: For some reason, expansion ROM BIOS code area is not
			 *	  read-only - the VGABIOS writes to those addresses -
			 *	  unlike the CMOS one)
			 */
			} else {
				// ROM memory buffer begins at 0xC0000 in physical memory
				accessor.setupBuffer(mem.bufROMs, 0xC0000, addrA20);
			}
		} else if ( isBIOS ) {
			// ROM memory buffer begins at 0xC0000 in physical memory
			// FIXME: Should be Read Only...?
			accessor.setupBuffer(mem.bufROMs, 0xC0000, addrA20);
		} else {
			util.problem("SegRegister.set() ::"
				+ " Address " + util.format("hex", addrA20) + " is out-of-bounds");
		}
		
		// Only permit access within the checked 64K page
		//accessor.addrMin = addrPage;
		//accessor.addrMax = addrPage + 0x0000FFFF;
	};
	util.extend(Memory.prototype, ROM);
	
	// Exports
	return Memory;
});
