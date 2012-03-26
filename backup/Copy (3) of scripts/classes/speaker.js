/*
 *	jsEmu - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: Speaker support
 */
var mod = new jsEmu.PrimaryModule( function ( jsEmu ) {
	
	// Basic Speaker ( eg. Onboard motherboard ) class constructor
	function Speaker() {
		/* ==== Guards ==== */
		jsEmu.Assert(this != self, "Speaker constructor :: not called as constructor.");
		/* ==== /Guards ==== */
	}
	// Simple beep sound
	Speaker.prototype.Beep = function ( freqHertz ) {
		/* ==== Defaults ==== */
		if ( !freqHertz ) freqHertz = 200;
		/* ==== /Defaults ==== */
		
		// todo ( see jsSound project )
	};
	
	/* ==== Exports ==== */
	jsEmu.Speaker = Speaker;
	/* ==== /Exports ==== */
});

// Add Module to emulator
jsEmu.AddModule(mod);