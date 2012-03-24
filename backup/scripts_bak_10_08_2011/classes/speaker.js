/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: Speaker support
 */

// Augment jQuery plugin
new jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("emulator", function ( $ ) {
	var x86Emu = this.data("x86Emu");
	
	// Import system after setup
	var machine, CPU, DRAM;
	this.bind("load", function ( $, machine_, CPU_, DRAM_ ) {
		machine = machine_; CPU = CPU_; DRAM = DRAM_;
	});
	/* ============ /Import system after setup ============ */
	
	// Basic Speaker ( eg. Onboard motherboard ) class constructor
	function Speaker() {
		/* ==== Guards ==== */
		$.assert(this != self, "Speaker constructor :: not called as constructor.");
		/* ==== /Guards ==== */
		
		this.aud = document.createElement("audio");
		if ( !this.aud || !this.aud.play ) {
			$.warning("Speaker constructor :: No native <audio> support, terminal bell disabled");
		}
	}
	// Simple beep sound
	Speaker.prototype.Beep = function ( freqHertz, duration ) {
		/* ==== Defaults ==== */
		if ( !freqHertz ) freqHertz = 800;
		if ( !duration ) duration = 200;
		/* ==== /Defaults ==== */
		
		// TODO: ( see jsSound project )
		alert("Beep!");
	};
	
	// Exports
	x86Emu.Speaker = Speaker;
});
