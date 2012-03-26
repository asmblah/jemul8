/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: Debugging support
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("debug", function ( $ ) { "use strict";
	var jemul8 = this.data("jemul8");
	
	if ( self.console ) {
		$.extend(jemul8, {
			assert: console.assert.bind(console)
			, info: console.info.bind(console)
			, debug: console.debug.bind(console)
			, warning: console.warn.bind(console)
			, problem: console.error.bind(console)
			, panic: function ( msg ) {
				alert(msg);
				throw new Error( msg );
			}
		});
	} else {
		$.extend(jemul8, {
			assert: function ( cond, msg ) {
			}, info: function ( msg ) {
			}, debug: function ( msg ) {
			}, warning: function ( msg ) {
			}, problem: function ( msg ) {
			}, panic: function ( msg ) {
			}
		});
	}
});
