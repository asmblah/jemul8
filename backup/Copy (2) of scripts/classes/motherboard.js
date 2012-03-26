/*
 *	jsEmu - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: CPU Instruction Operand support
 */
var mod = new jsEmu.PrimaryModule( function ( jsEmu ) {
	// IBM-compatible PC Motherboard class constructor
	function x86IBM_Motherboard() {
		this.arr_CPU = [];
		this.flash_BIOS_chip = null;
		this.DRAM = null;
	}
	x86IBM_Motherboard.prototype.InstallComponent = function ( component ) {
		switch ( component.constructor ) {
		// Install a compatible CPU onto the emulated Motherboard
		case jsEmu.x86CPU:
			this.arr_CPU[this.arr_CPU.length] = component;
			break;
		// Install a compatible Flash BIOS Chip onto the emulated Motherboard
		case jsEmu.x86IBM_FlashBIOSChip:
			this.flash_BIOS_chip = component;
			break;
		// Install a compatible DRAM Banks & Controller unit onto the emulated Motherboard
		case jsEmu.x86DRAM:
			this.DRAM = component;
			break;
		default:
			throw new Error( "x86IBM_Motherboard.InstallComponent :: Provided component cannot be installed onto the Motherboard." );
		}
	};
	// Get number of CPUs installed on the Motherboard
	x86IBM_Motherboard.prototype.GetNumberOfCPUs = function () {
		return this.arr_CPU.length;
	};
	// Get a CPU installed on the Motherboard by its index ( in order of installation )
	x86IBM_Motherboard.prototype.GetCPU = function ( idx ) {
		return this.arr_CPU[idx];
	};
	
	/* ==== Exports ==== */
	jsEmu.x86IBM_Motherboard = x86IBM_Motherboard;
	/* ==== /Exports ==== */
});

// Add Module to emulator
jsEmu.AddModule(mod);