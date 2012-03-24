/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *	
 *	MODULE: Settings class support
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("settings", function ( $ ) { "use strict";
	var jemul8 = this.data("jemul8");
	
	// 
	function Settings( defaults ) {
		/* ==== Guards ==== */
		jemul8.assert(this && (this instanceof Settings), "Settings ctor ::"
			+ " error - constructor not called properly");
		/* ==== /Guards ==== */
		
		this.defaults = defaults;
		this.settings = $.extend({}, defaults);
	}
	$.extend(Settings.prototype, {
		load: function ( options ) {
			$.extend(this.settings, options);
		}, get: function ( name ) {
			return this.settings[ name ];
		}, set: function ( name, val ) {
			this.settings[ name ] = val;
		}
	});
	
	// Exports
	jemul8.Settings = Settings;
});
