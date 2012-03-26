/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *	
 *	MODULE: Settings class support
 */

define([
	"../util"
], function ( util ) { "use strict";
	
	// Emulator settings system class
	function Settings( defaults ) {
		/* ==== Guards ==== */
		util.assert(this && (this instanceof Settings), "Settings ctor ::"
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
	return Settings;
});
