/*
 *	jsEmu - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: Debugging support
 */
var mod = new jsEmu.PrimaryModule( function ( jsEmu ) {
	// Debugging assertions
	function Assert( test, textMsg ) {
		if ( !test ) {
			debugger;
			throw new Error( textMsg );
			//undefined();
		}
	}
	
	/* ==== Exports ==== */
	jsEmu.Assert = Assert;
	/* ==== /Exports ==== */
});

// Add Module to emulator
jsEmu.AddModule(mod);