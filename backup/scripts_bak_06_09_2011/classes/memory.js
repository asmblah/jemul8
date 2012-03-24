/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: Memory (RAM) <-> Northbridge support
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("memory", function ( $ ) { "use strict";
	var x86Emu = this.data("x86Emu")
		, SegRegister = x86Emu.SegRegister;
	
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
		
		//, BIOS_MAP_LAST128K(addr) (((addr) | 0xfff00000) & BIOS_MASK);
	
	// Memory subsystem class constructor
	function Memory( machine ) {
		this.machine = machine;
		
		// Physical memory / DRAM
		this.bufDRAM = null;
		
		// Memory access handlers
		this.handlers = {};
	}
	// Set up memory subsystem
	Memory.prototype.init = function () {
		var idx, sizeDRAM = 1024 * 1024;
		
		// Ask system to allocate a memory buffer
		//	to initialise the emulated DRAM Controller
		this.bufDRAM = x86Emu.allocBuffer(sizeDRAM);
		this.sizeDRAM = sizeDRAM;
	};
	Memory.prototype.destroy = function () {
		// Free memory etc. when finished
		if ( x86Emu.supportsTypedArrays ) {
			delete this.bufDRAM;
		} else {
			this.bufDRAM.length = 0;
		}
	};
	// Register memory read & write handlers for the specified address range
	//	(For now, until/if it causes a problem, all I/O memory mapping
	//	is hardcoded: however, this mechanism is still used to allow
	//	easy migration if this situation is ever changed.)
	Memory.prototype.registerMemoryHandlers
	= function ( addrBegin, addrEnd, fnRead, fnWrite, arg ) {
		/* ==== Guards ==== */
		$.assert(!isNaN(addrBegin) && addrBegin === parseInt(addrBegin)
			, "Memory.registerMemoryHandlers() ::"
			+ " 'addrBegin' must be an integer");
		$.assert(!isNaN(addrEnd) && addrEnd === parseInt(addrEnd)
			, "Memory.registerMemoryHandlers() ::"
			+ " 'addrEnd' must be an integer");
		$.assert(addrBegin <= addrEnd
			, "Memory.registerMemoryHandlers() ::"
			+ " 'addrBegin' must be <= 'addrEnd'");
		$.assert($.isFunction(fnRead)
			, "Memory.registerMemoryHandlers() ::"
			+ " 'fnRead' must be a valid callback (function)");
		$.assert($.isFunction(fnWrite)
			, "Memory.registerMemoryHandlers() ::"
			+ " 'fnWrite' must be a valid callback (function)");
		// 'arg' may not be a device in future...!
		$.assert(arg && (arg instanceof x86Emu.IODevice)
			, "Memory.registerMemoryHandlers() ::"
			+ " 'arg' must be an IODevice");
		/* ==== /Guards ==== */
		
		var machine = arg.machine;
		
		// Check device is supported here,
		//	then just verify arguments with the hard-coding
		//	in MemoryAccessor.check()
		if ( arg === machine.vga ) {
			if ( addrBegin === 0xa0000 && addrEnd === 0xbffff ) {
				this.handlers.vga = {
					arg: arg			// Argument to handlers (eg. I/O device)
					, fnRead: fnRead	// Memory read handler
					, fnWrite: fnWrite	// Memory write handler
				};
			} else {
				$.panic("Memory.registerMemoryHandlers() :: VGA addresses"
					+ " do not match the hard-coded ones");
			}
		// Unsupported device (!)
		} else {
			$.panic("Memory.registerMemoryHandlers() :: Registered"
				+ " memory handlers for unsupported device '%s' (memory-mapped"
				+ " I/O address ranges are hardcoded in /classes/memory.js)"
				, arg.getName);
		}
		
		$.info("Memory.registerMemoryHandlers() :: Registered memory handlers"
			+ " for device '%s' from %08X -> %08X"
			, arg.getName(), addrBegin, addrEnd);
		
		return true;
	};
	Memory.prototype.readSegment = function ( segment, offset, len ) {
		this.machine.cpu.XS.set(segment);
		return this.machine.cpu.XS.readSegment(offset, len);
	};
	
	// Augment the Segment Registers with efficient memory mapping subsystem
	SegRegister.prototype.set = function ( segment ) {
		//if ( this.name === "CS" && (segment & 0xFFF) ) { debugger; }
		var machine = this.cpu.machine
			, cpu = machine.cpu, mem = machine.mem
			, addrA20, isBIOS, addrPage;
		
		// Mask out bits of value outside Register's bit-width
		segment &= this.bitmaskSize;
		
		// This is still a register: store its value
		this.value = segment;
		
		// Convert segment to a physical address
		this.phyaddr = segment << 4;
		
		// Apply the A20 "mask", to enforce the A20 address line toggle
		//	on all physical addresses
		addrA20 = this.phyaddr & machine.maskA20;
		
		// ???
		isBIOS = (addrA20 >= (~BIOS_MASK >>> 0));
		
		// Start address of the page containing segment
		addrPage = addrA20 & 0xFFFF0000;
		
		//$.debug("MemoryAccessor.check()");
		
		// Normal DRAM/physical memory read/write
		//	(must be within the non-memory-mapped area of memory
		//	& not addressing the CMOS BIOS @ top-end of address space)
		//	- Read/write/execute are all permitted here
		if ( (addrA20 < 0x000c0000 || addrA20 >= 0x00100000) && !isBIOS ) {
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
				$.problem("MemoryAccessor.check() ::"
					+ " Address %08X beyond end of DRAM", addrA20);
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
				this.buf = machine.cmos.bufBIOS;
				// CMOS loaded in segment 0xF000
				this.addrStart_buf = 0xF0000;
				
				// Polymorphic: Read ONLY
				this.readSegment = poly_buf_readSegment;
				delete this.writeSegment;
				//this.writeSegment = poly_none_writeSegment;
				//this.execSegment = poly_buf_execSegment;
				
				// last 128K of BIOS ROM mapped to 0xE0000-0xFFFFF
				//return (Bit8u *) &BX_MEM_THIS rom[BIOS_MAP_LAST128K(a20addr)];
			/*
			 *	Expansion ROMs/BIOSes
			 *	0xC0000 -> 0xDFFFF "Exp. Card BIOS and Buffer Area" (128K)
			 *	- (NB: For some reason, expansion ROM BIOS code area is not
			 *	  read-only - the VGABIOS writes to those addresses -
			 *	  unlike the CMOS one)
			 */
			// VGA BIOS @ 0xC0000
			} else if ( (addrA20 & 0xfffC0000) === 0x000C0000 ) {
				this.buf = machine.vga.bufBIOS;
				this.addrStart_buf = 0xC0000;
				
				// Polymorphic: Read/Write (see note above)
				this.readSegment = poly_buf_readSegment;
				this.writeSegment = poly_buf_writeSegment;
				//this.execSegment = poly_buf_execSegment;
				
				//return((Bit8u *) &BX_MEM_THIS rom[(a20addr & EXROM_MASK) + BIOSROMSZ]);
			} else {
				$.problem("MemoryAccessor.check() :: Error,"
					+ " requested addr 0x%08X is part of expansion"
					+ " ROM BIOS area but no ROM is mapped there", addrA20);
			}
		} else if ( isBIOS ) {
			this.buf = machine.cmos.bufBIOS;
			// CMOS loaded in segment 0xF000
			this.addrStart_buf = 0xF0000;
			
			// Polymorphic: Read ONLY
			this.readSegment = poly_buf_readSegment;
			delete this.writeSegment;
			//this.writeSegment = poly_none_writeSegment;
			//this.execSegment = poly_buf_execSegment;
		} else {
			$.problem("MemoryAccessor.check() ::"
				+ " Address 0x%08X out-of-bounds", addrA20);
		}
		
		// Only permit access within the checked 64K page
		this.addrMin = addrPage;
		this.addrMax = addrPage + 0x0000FFFF;
		
		// When (C)ode (S)egment is changed, eg. for a [far jmp],
		//	flush the Instruction cache as they are stored by their
		//	offset into the segment and may now be invalid.
		if ( this === cpu.CS ) {
			cpu.cache_insn.length = 0;
		}
	};
	// In real mode, memory is divided into 64K segments
	/* poly */SegRegister.prototype.readSegment
	= function ( offset, len ) {
		$.problem("SegRegister.readSegment() :: Read not allowed!");
	};
	/* poly */SegRegister.prototype.writeSegment
	= function ( offset, val, len ) {
		$.problem("SegRegister.writeSegment() :: Write not allowed!");
	};
	
	function poly_buf_readSegment( offset, len ) {
		// For now, no support for reading > 4 bytes in one operation
		//	(should work, as DMA etc. only transfer one quantum at a time)
		// $.assert(len <= 4, "MemoryAccessor.readSegment() :: Memory system"
		//	+ " only supports <= 32-bit addresses");
		
		if ( offset < 0 || offset > 0xFFFF ) {
			$.panic("SegRegister.readSegment() :: 'offset' < 0"
				+ " or > 64K (0xFFFF)");
		}
		return readBytes(this.buf
			, ((this.phyaddr + offset) & this.cpu.machine.maskA20)
				- this.addrStart_buf
			, len);
	}
	function poly_handler_readSegment( offset, len ) {
		// (See above)
		// $.assert(len <= 4, "MemoryAccessor.readSegment() :: Memory system"
		//	+ " only supports <= 32-bit addresses");
		
		if ( offset < 0 || offset > 0xFFFF ) {
			$.panic("SegRegister.readSegment() :: 'offset' < 0"
				+ " or > 64K (0xFFFF)");
		}
		
		return this.handler.fnRead(
			(this.phyaddr + offset) & this.cpu.machine.maskA20
			, len, this.handler.arg);
	}
	
	function poly_buf_writeSegment( offset, val, len ) {
		// For now, no support for reading > 4 bytes in one operation
		//	(should work, as DMA etc. only transfer one quantum at a time)
		// $.assert(len <= 4, "MemoryAccessor.writeSegment() :: Memory system"
		//	+ " only supports <= 32-bit addresses");
		
		if ( offset < 0 || offset > 0xFFFF ) {
			$.panic("SegRegister.writeSegment() :: 'offset' < 0"
				+ " or > 64K (0xFFFF)");
		}
		writeBytes(this.buf
			, ((this.phyaddr + offset) & this.cpu.machine.maskA20)
				- this.addrStart_buf
			, val, len);
	}
	function poly_handler_writeSegment( offset, val, len ) {
		// For now, no support for reading > 4 bytes in one operation
		//	(should work, as DMA etc. only transfer one quantum at a time)
		// $.assert(len <= 4, "MemoryAccessor.writeSegment() :: Memory system"
		//	+ " only supports <= 32-bit addresses");
		
		if ( offset < 0 || offset > 0xFFFF ) {
			$.panic("SegRegister.writeSegment() :: 'offset' < 0"
				+ " or > 64K (0xFFFF)");
		}
		return this.handler.fnWrite(
			(this.phyaddr + offset) & this.cpu.machine.maskA20
			, val, len, this.handler.arg);
	}
	
	// Read from memory buffer (little-endian)
	//	(A20 should already be applied)
	function readBytes( buf, addr, len ) {
		// Use size of operand to determine how many bytes to read
		switch ( len ) {
		case 1:	// Byte ( 8-bit )
			return buf[ addr ];
		case 2:	// Word ( 16-bit )
			return (buf[ addr + 1 ] << 8) | (buf[ addr ]);
		case 4:	// Dword ( 32-bit )
			return (buf[ addr + 3 ] << 24)
				| (buf[ addr + 2 ] << 16)
				| (buf[ addr + 1 ] << 8) | (buf[ addr ]);
		default:
			$.problem("readBytes() :: Operand size > 32-bit not supported");
		}
	}
	// Write to memory buffer (little-endian)
	//	(A20 should already be applied)
	function writeBytes( buf, addr, val, len ) {
		/* ==== Guards ==== */
		// $.assert(val === (val & x86Emu.generateMask(len))
		//	, "writeBytes() :: Value is greater in bytes than size");
		/* ==== /Guards ==== */
		
		//if ( addr >= 0xa0000 && addr <= 0xbffff ) { debugger; }
		
		// Use size of operand to determine how many bytes to write
		switch ( len ) {
		case 1:	// Byte (8-bit)
			buf[ addr ] = val;
			return;
		case 2:	// Word (16-bit / 2-bytes)
			buf[ addr ] = val & 0xFF;
			buf[ addr + 1 ] = (val >> 8) & 0xFF;
			return;
		case 4:	// Dword (32-bit / 4-bytes)
			buf[ addr ] = val & 0xFF;
			buf[ addr + 1 ] = (val >> 8) & 0xFF;
			buf[ addr + 2 ] = (val >> 16) & 0xFF;
			buf[ addr + 3 ] = (val >> 24) & 0xFF;
			return;
		default:
			$.problem("writeBytes() :: Operand size > 32-bit not supported");
		}
	}
	
	// Exports
	x86Emu.Memory = Memory;
});
