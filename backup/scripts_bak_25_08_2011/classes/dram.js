/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: DRAM Banks & Controller support
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("dram", function ( $ ) { "use strict";
	var x86Emu = this.data("x86Emu");
	
	// DRAM Banks & Controller unit class constructor
	function x86DRAM( machine ) {
		this.machine = machine;
		
		this.memData = null;
	}
	// Initialise the emulated DRAM Controller
	x86DRAM.prototype.init = function () {
		var numBytes = 1024 * 1024;
		
		// Ultra-modern, fast Typed Arrays support (faster)
		if ( x86Emu.supportsTypedArrays ) {
			this.memData = new Uint8Array( new ArrayBuffer( numBytes ) );
		// Legacy native Arrays support (slower)
		} else {
			this.memData = new Array( numBytes );
			// Zero-out all bytes in memory (otherwise they will be undefined)
			//for ( var i = 0 ; i < numBytes ; ++i ) {
			//	this.memData[ i ] = 0x00;
			//}
		}
	};
	x86DRAM.prototype.destroy = function () {
		// Free memory etc. when finished
		if ( x86Emu.supportsTypedArrays ) {
			delete this.memData;
		} else {
			this.memData.length = 0;
		}
	};
	// Read from RAM array ( little-endian )
	x86DRAM.prototype.readBytes = function ( addr, num ) {
		// Use size of operand to determine how many bytes to read
		switch ( num ) {
		case 1:	// Byte ( 8-bit )
			return this.memData[ addr ];
		case 2:	// Word ( 16-bit )
			return (this.memData[ addr + 1 ] << 8) | (this.memData[ addr ]);
		case 4:	// Dword ( 32-bit )
			return (this.memData[ addr + 3 ] << 24)
				| (this.memData[ addr + 2 ] << 16)
				| (this.memData[ addr + 1 ] << 8) | (this.memData[ addr ]);
		default:
			$.problem("x86DRAM.readBytes :: Operand size > 32-bit not supported");
		}
	};
	// Read from RAM array (fast method for reading only a single byte)
	x86DRAM.prototype.read1Byte = function ( addr ) {
		return this.memData[ addr ];
	};
	// Write to RAM array
	x86DRAM.prototype.writeBytes = function ( addr, val, num ) {
		/* ==== Guards ==== */
		$.assert(val == (val & ((1 << num * 8) - 1)), "x86DRAM.writeBytes :: Value is greater in bytes than size");
		/* ==== /Guards ==== */
		
		var machine = this.machine, cpu = machine.cpu;
		
		// Use size of operand to determine how many bytes to write
		switch ( num ) {
		case 1:	// Byte ( 8-bit )
			this.memData[ addr ] = val;
			// Delete from CPU Instruction Cache
			//	(caused by eg. polymorphic code)
			cpu.arr_insnCache[ addr ] = undefined;
			return;
		case 2:	// Word ( 16-bit )
			this.memData[ addr ] = val & 0xFF;
			this.memData[ addr + 1 ] = (val >> 8) & 0xFF;
			// Delete from CPU Instruction Cache
			//	(caused by eg. polymorphic code)
			cpu.arr_insnCache[ addr ] = cpu.arr_insnCache[ addr + 1 ] = undefined;
			return;
		case 4:	// Dword ( 32-bit )
			this.memData[ addr ] = val & 0xFF;
			this.memData[ addr + 1 ] = (val >> 8) & 0xFF;
			this.memData[ addr + 2 ] = (val >> 16) & 0xFF;
			this.memData[ addr + 3 ] = (val >> 24) & 0xFF;
			// Delete from CPU Instruction Cache
			//	(caused by eg. polymorphic code)
			cpu.arr_insnCache[ addr ] = cpu.arr_insnCache[ addr + 1 ]
				= cpu.arr_insnCache[ addr + 2 ] = cpu.arr_insnCache[ addr + 3 ]
				= undefined;
			return;
		default:
			$.problem("x86DRAM.writeBytes :: Operand size > 32-bit not supported");
		}
	};
	
	// Exports
	x86Emu.x86DRAM = x86DRAM;
});
