/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: Speaker support
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("iodev/speaker", function ( $ ) { "use strict";
	var x86Emu = this.data("x86Emu");
	
	// Basic Speaker (ie. motherboard onboard) class constructor
	function Speaker() {
		/* ==== Guards ==== */
		$.assert(this && (this instanceof Speaker), "Speaker ctor ::"
			+ " error - constructor not called properly");
		/* ==== /Guards ==== */
		
		this.aud = document.createElement("audio");
		if ( !this.aud || !this.aud.play ) {
			$.warning("Speaker constructor :: No native <audio> support,"
				+ " terminal bell disabled");
		}
	}
	// Simple beep sound
	Speaker.prototype.beep = function ( freqHertz, duration ) {
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
