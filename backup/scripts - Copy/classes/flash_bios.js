/*
 *	jsEmu - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: IBM-PC compatible Flash BIOS chip support
 */
var mod = new jsEmu.PrimaryModule( function ( jsEmu ) {
	// IBM-compatible PC Flash-BIOS chip class constructor
	function x86IBM_FlashBIOSChip() {
		this.bios = null;
	}
	// Install a compatible BIOS firmware onto the emulated BIOS Flash chip
	x86IBM_FlashBIOSChip.prototype.FlashBIOSFirmware = function ( bios ) {
		/* ==== Guards ==== */
		jsEmu.Assert(bios instanceof jsEmu.x86BIOS, "x86IBM_FlashBIOSChip.FlashBIOSFirmware :: Invalid BIOS firmware object provided.");
		/* ==== /Guards ==== */
		
		this.bios = bios;
	};
	
	/* ==== Exports ==== */
	jsEmu.x86IBM_FlashBIOSChip = x86IBM_FlashBIOSChip;
	/* ==== /Exports ==== */
});

// Add Module to emulator
jsEmu.AddModule(mod);