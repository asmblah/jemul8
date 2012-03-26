/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *	
 *	MODULE: Memory (RAM) <-> Northbridge support
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("memory", function ( $ ) { "use strict";
	var jemul8 = this.data("jemul8")
		, SegRegister = jemul8.SegRegister
		, poly_buf_readSegment, poly_buf_writeSegment
		, map_len_get, map_len_set;
	
	var PHY_MEM_WIDTH = 32
		// Memory access types (read/write/execute/rw)
		//	(NB: These are different from the BX_READ etc. constants
		//	in Bochs' bochs.h, to allow eg. "type & TYPE_READ")
		, TYPE_READ		= 1
		, TYPE_WRITE	= 2
		, TYPE_EXECUTE	= 4
		, TYPE_RW		= TYPE_READ | TYPE_WRITE
		
		, ACCESS_NONE		= 0
		, ACCESS_BUFFER		= 1
		, ACCESS_HANDLER	= 2
		
		// 512K BIOS ROM @0xfff80000
		//   2M BIOS ROM @0xffe00000, must be a power of 2
		, BIOSROMSZ = (1 << 21)
		// ROMs @ 0xc0000-0xdffff (area 0xe0000 -> 0xfffff = BIOS-mapped)
		, EXROMSIZE = 0x20000
		, BIOS_MASK = (BIOSROMSZ - 1)
		, EXROM_MASK = (EXROMSIZE - 1);
	
	// Memory subsystem class constructor
	function Memory( machine ) {
		this.machine = machine;
		
		// Physical memory / DRAM
		this.bufDRAM = null;
		
		// ROM memory
		this.bufROMs = null;
		
		// Memory access handlers
		this.handlers = {};
	}
	// Set up memory subsystem
	Memory.prototype.init = function () {
		var idx, sizeDRAM = 1024 * 1024;
		
		// Ask system to allocate a memory buffer to use for DRAM
		this.bufDRAM = jemul8.wrapMultibyteBuffer(
			jemul8.createBuffer(sizeDRAM));
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
		this.bufROMs = jemul8.wrapMultibyteBuffer(
			jemul8.createBuffer(EXROMSIZE + BIOSROMSZ + 4096));
	};
	Memory.prototype.destroy = function () {
		// Free memory etc. when finished
		if ( !jemul8.support.typedArrays ) {
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
		/* ==== Guards ==== */
		jemul8.assert(!isNaN(addrBegin) && addrBegin === parseInt(addrBegin)
			, "Memory.registerMemoryHandlers() ::"
			+ " 'addrBegin' must be an integer");
		jemul8.assert(!isNaN(addrEnd) && addrEnd === parseInt(addrEnd)
			, "Memory.registerMemoryHandlers() ::"
			+ " 'addrEnd' must be an integer");
		jemul8.assert(addrBegin <= addrEnd
			, "Memory.registerMemoryHandlers() ::"
			+ " 'addrBegin' must be <= 'addrEnd'");
		jemul8.assert($.isFunction(fnRead)
			, "Memory.registerMemoryHandlers() ::"
			+ " 'fnRead' must be a valid callback (function)");
		jemul8.assert($.isFunction(fnWrite)
			, "Memory.registerMemoryHandlers() ::"
			+ " 'fnWrite' must be a valid callback (function)");
		// 'arg' may not be a device in future...!
		jemul8.assert(arg && (arg instanceof jemul8.IODevice)
			, "Memory.registerMemoryHandlers() ::"
			+ " 'arg' must be an IODevice");
		/* ==== /Guards ==== */
		
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
				jemul8.panic("Memory.registerMemoryHandlers() :: VGA addresses"
					+ " do not match the hard-coded ones");
			}
		// Unsupported device (!)
		} else {
			jemul8.panic("Memory.registerMemoryHandlers() :: Registered"
				+ " memory handlers for unsupported device '"
				+ arg.getName() + "' (memory-mapped I/O address ranges"
				+ " are hardcoded in /classes/memory.js)");
		}
		
		jemul8.info("Memory.registerMemoryHandlers() ::"
			+ " Registered memory handlers for device '" + arg.getName()
			+ "' from " + $.format("hex", addrBegin)
			+ " -> " + $.format("hex", addrEnd));
		
		return true;
	};
	Memory.prototype.readSegment = function ( segment, offset, len ) {
		this.machine.cpu.XS.set(segment);
		return this.machine.cpu.XS.readSegment(offset, len);
	};
	Memory.prototype.readPhysical = function ( addrPhysical, len ) {
		this.machine.cpu.XS.set(0);
		return this.machine.cpu.XS.readSegment(addrPhysical, len);
	};
	Memory.prototype.writePhysical = function ( addrPhysical, len, val ) {
		this.machine.cpu.XS.set(0);
		this.machine.cpu.XS.writeSegment(addrPhysical, val, len);
	};
	
	var cache_cache_insn = [];
	// Augment the Segment Registers with efficient memory mapping subsystem
	SegRegister.prototype.set = function ( segment ) {
		//if ( /*this.name === "CS" && */(segment & 0xFFF) ) { debugger; }
		//if ( segment === 0xCA00 ) { debugger; }
		
		var machine = this.cpu.machine
			, cpu = machine.cpu, mem = machine.mem
			, addrA20, isBIOS, addrPage;
		
		// Mask out bits of value outside Register's bit-width
		segment &= this.bitmaskSize;
		
		// Don't bother doing any work if segment hasn't changed
		//if ( segment && (this.value === segment) ) { return; }
		
		// When (C)ode (S)egment is changed, eg. for a [far jmp],
		//	Instruction cache may need to be flushed
		if ( this === cpu.CS ) {
			cpu.cache_insn.length = 0;
			
			/*var cache_insn;
			// Cache-cache hit: restore previous cache
			if ( cache_insn = cache_cache_insn[ this.value ] ) {
				cpu.cache_insn = cache_insn;
			// Cache-cache miss: store (if RO) & empty cache
			} else {
				// Only cache this Instruction-cache if its segment
				//	is read-only: otherwise it could have changed,
				//	making the cache stale & invalid
				// - Segment may only be read-only in Real Mode if
				//	it is memory-mapped as read-only - see mappings below
				// - In Protected Mode, segment may be set as read-only
				//	in its access-rights, but segment could be written to
				//	by CPL-0 or have its access-rights changed, so would
				//	this concept apply there at all??
				if ( !this.hasOwnProperty("writeSegment") ) {
					cache_cache_insn[ this.value ] = cpu.cache_insn.slice();
				}
				// Flush the Instruction cache as they are stored by their
				//	offset into the segment and may now be invalid.
				// NB: Was "cpu.cache_insn.length = 0;"
				cpu.cache_insn = [];
			}*/
		}
		
		// This is still a register: store its value
		this.value = segment;
		
		// Convert segment to a physical address
		//	(store this masked, with A20-mask applied for speed later:
		//	the address + offset should not be outside the page
		//	so this should be ok)
		this.addrA20 = addrA20 = ((segment << 4) & machine.maskA20);
		
		// ???
		isBIOS = (addrA20 >= (~BIOS_MASK >>> 0));
		
		// Start address of the page containing segment
		//	Warning: "Unreal mode", where cpu is switched to protected mode,
		//	 segment limit set to > 64K & then switched back to Real Mode,
		//	 will mean that addresses _ARE_ valid outside the 64K page.
		addrPage = addrA20 & 0xFFFF0000;
		
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
		
		//jemul8.debug("SegRegister.set()");
		
		// Normal DRAM/physical memory read/write
		//	(must be within the non-memory-mapped area of memory
		//	& not addressing the CMOS BIOS @ top-end of address space)
		//	- Read/write/execute are all permitted here
		if ( (addrA20 < 0x000a0000 || addrA20 >= 0x00100000) && !isBIOS ) {
			// Check access is within guest DRAM size
			if ( addrA20 < mem.sizeDRAM ) {
				this.buf = mem.bufDRAM;
				// DRAM starts (of course) from address 0x00
				this.addrStart_buf = 0;
				
				// Polymorphic: Read/Write
				this.readSegment = poly_buf_readSegment;
				this.writeSegment = poly_buf_writeSegment;
				//this.execSegment = poly_buf_execSegment;
			} else {
				// TODO: It is ok to set a segreg to an invalid value,
				//	just not to then reference using the invalid value,
				//	so we need to delay any error msgs until then
				jemul8.problem("SegRegister.set() ::"
					+ " Address " + $.format("hex", addrA20)
					+ " beyond end of DRAM");
			}
		// VGA's I/O-mapped memory may be read from or written to
		//	(TODO: For now, this allows VGA memory to be executed;
		//	although this would probably never happen,
		//	should it be blocked?)
		} else if ( addrA20 >= 0x000a0000 && addrA20 < 0x000c0000 ) {
			this.handler = mem.handlers.vga;
			
			// Polymorphic: Read/Write
			this.readSegment = poly_handler_readSegment;
			this.writeSegment = poly_handler_writeSegment;
			//this.execSegment = poly_handler_execSegment;
		// ROMs & lower/upper BIOS areas
		} else if ( addrA20 >= 0x000c0000 && addrA20 < 0x00100000
				&& !isBIOS ) {
			
			// CMOS BIOS
			// - 0xE0000 -> 0xEFFFF	"Lower BIOS Area" (64K)
			// - 0xF0000 -> 0xFFFFF	"Upper BIOS Area" (64K)
			if ( (addrA20 & 0xfffe0000) === 0x000e0000 ) {
				this.buf = mem.bufROMs;
				
				// ROM memory buffer begins at 0xC0000 in physical memory
				this.addrStart_buf = 0xC0000;
				
				// Polymorphic: Read ONLY
				this.readSegment = poly_buf_readSegment;
				//delete this.writeSegment;
				this.writeSegment = poly_buf_writeSegment;
				//this.execSegment = poly_buf_execSegment;
			/*
			 *	Expansion ROMs/BIOSes
			 *	0xC0000 -> 0xDFFFF "Exp. Card BIOS and Buffer Area" (128K)
			 *	- (NB: For some reason, expansion ROM BIOS code area is not
			 *	  read-only - the VGABIOS writes to those addresses -
			 *	  unlike the CMOS one)
			 */
			} else {
				this.buf = mem.bufROMs;
				
				// ROM memory buffer begins at 0xC0000 in physical memory
				this.addrStart_buf = 0xC0000;
				
				// Polymorphic: Read/Write (see note above)
				this.readSegment = poly_buf_readSegment;
				this.writeSegment = poly_buf_writeSegment;
				//this.execSegment = poly_buf_execSegment;
			}
		} else if ( isBIOS ) {
			this.buf = mem.bufROMs; //this.buf = machine.cmos.bufBIOS;
			
			// CMOS loaded in segment 0xF000
			
			// ROM memory buffer begins at 0xC0000 in physical memory
			this.addrStart_buf = 0xC0000;
			//this.addrStart_buf = addrA20 & BIOS_MASK;
			
			// Polymorphic: Read ONLY
			this.readSegment = poly_buf_readSegment;
			//delete this.writeSegment;
			this.writeSegment = poly_buf_writeSegment;
			//this.execSegment = poly_buf_execSegment;
		} else {
			jemul8.problem("SegRegister.set() ::"
				+ " Address " + $.format("hex", addrA20) + " is out-of-bounds");
		}
		
		// Only permit access within the checked 64K page
		this.addrMin = addrPage;
		this.addrMax = addrPage + 0x0000FFFF;
	};
	// These methods are overridden/polymorphic depending on memory mapping
	//	for the requested segment - see SegRegister.set()
	/* poly */SegRegister.prototype.readSegment
	= function ( offset, len ) {
		jemul8.problem("SegRegister.readSegment() :: Read not allowed!");
	};
	/* poly */SegRegister.prototype.writeSegment
	= function ( offset, val, len ) {
		jemul8.problem("SegRegister.writeSegment() :: Write not allowed!");
		debugger;
	};
	
	function poly_handler_readSegment( offset, len ) {
		// (See above)
		// jemul8.assert(len <= 4, "MemoryAccessor.readSegment() :: Memory system"
		//	+ " only supports <= 32-bit addresses");
		// jemul8.assert(offset >= 0 && offset <= 0xFFFF
		//	, "SegRegister.readSegment() :: 'offset' < 0"
		//	+ " or > 64K (0xFFFF)");
		//debugger;
		
		return this.handler.fnRead(
			this.addrA20 + offset
			, len, this.handler.arg);
	}
	
	function poly_handler_writeSegment( offset, val, len ) {
		// For now, no support for writing > 4 bytes in one operation
		//	(should work, as DMA etc. only transfer one quantum at a time)
		// jemul8.assert(len <= 4, "MemoryAccessor.writeSegment() :: Memory system"
		//	+ " only supports <= 32-bit addresses");
		// jemul8.assert(offset >= 0 && offset <= 0xFFFF
		//	, "SegRegister.writeSegment() :: 'offset' < 0"
		//	+ " or > 64K (0xFFFF)");
		//debugger;
		
		return this.handler.fnWrite(
			this.addrA20 + offset
			, val, len, this.handler.arg);
	}
	
	// ArrayBuffers w/DataView support provide methods for fast
	//	reading of values from memory
	if ( 1||jemul8.support.typedDataView ) {
		// - See /tests/lookup_switch.htm for why this was chosen
		//	over eg. a switch() or list of if()/else
		map_len_get = { 1: "getUint8", 2: "getUint16", 4: "getUint32" };
		map_len_set = { 1: "setUint8", 2: "setUint16", 4: "setUint32" };
		
		// Read from memory buffer (little-endian)
		poly_buf_readSegment = function ( offset, len ) {
			// (See above)
			// jemul8.assert(len <= 4, "MemoryAccessor.readSegment() :: Memory system"
			// 	+ " only supports <= 32-bit addresses");
			// jemul8.assert(offset >= 0 && offset <= 0xFFFF
			// 	, "SegRegister.readSegment() :: 'offset' < 0"
			// 	+ " or > 64K (0xFFFF)");
			
			var buf = this.buf
				, addrA20 = (this.addrA20 + offset) - this.addrStart_buf;
			
			//try {
				// Use a fast lookup to decide how to read the value.
				//	Supported sizes are Byte (8-bit), Word (16-bit)
				//	or Dword (32-bit)
				return buf[ map_len_get[ len ] ](addrA20, true);
			//} catch ( e ) {
			//	debugger;
			//	return 0;
			//}
		};
		// Write to memory buffer (little-endian)
		poly_buf_writeSegment = function ( offset, val, len ) {
			// For now, no support for writing > 4 bytes in one operation
			//	(should work, as DMA etc. only transfer one quantum at a time)
			// jemul8.assert(len <= 4, "MemoryAccessor.writeSegment() :: Memory system"
			// 	+ " only supports <= 32-bit addresses");
			// jemul8.assert(offset >= 0 && offset <= 0xFFFF
			// 	, "SegRegister.writeSegment() :: 'offset' < 0"
			// 	+ " or > 64K (0xFFFF)");
			
			var buf = this.buf
				, addrA20 = (this.addrA20 + offset) - this.addrStart_buf;
			
			/** Warning: if write is beyond end of buffer, an exception
				will be thrown - we should test for this (in debug mode?) **/
			// Use a fast lookup to decide how to write the value.
			//	Supported sizes are Byte (8-bit), Word (16-bit)
			//	or Dword (32-bit)
			buf[ map_len_set[ len ] ](addrA20, val, true);
		};
	// Legacy Array-based support (& ArrayBuffers where DataView
	//	is not available)
	} else {
		// Read from memory buffer (little-endian)
		poly_buf_readSegment = function ( offset, len ) {
			var buf = this.buf
				, addrA20 = (this.addrA20 + offset) - this.addrStart_buf;
			
			switch ( len ) {
			case 1:	// Byte ( 8-bit )
				return buf[ addrA20 ];
			case 2:	// Word ( 16-bit )
				return (buf[ addrA20 + 1 ] << 8) | (buf[ addrA20 ]);
			case 4:	// Dword ( 32-bit )
				return (buf[ addrA20 + 3 ] << 24)
					| (buf[ addrA20 + 2 ] << 16)
					| (buf[ addrA20 + 1 ] << 8)
					| (buf[ addrA20 ]);
			default:
				jemul8.problem("poly_buf_readSegment() ::"
					+ " Operand-size > 32-bit");
			}
		};
		// Write to memory buffer (little-endian)
		poly_buf_writeSegment = function ( offset, val, len ) {
			var buf = this.buf
				, addrA20 = (this.addrA20 + offset) - this.addrStart_buf;
			
			switch ( len ) {
			case 1:	// Byte (8-bit)
				buf[ addrA20 ] = val;
				return;
			case 2:	// Word (16-bit / 2-bytes)
				buf[ addrA20 ] = val & 0xFF;
				buf[ addrA20 + 1 ] = (val >> 8) & 0xFF;
				return;
			case 4:	// Dword (32-bit / 4-bytes)
				buf[ addrA20 ] = val & 0xFF;
				buf[ addrA20 + 1 ] = (val >> 8) & 0xFF;
				buf[ addrA20 + 2 ] = (val >> 16) & 0xFF;
				buf[ addrA20 + 3 ] = (val >> 24) & 0xFF;
				return;
			default:
				jemul8.problem("poly_buf_writeSegment() ::"
					+ " Operand-size > 32-bit");
			}
		};
	}
	
	// Exports
	jemul8.Memory = Memory;
});
