/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: IBM-PC compatible Flash BIOS chip support
 */

// Augment jQuery plugin
new jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("emulator", function ( $ ) {
	var jemul8 = this.data("jemul8");
	
	// IBM-compatible PC Flash-BIOS chip class constructor
	function x86IBM_FlashBIOSChip() {
		this.bios = null;
	}
	// Install a compatible BIOS firmware onto the emulated BIOS Flash chip
	x86IBM_FlashBIOSChip.prototype.FlashBIOSFirmware = function ( bios ) {
		/* ==== Guards ==== */
		jemul8.Assert(bios instanceof jemul8.x86BIOS, "x86IBM_FlashBIOSChip.FlashBIOSFirmware :: Invalid BIOS firmware object provided.");
		/* ==== /Guards ==== */
		
		this.bios = bios;
	};
	
	/* ==== Exports ==== */
	jemul8.x86IBM_FlashBIOSChip = x86IBM_FlashBIOSChip;
	/* ==== /Exports ==== */
});

// Add Module to emulator
jemul8.AddModule(mod);