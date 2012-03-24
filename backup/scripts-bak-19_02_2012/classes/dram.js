/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *	
 *	MODULE: DRAM Banks & Controller support
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("dram", function ( $ ) { "use strict";
	var jemul8 = this.data("jemul8");
	
	// DRAM Banks & Controller unit class constructor
	function x86DRAM( machine ) {
		this.machine = machine;
		
		this.bufData = null;
	}
	// Initialise the emulated DRAM Controller
	x86DRAM.prototype.init = function () {
		var len = 1024 * 1024;
		
		// Ask system to allocate a memory buffer
		this.bufData = jemul8.allocBuffer(len);
	};
	x86DRAM.prototype.destroy = function () {
		// Free memory etc. when finished
		if ( jemul8.supportsTypedArrays ) {
			delete this.bufData;
		} else {
			this.bufData.length = 0;
		}
	};
	// Read from RAM array ( little-endian )
	x86DRAM.prototype.readValue = function ( addr, num ) {
		// Use size of operand to determine how many bytes to read
		switch ( num ) {
		case 1:	// Byte ( 8-bit )
			return this.bufData[ addr ];
		case 2:	// Word ( 16-bit )
			return (this.bufData[ addr + 1 ] << 8) | (this.bufData[ addr ]);
		case 4:	// Dword ( 32-bit )
			return (this.bufData[ addr + 3 ] << 24)
				| (this.bufData[ addr + 2 ] << 16)
				| (this.bufData[ addr + 1 ] << 8) | (this.bufData[ addr ]);
		default:
			jemul8.problem("x86DRAM.readValue :: Operand size > 32-bit not supported");
		}
	};
	// Read from RAM array (fast method for reading only a single byte)
	x86DRAM.prototype.read1Byte = function ( addr ) {
		return this.bufData[ addr ];
	};
	// Write to RAM array
	x86DRAM.prototype.writeValue = function ( addr, val, num ) {
		/* ==== Guards ==== */
		jemul8.assert(val === (val & jemul8.generateMask(num))
			, "x86DRAM.writeValue :: Value is greater in bytes than size");
		/* ==== /Guards ==== */
		
		var machine = this.machine, cpu = machine.cpu;
		
		if ( addr >= 0xa0000 && addr <= 0xbffff ) { debugger; }
		
		//if ( addr === 0x10 * 4 ) { debugger; }
		
		// Use size of operand to determine how many bytes to write
		switch ( num ) {
		case 1:	// Byte ( 8-bit )
			this.bufData[ addr ] = val;
			// Delete from CPU Instruction Cache
			//	(caused by eg. polymorphic code)
			cpu.cache_insn[ addr ] = undefined;
			return;
		case 2:	// Word ( 16-bit )
			this.bufData[ addr ] = val & 0xFF;
			this.bufData[ addr + 1 ] = (val >> 8) & 0xFF;
			// Delete from CPU Instruction Cache
			//	(caused by eg. polymorphic code)
			cpu.cache_insn[ addr ] = cpu.cache_insn[ addr + 1 ] = undefined;
			return;
		case 4:	// Dword ( 32-bit )
			this.bufData[ addr ] = val & 0xFF;
			this.bufData[ addr + 1 ] = (val >> 8) & 0xFF;
			this.bufData[ addr + 2 ] = (val >> 16) & 0xFF;
			this.bufData[ addr + 3 ] = (val >> 24) & 0xFF;
			// Delete from CPU Instruction Cache
			//	(caused by eg. polymorphic code)
			cpu.cache_insn[ addr ] = cpu.cache_insn[ addr + 1 ]
				= cpu.cache_insn[ addr + 2 ] = cpu.cache_insn[ addr + 3 ]
				= undefined;
			return;
		default:
			jemul8.problem("x86DRAM.writeValue :: Operand size > 32-bit not supported");
		}
	};
	
	// Exports
	jemul8.x86DRAM = x86DRAM;
});
