/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: Memory (RAM) <-> Northbridge support
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("memory", function ( $ ) { "use strict";
	var jemul8 = this.data("jemul8");
	
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
		this.bufDRAM = jemul8.allocBuffer(sizeDRAM);
		this.sizeDRAM = sizeDRAM;
	};
	Memory.prototype.destroy = function () {
		// Free memory etc. when finished
		if ( jemul8.supportsTypedArrays ) {
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
				+ " memory handlers for unsupported device '%s' (memory-mapped"
				+ " I/O address ranges are hardcoded in /classes/memory.js)"
				, arg.getName);
		}
		
		jemul8.info("Memory.registerMemoryHandlers() :: Registered memory handlers"
			+ " for device '%s' from %08X -> %08X"
			, arg.getName(), addrBegin, addrEnd);
		
		return true;
	};
	// Provides a MemoryAccessor for the page containing the specified
	//	physical address
	Memory.prototype.createAccessor = function ( type ) {
		// Check 'type' is valid
		jemul8.assert(type >= 0 && type <= 3, "Memory.request() ::"
			+ " 'type' is invalid");
		
		return new MemoryAccessor( this, type );
	};
	
	// Provides access to memory within the requested page:
	//	it will automatically recheck if accessed outside the page
	function MemoryAccessor( mem, type ) {
		this.mem = mem;				// Ref. to owning Memory object
		this.buf;					// Current buffer used
		this.addr_bufStart;			// Physical address of start of buffer
		this.addrMin;				// Min. physical address allowed
		this.addrMax;				// Max. physical address allowed
		this.handler;				// Handler object			
		this.type = type;			// (TYPE_[READ|WRITE|EXECUTE|RW])
		this.access = ACCESS_NONE;	// Access system (none, buffer or handlers)
	}
	// Performs a check to ensure the specified address may be accessed
	//	& the specified operation-type performed
	//	(A20 should already be applied)
	MemoryAccessor.prototype.check = function ( addrA20, type ) {
		var isWrite = type & TYPE_WRITE
			, isBIOS = (addrA20 >= (~BIOS_MASK >>> 0))
			// Start address of the page containing address
			, addrPage = addrA20 & 0xFFFF0000
			, buf, handler
			, access = ACCESS_NONE
			// Start address of the buffer address is mapped to
			//	(eg. could be this.memDRAM, cmos.bufBIOS,
			//	vga.bufBIOS, vga.bufData etc.)
			, addr_bufStart;
		
		//jemul8.debug("MemoryAccessor.check()");
		
		
		// Normal DRAM/physical memory read/write
		//	(must be within the non-memory-mapped area of memory
		//	& not addressing the CMOS BIOS @ top-end of address space)
		//	- Read/write/execute are all permitted here
		if ( (addrA20 < 0x000c0000 || addrA20 >= 0x00100000) && !isBIOS ) {
			// Check access is within guest DRAM size
			if ( addrA20 < this.mem.sizeDRAM ) {
				buf = this.mem.bufDRAM;
				// DRAM starts (of course) from address 0x00
				addr_bufStart = 0;
				access = ACCESS_BUFFER;
			} else {
				jemul8.problem("MemoryAccessor.check() ::"
					+ " Address %08X beyond end of DRAM", addrA20);
			}
		// VGA's I/O-mapped memory may be read from or written to,
		//	(TODO: For now, this allows VGA memory to be executed;
		//	although this would probably never happen,
		//	should it be blocked?)
		} else if ( addrA20 >= 0x000a0000 && addrA20 < 0x000c0000 ) {
			//buf = this.mem.machine.vga.memVRAM;
			//addr_bufStart = 0x000a0000;
			handler = this.mem.handlers.vga;
			access = ACCESS_HANDLER;
		// ROMs & lower/upper BIOS areas
		} else if ( addrA20 >= 0x000c0000 && addrA20 < 0x00100000
				&& !isBIOS ) {
			
			// CMOS BIOS
			// - 0xE0000 -> 0xEFFFF	"Lower BIOS Area" (64K)
			// - 0xF0000 -> 0xFFFFF	"Upper BIOS Area" (64K)
			if ( (addrA20 & 0xfffe0000) === 0x000e0000 ) {
				// CMOS ROM is read-only!
				if ( type & TYPE_READ ) {
					buf = this.mem.machine.cmos.bufBIOS;
					// CMOS loaded in segment 0xF000
					addr_bufStart = 0xF0000;
					access = ACCESS_BUFFER;
					//jemul8.panic("ROM mappings... ?!");
					
					// last 128K of BIOS ROM mapped to 0xE0000-0xFFFFF
					//return (Bit8u *) &BX_MEM_THIS rom[BIOS_MAP_LAST128K(a20addr)];
				} else {
					jemul8.problem("MemoryAccessor.check() :: Error,"
						+ " requested addr 0x%08X is part of CMOS"
						+ " ROM BIOS code area & is read-only", addrA20);
				}
			/*
			 *	Expansion ROMs/BIOSes
			 *	0xC0000 -> 0xDFFFF "Exp. Card BIOS and Buffer Area" (128K)
			 *	- (NB: For some reason, expansion ROM BIOS code area is not
			 *	  read-only - the VGABIOS writes to those addresses -
			 *	  unlike the CMOS one)
			 */
			// VGA BIOS @ 0xC0000
			} else if ( (addrA20 & 0xfffC0000) === 0x000C0000 ) {
				buf = this.mem.machine.vga.bufBIOS;
				addr_bufStart = 0xC0000;
				access = ACCESS_BUFFER;
				//jemul8.panic("ROM mappings... ?!");
				//return((Bit8u *) &BX_MEM_THIS rom[(a20addr & EXROM_MASK) + BIOSROMSZ]);
			} else {
				jemul8.problem("MemoryAccessor.check() :: Error,"
					+ " requested addr 0x%08X is part of expansion"
					+ " ROM BIOS area but no ROM is mapped there", addrA20);
			}
		} else if ( isBIOS ) {
			buf = this.mem.machine.cmos.bufBIOS;
			// CMOS loaded in segment 0xF000
			addr_bufStart = 0xF0000;
			access = ACCESS_BUFFER;
		} else {
			jemul8.problem("MemoryAccessor.check() ::"
				+ " Address 0x%08X out-of-bounds", addrA20);
		}
		
		this.access = access;
		// Only permit access within the checked 64K page
		this.addrMin = addrPage;
		this.addrMax = addrPage + 0x0000FFFF;
		// Only permit the requested type(s) of operation
		this.type = type;
		
		// Direct access is permitted via a memory buffer
		if ( access === ACCESS_BUFFER ) {
			this.buf = buf;	// Use the relevant memory buffer
			// Used to convert physical addresses to buffer-relative ones
			this.addr_bufStart = addr_bufStart;
		// Access is permitted via read & write handler functions
		} else if ( access === ACCESS_HANDLER ) {
			this.handler = handler;
		}
		
		/** Otherwise access is NOT permitted for the specified type(s) **/
		
		return access;
	};
	MemoryAccessor.prototype.readBytes = function ( addr, len ) {
		// For now, no support for reading > 4 bytes in one operation
		//	(should work, as DMA etc. only transfer one quantum at a time)
		jemul8.assert(len <= 4, "MemoryAccessor.readBytes() :: Memory system"
			+ " only supports <= 32-bit addresses");
		
		var machine = this.mem.machine
			// Apply the A20 "mask", to enforce the A20 address line toggle
			//	on all physical addresses
			, addrA20 = addr & machine.maskA20;
		
		// Access needs to be re-checked:
		if ( /*1 || */this.access === ACCESS_NONE // Check access is permitted already
				|| !(this.type & TYPE_READ) // Check operation is permitted
				// Check address is within permitted page
				|| addrA20 < this.addrMin || addrA20 > this.addrMax ) {
			
			// Just return a bogus value
			//	if the read was veto'd & not permitted
			if ( this.check(addrA20, TYPE_READ) === ACCESS_NONE ) {
				return 0;
			}
		}
		
		// Directly access memory buffer if applicable
		if ( this.access === ACCESS_BUFFER ) {
			return readBytes(this.buf, addrA20 - this.addr_bufStart, len);
		}
		
		return this.handler.fnRead(addrA20, len, this.handler.arg);
	};
	MemoryAccessor.prototype.writeBytes = function ( addr, val, len ) {
		// (See note in .readBytes())
		jemul8.assert(len <= 4, "MemoryAccessor.writeBytes() :: Memory system"
			+ " only supports <= 32-bit addresses");
		
		var machine = this.mem.machine
			// Apply the A20 "mask", to enforce the A20 address line toggle
			//	on all physical addresses
			, addrA20 = addr & machine.maskA20;
		
		// Access needs to be re-checked:
		if ( this.access === ACCESS_NONE // Check access is permitted already
				|| !(this.type & TYPE_WRITE) // Check operation is permitted
				// Check address is within permitted page
				|| addrA20 < this.addrMin || addrA20 > this.addrMax ) {
			// Just ignore the write if veto'd & not permitted
			if ( this.check(addrA20, TYPE_WRITE) === ACCESS_NONE ) {
				return;
			}
		}
		
		// Directly access memory buffer if applicable
		if ( this.access === ACCESS_BUFFER ) {
			writeBytes(this.buf, addrA20 - this.addr_bufStart, val, len);
			return;
		}
		
		return this.handler.fnWrite(addrA20, val, len, this.handler.arg);
	};
	
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
			jemul8.problem("readBytes() :: Operand size > 32-bit not supported");
		}
	}
	// Write to memory buffer (little-endian)
	//	(A20 should already be applied)
	function writeBytes( buf, addr, val, len ) {
		/* ==== Guards ==== */
		jemul8.assert(val === (val & jemul8.generateMask(len))
			, "writeBytes() :: Value is greater in bytes than size");
		/* ==== /Guards ==== */
		
		//var machine = this.machine, cpu = machine.cpu;
		
		//if ( addr >= 0xa0000 && addr <= 0xbffff ) { debugger; }
		
		// Use size of operand to determine how many bytes to write
		switch ( len ) {
		case 1:	// Byte (8-bit)
			buf[ addr ] = val;
			// Delete from CPU Instruction Cache
			//	(caused by eg. polymorphic code)
			//cpu.cache_insn[ addr ] = undefined;
			return;
		case 2:	// Word (16-bit / 2-bytes)
			buf[ addr ] = val & 0xFF;
			buf[ addr + 1 ] = (val >> 8) & 0xFF;
			// Delete from CPU Instruction Cache
			//	(caused by eg. polymorphic code)
			//cpu.cache_insn[ addr ] = cpu.cache_insn[ addr + 1 ]
			//	= undefined;
			return;
		case 4:	// Dword (32-bit / 4-bytes)
			buf[ addr ] = val & 0xFF;
			buf[ addr + 1 ] = (val >> 8) & 0xFF;
			buf[ addr + 2 ] = (val >> 16) & 0xFF;
			buf[ addr + 3 ] = (val >> 24) & 0xFF;
			// Delete from CPU Instruction Cache
			//	(caused by eg. polymorphic code)
			//cpu.cache_insn[ addr ] = cpu.cache_insn[ addr + 1 ]
			//	= cpu.cache_insn[ addr + 2 ] = cpu.cache_insn[ addr + 3 ]
			//	= undefined;
			return;
		default:
			jemul8.problem("writeBytes() :: Operand size > 32-bit not supported");
		}
	}
	
	// Exports
	jemul8.Memory = Memory;
});
