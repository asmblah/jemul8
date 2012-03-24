/*
 *	jsEmu - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: DRAM Banks & Controller support
 */
var mod = new jsEmu.PrimaryModule( function ( jsEmu ) {
	// DRAM Banks & Controller unit class constructor
	function x86DRAM() {
		this.arr_16KBanks = [];
		this.memData = null;
	}
	x86DRAM.prototype.InstallComponent = function ( component ) {
		switch ( component.constructor ) {
		// Install a compatible DRAM chip into the emulated DRAM banks
		case jsEmu.x86DRAM_16KChip:
			this.arr_16KBanks[this.arr_16KBanks.length] = component;
			break;
		default:
			throw new Error( "x86DRAM.InstallComponent :: Provided component cannot be installed into the DRAM banks." );
		}
	};
	x86DRAM.prototype.GetNumInstalledBanks = function () {
		return this.arr_16KBanks.length;
	};
	x86DRAM.prototype.GetAvailableRAMKilobytes = function () {
		return this.arr_16KBanks.length * 16;
	};
	// Initialise the emulated DRAM Controller
	x86DRAM.prototype.InitialiseController = function () {
		this.memData = new Array( this.GetAvailableRAMKilobytes() * 1024 );
	};
	// Read from RAM array
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
		jsEmu.Assert(val == (val & ((1 << num * 8) - 1)), "x86DRAM.WriteBytes :: Value is greater in bytes than size");
		/* ==== /Guards ==== */
		
		// Use size of operand to determine how many bytes to write
		switch ( num ) {
		case 1:	// Byte ( 8-bit )
			this.memData[addr	] = val;
			return;
		case 2:	// Word ( 16-bit )
			this.memData[addr	] = val & 0x00FF;
			this.memData[addr + 1] = val & 0xFF00;
			return;
		case 4:	// Dword ( 32-bit )
			this.memData[addr	] = val & 0x000000FF;
			this.memData[addr + 1] = val & 0x0000FF00;
			this.memData[addr + 2] = val & 0x00FF0000;
			this.memData[addr + 3] = val & 0xFF000000;
			return;
		default:
			throw new Error( "x86DRAM.WriteBytes :: Operand size > 32-bit not supported" );
		}
	};
	
	/* ==== Exports ==== */
	jsEmu.x86DRAM = x86DRAM;
	/* ==== /Exports ==== */
});

// Add Module to emulator
jsEmu.AddModule(mod);