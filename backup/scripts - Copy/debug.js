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
	
	function Info( textMsg ) {
		console.log(textMsg);
	}
	
	function Debug( textMsg ) {
		alert(textMsg);
	}
	
	function Warning( textMsg ) {
		alert(textMsg);
	}
	
	function Panic( textMsg ) {
		
	}
	
	/* ==== Exports ==== */
	jsEmu.Assert = Assert;
	jsEmu.Info = Info;
	jsEmu.Debug = Debug;
	jsEmu.Warning = Warning;
	jsEmu.Panic = Panic;
	/* ==== /Exports ==== */
});

// Add Module to emulator
jsEmu.AddModule(mod);