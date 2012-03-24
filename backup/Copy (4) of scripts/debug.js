/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: Debugging support
 */

// Augment jQuery plugin
new jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("emulator", function ( $ ) {
	var jemul8 = this.data("jemul8");
	
	// Debugging assertions
	function Assert( test, textMsg ) {
		if ( !test ) {
			debugger;
			throw new Error( textMsg );
			//undefined();
		}
	}
	
	function Info( textMsg ) {
		console.info(textMsg);
	}
	
	function Debug( textMsg ) {
		console.debug(textMsg);
	}
	
	function Warning( textMsg ) {
		console.warn(textMsg);
	}
	
	function Error( textMsg ) {
		console.error(textMsg);
	}
	
	function Panic( textMsg ) {
		alert("Panic :: textMsg");
		throw new Error( "jemul8.Panic :: " + textMsg );
	}
	
	/* ==== Exports ==== */
	jemul8.Assert = Assert;
	jemul8.Info = Info;
	jemul8.Debug = Debug;
	jemul8.Warning = Warning;
	jemul8.Error = Error;
	jemul8.Panic = Panic;
	/* ==== /Exports ==== */
});

// Add Module to emulator
jemul8.AddModule(mod);