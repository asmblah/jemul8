/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: Memory (RAM) <-> Northbridge support
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("memory", function ( $ ) { "use strict";
	var x86Emu = this.data("x86Emu");
	
	var PHY_MEM_WIDTH = 32
		// Calc total no. of handler groups (1 per megabyte)
		, MEM_HANDLERS = x86Emu.shr(x86Emu.shl(1, PHY_MEM_WIDTH), 20)
		
		// Memory access types (read/write/execute/rw)
		, TYPE_READ		= 0
		, TYPE_WRITE	= 1
		, TYPE_EXECUTE	= 2
		, TYPE_RW		= 3;
	
	// Memory subsystem class constructor
	function Memory( machine ) {
		this.machine = machine;
		
		// Physical memory / DRAM
		this.bufDRAM = null;
		
		// Memory handler groups (1 per megabyte): this allows many handlers
		//	to be registered without (hopefully) having too much impact
		//	on performance
		this.hsh_page_list_handlerMemory = {};
		
		this.hsh_idx_page = {};
	}
	// Set up memory subsystem
	Memory.prototype.init = function () {
		var idx, sizeBytes = 1024 * 1024, buf, idx_page_addrA20;
		
		// Ask system to allocate a memory buffer
		//	to initialise the emulated DRAM Controller
		this.bufDRAM = x86Emu.allocBuffer(sizeBytes);
		
		// Set up memory handler group lists
		//for ( idx = 0 ; idx < MEM_HANDLERS ; ++idx ) {
		//	this.hsh_page_list_handlerMemory[ idx ] = [];
		//}
		
		/*
		// Set up memory handlers
		
		// VGA
		//	(TODO: Also address of SMM code, investigate)
		buf = this.machine.vga.memVRAM;
		for ( idx_page_addrA20 = 0x000a/ *0000* /
				; idx_page_addrA20 < 0x000c/ *0000* /
				; ++idx_page_addrA20 ) {
			this.hsh_idx_page[ idx_page_addrA20 ] = new MemoryPage(
				idx_page_addrA20 << 16
				, buf
				, 
		}*/
		
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
		/* ==== /Guards ==== */
		
		var idx, idxStart = x86Emu.shr(addrBegin, 20)
			, idxEnd = x86Emu.shr(addrEnd, 20);
		
		for ( idx = idxStart ; idx <= idxEnd ; ++idx ) {
			this.hsh_page_list_handlerMemory[ idx ] = new MemoryHandler(
				addrBegin, addrEnd, fnRead, fnWrite, arg
			);
		}
		
		$.info("Memory.registerMemoryHandlers() :: Registered memory handlers"
			+ " from %08X -> %08X", addrBegin, addrEnd);
		
		return true;
	};
	// Provides a MemoryAccessor for the page containing the specified
	//	physical address
	Memory.prototype.request = function ( addr, type ) {
		var machine = this.mem.machine
			// Apply the A20 "mask", to enforce the A20 address line toggle
			//	on all physical addresses
			, addrA20 = addr & machine.maskA20;
		
		return new MemoryAccessor( this, addrA20, type );
	};
	
	// Refers to a single 1-megabyte "page" in memory, where "memory"
	//	may refer to DRAM or memory-mapped I/O from a device
	/*function MemoryPage(
			phyaddr				// Physical address of 1st byte in page
			, buf				// Buffer containing page
			, phyaddr_buf		// Physical address of 1st byte of buffer
			, fnRead, fnWrite	// Access handlers
			, type				// Type(s) of operation permitted
			, arg				// Optional extra arg (eg. an I/O device)
			) {
		this.phyaddrStart = phyaddr;
		this.phyaddrEnd = phyaddr + 0x000FFFFF;
		this.buf = buf;
		this.phyaddr_buf = phyaddr_buf;
		this.fnRead = fnRead;
		this.fnWrite = fnWrite;
		this.arg = arg;
	}*/
	
	// Provides access to memory within the requested page:
	//	it will automatically recheck if accessed outside the page
	function MemoryAccessor( mem, addr, type ) {
		this.mem = mem;		// Ref. to owning Memory object
		this.buf;			// Current buffer used
		this.addr_bufStart;	// Physical address of start-of-buffer 'buf'
		this.addrMin;		// Min. physical address allowed
		this.addrMax;		// Max. physical address allowed
		this.type;			// Type allowed
		this.check(addr, type);
	}
	// Performs a check to ensure the specified address may be accessed
	//	& the specified operation-type performed
	//	(A20 should already be applied)
	MemoryAccessor.prototype.check = function ( addrA20, type ) {
		var isWrite = type & TYPE_WRITE
			// Start address of the page containing address
			, addrPage = addr & 0xFFF00000
			, buf
			// Start address of the buffer address is mapped to
			//	(eg. could be this.memDRAM, cmos.bufBIOS,
			//	vga.bufBIOS, vga.bufData etc.)
			, addr_bufStart;
		
		if ( !isWrite ) {
			if ( addrA20 >= 0x000a0000 && addrA20 < 0x000c0000 ) {
				buf = machine.vga.memVRAM;
				addr_bufStart = 0x000a0000;
				addrPage = 
			}
		} else {
			
		}
		
		// Access is permitted
		if ( ... ) {
			this.buf = buf;	// Use the relevant memory buffer
			// Used to convert physical addresses to buffer-relative ones
			this.addr_bufStart = addr_bufStart;
			// Only permit access within the checked 4-megabyte page
			this.addrMin = addrPage;
			this.addrMax = addrPage + 0x000FFFFF;
			// Only permit the requested type(s) of operation
			this.type = type;
		// Access is NOT permitted for the specified type(s)
		} else {
			this.buf = this.type
				= null;
			this.addr_bufStart = this.addrMin = this.addrMax
				= 0;
		}
	};
	MemoryAccessor.prototype.readBytes = function ( addr, num ) {
		var machine = this.mem.machine
			// Apply the A20 "mask", to enforce the A20 address line toggle
			//	on all physical addresses
			, addrA20 = addr & machine.maskA20;
		
		// Access needs to be re-checked:
		if ( !this.buf // Check access is permitted already
				|| !(this.type & TYPE_READ) // Check operation is permitted
				// Check address is within permitted page
				|| addrA20 < this.addrMin || addrA20 > this.addrMax ) {
			// Just return a bogus value
			//	if the read was veto'd & not permitted
			if ( !this.check(addrA20, TYPE_READ) ) {
				return 0;
			}
		}
		
		return readBytes(this.buf, addrA20 - this.addr_bufStart, num);
	};
	MemoryAccessor.prototype.writeBytes = function ( addr, val, num ) {
		var machine = this.mem.machine
			// Apply the A20 "mask", to enforce the A20 address line toggle
			//	on all physical addresses
			, addrA20 = addr & machine.maskA20;
		
		// Access needs to be re-checked:
		if ( !this.buf // Check access is permitted already
				|| !(this.type & TYPE_WRITE) // Check operation is permitted
				// Check address is within permitted page
				|| addrA20 < this.addrMin || addrA20 > this.addrMax ) {
			// Just ignore the write if veto'd & not permitted
			if ( !this.check(addrA20, TYPE_WRITE) ) {
				return;
			}
		}
		
		writeBytes(this.buf, addrA20 - this.addr_bufStart, num);
	};
	
	// Read from memory buffer (little-endian)
	//	(A20 should already be applied)
	function readBytes( buf, addr, num ) {
		// Use size of operand to determine how many bytes to read
		switch ( num ) {
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
	function writeBytes( buf, addr, val, num ) {
		/* ==== Guards ==== */
		$.assert(val === (val & x86Emu.generateMask(num))
			, "writeBytes() :: Value is greater in bytes than size");
		/* ==== /Guards ==== */
		
		var machine = this.machine, cpu = machine.cpu;
		
		//if ( addr >= 0xa0000 && addr <= 0xbffff ) { debugger; }
		
		// Use size of operand to determine how many bytes to write
		switch ( num ) {
		case 1:	// Byte (8-bit)
			buf[ addr ] = val;
			// Delete from CPU Instruction Cache
			//	(caused by eg. polymorphic code)
			cpu.cache_insn[ addr ] = undefined;
			return;
		case 2:	// Word (16-bit / 2-bytes)
			buf[ addr ] = val & 0xFF;
			buf[ addr + 1 ] = (val >> 8) & 0xFF;
			// Delete from CPU Instruction Cache
			//	(caused by eg. polymorphic code)
			cpu.cache_insn[ addr ] = cpu.cache_insn[ addr + 1 ]
				= undefined;
			return;
		case 4:	// Dword (32-bit / 4-bytes)
			buf[ addr ] = val & 0xFF;
			buf[ addr + 1 ] = (val >> 8) & 0xFF;
			buf[ addr + 2 ] = (val >> 16) & 0xFF;
			buf[ addr + 3 ] = (val >> 24) & 0xFF;
			// Delete from CPU Instruction Cache
			//	(caused by eg. polymorphic code)
			cpu.cache_insn[ addr ] = cpu.cache_insn[ addr + 1 ]
				= cpu.cache_insn[ addr + 2 ] = cpu.cache_insn[ addr + 3 ]
				= undefined;
			return;
		default:
			$.problem("writeBytes() :: Operand size > 32-bit not supported");
		}
	}
	
	function MemoryHandler( addrBegin, addrEnd, fnRead, fnWrite, arg ) {
		this.addrBegin = addrBegin;
		this.addrEnd = addrEnd;
		this.fnRead = fnRead;
		this.fnWrite = fnWrite;
		this.arg = arg;
	}
	
	function null_readHandler( device, addr, lenIO ) {
		$.problem("I/O read from null handler (I/O port unassigned) - port "
			+ $.format("hex", addr));
		
		// As for Bochs.
		//return 0xFFFFFFFF;
		if ( lenIO === 1 ) { return 0xFF;
		} else if ( lenIO === 2 ) { return 0xFFFF;
		} else { return 0xFFFFFFFF; }
	}
	function null_writeHandler( device, addr, val, lenIO ) {
		$.problem("I/O write to null handler (I/O port unassigned) - port "
			+ $.format("hex", addr) + ", val " + $.format("hex", val));
		//debugger;
		
		/** Do nothing. **/
	}
	
	// Exports
	x86Emu.Memory = Memory;
});
