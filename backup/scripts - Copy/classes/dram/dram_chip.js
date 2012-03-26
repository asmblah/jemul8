/*
 *	jsEmu - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: DRAM Chip modules support
 */
var mod = new jsEmu.PrimaryModule( function ( jsEmu ) {
	function x86DRAM_16KChip() {
		//  ...
	}
	
	/* ==== Exports ==== */
	jsEmu.x86DRAM_16KChip = x86DRAM_16KChip;
	/* ==== /Exports ==== */
});

// Add Module to emulator
jsEmu.AddModule(mod);