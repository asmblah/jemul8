/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: Debugging support
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("debug", function ( $ ) { "use strict";
	var x86Emu = this.data("x86Emu")
		, o = {};
	
	if ( self.console ) {
		$.extend(o, {
			assert: function ( cond, msg ) {
				console.assert(cond, msg);
			}, info: function ( msg ) {
				console.info(msg);
			}, debug: function ( msg ) {
				console.debug(msg);
			}, warning: function ( msg ) {
				console.warn(msg);
			}, problem: function ( msg ) {
				console.error(msg);
			}, panic: function ( msg ) {
				alert("Panic (unsupported error!) :: " + msg);
				$.error("jQuery.Panic :: " + msg);
			}
		});
	} else {
		$.extend(o, {
			assert: function ( cond, msg ) {
			}, info: function ( msg ) {
			}, debug: function ( msg ) {
			}, warning: function ( msg ) {
			}, problem: function ( msg ) {
			}, panic: function ( msg ) {
			}
		});
	}
	
	// Debugging assertions
	this.static("assert", o.assert)
	// Various system messages, ordered by severity
	.static("info", o.info)
	.static("debug", o.debug)
	.static("warning", o.warning)
	.static("problem", o.problem)
	.static("panic", o.panic);
});
