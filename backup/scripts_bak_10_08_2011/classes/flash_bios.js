/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: IBM-PC compatible Flash BIOS chip support
 */

// Augment jQuery plugin
new jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("flash_bios", function ( $ ) {
	var x86Emu = this.data("x86Emu");
	
	// IBM-compatible PC Flash-BIOS chip class constructor
	function x86IBM_FlashBIOSChip() {
		this.bios = null;
	}
	// Install a compatible BIOS firmware onto the emulated BIOS Flash chip
	x86IBM_FlashBIOSChip.prototype.FlashBIOSFirmware = function ( bios ) {
		/* ==== Guards ==== */
		$.assert(bios instanceof x86Emu.x86BIOS
			, "x86IBM_FlashBIOSChip.FlashBIOSFirmware ::"
			+ " Invalid BIOS firmware object provided.");
		/* ==== /Guards ==== */
		
		this.bios = bios;
	};
	
	/* ==== Exports ==== */
	x86Emu.x86IBM_FlashBIOSChip = x86IBM_FlashBIOSChip;
	/* ==== /Exports ==== */
});
