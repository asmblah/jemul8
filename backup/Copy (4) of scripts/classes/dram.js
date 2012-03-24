/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: DRAM Banks & Controller support
 */

// Augment jQuery plugin
new jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("emulator", function ( $ ) {
	var jemul8 = this.data("jemul8");
	
	/* ============ Import system after setup ============ */
	var machine, CPU, DRAM;
	this.RegisterDeferredLoader( function ( machine_, CPU_, DRAM_ ) {
		machine = machine_; CPU = CPU_; DRAM = DRAM_;
	});
	/* ============ /Import system after setup ============ */
	
	// DRAM Banks & Controller unit class constructor
	function x86DRAM() {
		this.arr_16KBanks = [];
		this.memData = null;
	}
	x86DRAM.prototype.InstallComponent = function ( component ) {
		switch ( component.constructor ) {
		// Install a compatible DRAM chip into the emulated DRAM banks
		case jemul8.x86DRAM_16KChip:
			this.arr_16KBanks[this.arr_16KBanks.length] = component;
			break;
		default:
			throw new Error( "x86DRAM.InstallComponent :: Provided component cannot be installed into the DRAM banks." );
		}
	};
	x86DRAM.prototype.getNumInstalledBanks = function () {
		return this.arr_16KBanks.length;
	};
	x86DRAM.prototype.getAvailableRAMKilobytes = function () {
		return this.arr_16KBanks.length * 16;
	};
	// Initialise the emulated DRAM Controller
	x86DRAM.prototype.InitialiseController = function () {
		/* ==== Malloc ==== */
		var numBytes = this.getAvailableRAMKilobytes() * 1024;
		/* ==== /Malloc ==== */
		this.memData = new Array( numBytes );
		
		//for ( var i = 0 ; i < numBytes ; ++i ) {
		//	this.memData[i] = 0x00;
		//}
	};
	// Read from RAM array ( little-endian )
	x86DRAM.prototype.ReadBytes = function ( addr, num ) {
		// Use size of operand to determine how many bytes to read
		switch ( num ) {
		case 1:	// Byte ( 8-bit )
			return this.memData[addr];
		case 2:	// Word ( 16-bit )
			return (this.memData[addr + 1] << 8) | (this.memData[addr]);
		case 4:	// Dword ( 32-bit )
			return (this.memData[addr + 3] << 24) | (this.memData[addr + 2] << 16) | (this.memData[addr + 1] << 8) | (this.memData[addr]);
		default:
			throw new Error( "x86DRAM.ReadBytes :: Operand size > 32-bit not supported" );
		}
	};
	// Read from RAM array ( fast method for reading only a single byte )
	x86DRAM.prototype.Read1Byte = function ( addr ) {
		return this.memData[addr];
	};
	// Write to RAM array
	x86DRAM.prototype.WriteBytes = function ( addr, val, num ) {
		/* ==== Guards ==== */
		jemul8.Assert(val == (val & ((1 << num * 8) - 1)), "x86DRAM.WriteBytes :: Value is greater in bytes than size");
		/* ==== /Guards ==== */
		
		// Use size of operand to determine how many bytes to write
		switch ( num ) {
		case 1:	// Byte ( 8-bit )
			this.memData[addr	] = val;
			// Delete from CPU Instruction Cache ( caused by eg. polymorphic code )
			CPU.arr_insnCache[addr] = undefined;
			return;
		case 2:	// Word ( 16-bit )
			this.memData[addr	] = val & 0xFF;
			this.memData[addr + 1] = (val >> 8) & 0xFF;
			// Delete from CPU Instruction Cache ( caused by eg. polymorphic code )
			CPU.arr_insnCache[addr] = CPU.arr_insnCache[addr + 1] = undefined;
			return;
		case 4:	// Dword ( 32-bit )
			this.memData[addr	] = val & 0xFF;
			this.memData[addr + 1] = (val >> 8) & 0xFF;
			this.memData[addr + 2] = (val >> 16) & 0xFF;
			this.memData[addr + 3] = (val >> 24) & 0xFF;
			// Delete from CPU Instruction Cache ( caused by eg. polymorphic code )
			CPU.arr_insnCache[addr] = CPU.arr_insnCache[addr + 1] = CPU.arr_insnCache[addr + 2] = CPU.arr_insnCache[addr + 3] = undefined;
			return;
		default:
			throw new Error( "x86DRAM.WriteBytes :: Operand size > 32-bit not supported" );
		}
	};
	
	/* ==== Exports ==== */
	jemul8.x86DRAM = x86DRAM;
	/* ==== /Exports ==== */
});

// Add Module to emulator
jemul8.AddModule(mod);