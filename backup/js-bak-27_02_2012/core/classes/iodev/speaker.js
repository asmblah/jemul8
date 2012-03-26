/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *	
 *	MODULE: Speaker support
 */

define([
	"../../util"
], function ( util ) { "use strict";
	
	// Basic Speaker (ie. motherboard onboard) class constructor
	function Speaker() {
		/* ==== Guards ==== */
		util.assert(this && (this instanceof Speaker), "Speaker ctor ::"
			+ " error - constructor not called properly");
		/* ==== /Guards ==== */
		
		this.aud = document.createElement("audio");
		if ( !this.aud || !this.aud.play ) {
			util.warning("Speaker constructor :: No native <audio> support,"
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
	return Speaker;
});
