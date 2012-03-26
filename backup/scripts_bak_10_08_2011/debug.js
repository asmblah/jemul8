/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: Debugging support
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("debug", function ( $ ) {
	var x86Emu = this.data("x86Emu");
	
	// Debugging assertions
	this.static("assert", function ( test, textMsg ) {
		if ( !test ) {
			debugger;
			$.error(textMsg);
		}
	})
	// Various system messages, ordered by severity
	.static("info", console && console.info ? console.info
	: function ( textMsg ) {
		$.error("Info (unsupported error!) :: " + textMsg);
	})
	.static("debug", console && console.debug ? console.debug
	: function ( textMsg ) {
		$.error("Debug (unsupported error!) :: " + textMsg);
	})
	.static("warning", console && console.warn ? console.warn
	: function ( textMsg ) {
		$.error("Warning (unsupported error!) :: " + textMsg);
	})
	.static("problem", console && console.error ? console.error
	: function ( textMsg ) {
		$.error("Error (unsupported error!) :: " + textMsg);
	})
	.static("panic", function ( textMsg ) {
		alert("Panic (unsupported error!) :: textMsg");
		$.error("jQuery.Panic :: " + textMsg);
	});
});
