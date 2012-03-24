/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: Memory (RAM) <-> Northbridge support
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("memory", function ( $ ) { "use strict";
	var jemul8 = this.data("jemul8")
		, SegRegister = jemul8.SegRegister
		, readBytes, writeBytes;
	
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
		this.bufDRAM = this.allocBuffer(sizeDRAM);
		this.sizeDRAM = sizeDRAM;
	};
	Memory.prototype.destroy = function () {
		// Free memory etc. when finished
		if ( jemul8.support.typedArrays ) {
			delete this.bufDRAM;
		} else {
			this.bufDRAM.length = 0;
		}
	};
	// TODO: Support ImageData for slightly older browsers
	//	(off Canvas context)
	Memory.prototype.allocBuffer = function ( len ) {
		var mem;
		// Ultra-modern, fast Typed Arrays support (faster)
		if ( jemul8.support.typedArrays ) {debugger;
			return new (jemul8.support.typedDataView ? DataView : Uint8Array)
				( new ArrayBuffer( len ) );
		// Legacy native Arrays support (slower)
		} else {
			mem = new Array( len );
			// Zero-out all bytes in memory (otherwise they will be undefined)
			//for ( var i = 0 ; i < len ; ++i ) {
			//	mem[ i ] = 0x00;
			//}
			return mem;
		}
	};
	// TODO: Support ImageData for slightly older browsers
	//	(off Canvas context)
	Memory.prototype.allocBuffer = function ( len, isGuestMapped ) {
		var mem;
		// Ultra-modern, fast Typed Arrays support (faster)
		if ( jemul8.support.typedArrays ) {
			return new (
					// If buffer will be mapped for direct guest access
					//	in memory.js, DataView should be faster
					//	for reading eg. multi-byte values
					isGuestMapped && jemul8.support.typedDataView
					? DataView : Uint8Array)
				( new ArrayBuffer( len ) );
		// Legacy native Arrays support (slower)
		} else {
			mem = new Array( len );
			// Zero-out all bytes in memory (otherwise they will be undefined)
			//for ( var i = 0 ; i < len ; ++i ) {
			//	mem[ i ] = 0x00;
			//}
			return mem;
		}
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
		//	in MemoryAccessor.check()
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
		
		jemul8.info("Memory.registerMemoryHandlers() :: Registered memory handlers"
			+ " for device '" + arg.getName()
			+ "' from " + $.format("hex", addrBegin)
			+ " -> " + $.format("hex", addrEnd));
		
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
		//	(store this unmasked, ie. don't apply A20-mask to it,
		//	this is applied later after adding the relevant offset)
		this.phyaddr = segment << 4;
		
		// Apply the A20-mask, to enforce the A20 address line toggle
		//	on all physical addresses
		addrA20 = this.phyaddr & machine.maskA20;
		
		// ???
		isBIOS = (addrA20 >= (~BIOS_MASK >>> 0));
		
		// Start address of the page containing segment
		addrPage = addrA20 & 0xFFFF0000;
		
		//jemul8.debug("MemoryAccessor.check()");
		
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
				jemul8.problem("MemoryAccessor.check() ::"
					+ " Address " + $.format("hex", addrA20) + " beyond end of DRAM");
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
				jemul8.problem("MemoryAccessor.check() :: Error,"
					+ " requested addr " + $.format("hex", addrA20)
					+ " is part of expansion ROM BIOS area but no ROM"
					+ " is mapped there");
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
			jemul8.problem("MemoryAccessor.check() ::"
				+ " Address " + $.format("hex", addrA20) + " out-of-bounds");
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
		jemul8.problem("SegRegister.readSegment() :: Read not allowed!");
	};
	/* poly */SegRegister.prototype.writeSegment
	= function ( offset, val, len ) {
		jemul8.problem("SegRegister.writeSegment() :: Write not allowed!");
	};
	
	function poly_buf_readSegment( offset, len ) {
		// For now, no support for reading > 4 bytes in one operation
		//	(should work, as DMA etc. only transfer one quantum at a time)
		// jemul8.assert(len <= 4, "MemoryAccessor.readSegment() :: Memory system"
		//	+ " only supports <= 32-bit addresses");
		// jemul8.assert(offset >= 0 && offset <= 0xFFFF
		//	, "SegRegister.readSegment() :: 'offset' < 0"
		//	+ " or > 64K (0xFFFF)");
		
		return readBytes(this.buf
			, ((this.phyaddr + offset) & this.cpu.machine.maskA20)
				- this.addrStart_buf
			, len);
	}
	function poly_handler_readSegment( offset, len ) {
		// (See above)
		// jemul8.assert(len <= 4, "MemoryAccessor.readSegment() :: Memory system"
		//	+ " only supports <= 32-bit addresses");
		// jemul8.assert(offset >= 0 && offset <= 0xFFFF
		//	, "SegRegister.readSegment() :: 'offset' < 0"
		//	+ " or > 64K (0xFFFF)");
		//debugger;
		
		return this.handler.fnRead(
			(this.phyaddr + offset) & this.cpu.machine.maskA20
			, len, this.handler.arg);
	}
	
	function poly_buf_writeSegment( offset, val, len ) {
		// For now, no support for reading > 4 bytes in one operation
		//	(should work, as DMA etc. only transfer one quantum at a time)
		// jemul8.assert(len <= 4, "MemoryAccessor.writeSegment() :: Memory system"
		//	+ " only supports <= 32-bit addresses");
		// jemul8.assert(offset >= 0 && offset <= 0xFFFF
		//	, "SegRegister.writeSegment() :: 'offset' < 0"
		//	+ " or > 64K (0xFFFF)");
		
		writeBytes(this.buf
			, ((this.phyaddr + offset) & this.cpu.machine.maskA20)
				- this.addrStart_buf
			, val, len);
	}
	function poly_handler_writeSegment( offset, val, len ) {
		// For now, no support for reading > 4 bytes in one operation
		//	(should work, as DMA etc. only transfer one quantum at a time)
		// jemul8.assert(len <= 4, "MemoryAccessor.writeSegment() :: Memory system"
		//	+ " only supports <= 32-bit addresses");
		// jemul8.assert(offset >= 0 && offset <= 0xFFFF
		//	, "SegRegister.writeSegment() :: 'offset' < 0"
		//	+ " or > 64K (0xFFFF)");
		//debugger;
		
		return this.handler.fnWrite(
			(this.phyaddr + offset) & this.cpu.machine.maskA20
			, val, len, this.handler.arg);
	}
	
	// DataView support (with ArrayBuffers) provides methods for fast
	//	reading of values from memory
	if ( jemul8.support.typedDataView ) {
		// Read from memory buffer (little-endian)
		//	(A20 should already be applied)
		readBytes = function ( buf, addrA20, len ) {debugger;
			switch ( len ) {
			case 1:	// Byte (8-bit)
				return buf.getUint8(addrA20);
			case 2:	// Word (16-bit)
				return buf.getUint16(addrA20, true);
			case 4:	// Dword (32-bit)
				return buf.getUint32(addrA20, true);
			default:
				jemul8.problem("readBytes() :: Operand-size > 32-bit");
			}
		};
		// Write to memory buffer (little-endian)
		//	(A20 should already be applied)
		writeBytes = function ( buf, addrA20, val, len ) {
			/** Warning: if write is beyond end of buffer, an exception
				will be thrown - we should test for this (in debug mode?) **/
			switch ( len ) {
			case 1:	// Byte (8-bit)
				buf.setUint8(addrA20, val);
				return;
			case 2:	// Word (16-bit / 2-bytes)
				buf.setUint16(addrA20, val, true);
				return;
			case 4:	// Dword (32-bit / 4-bytes)
				buf.setUint32(addrA20, val, true);
				return;
			default:
				jemul8.problem("writeBytes() :: Operand-size > 32-bit");
			}
		};
	// Legacy Array-based support (& ArrayBuffers where DataView
	//	is not available)
	} else {
		// Read from memory buffer (little-endian)
		//	(A20 should already be applied)
		readBytes = function ( buf, addrA20, len ) {
			switch ( len ) {
			case 1:	// Byte ( 8-bit )
				return buf[ addrA20 ];
			case 2:	// Word ( 16-bit )
				return (buf[ addrA20 + 1 ] << 8) | (buf[ addrA20 ]);
			case 4:	// Dword ( 32-bit )
				return (buf[ addrA20 + 3 ] << 24)
					| (buf[ addrA20 + 2 ] << 16)
					| (buf[ addrA20 + 1 ] << 8) | (buf[ addrA20 ]);
			default:
				jemul8.problem("readBytes() :: Operand-size > 32-bit");
			}
		};
		// Write to memory buffer (little-endian)
		//	(A20 should already be applied)
		writeBytes = function ( buf, addrA20, val, len ) {
			/* ==== Guards ==== */
			// jemul8.assert(val === (val & jemul8.generateMask(len))
			//	, "writeBytes() :: Value is greater in bytes than size");
			/* ==== /Guards ==== */
			
			//if ( addrA20 >= 0xa0000 && addrA20 <= 0xbffff ) { debugger; }
			
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
				jemul8.problem("writeBytes() :: Operand-size > 32-bit");
			}
		};
	}
	
	// Exports
	jemul8.Memory = Memory;
});
