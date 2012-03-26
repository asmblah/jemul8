/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *	
 *	MODULE: CPU Instruction class support
 */

define([
	"../util"
	, "./bit"
], function ( util, Bit ) { "use strict";
	
	function Pin( name ) {
		this.name = name;
		this.val = 0;
	}
	util.inherit(Pin, Bit);
	Pin.prototype.raise = function () {
		this.set(1);
	};
	Pin.prototype.lower = function () {
		this.set(0);
	};
	Pin.prototype.get = function () {
		return this.val;
	};
	Pin.prototype.set = function ( val ) {
		this.val = val;
	};
	Pin.prototype.isHigh = function () {
		return !!this.val;
	};
	// To enable actions to be triggered when Pin is raised or lowered
	Pin.prototype.hook = function ( get, set ) {
		if ( get ) { this.get = get; }
		if ( set ) { this.set = set; }
	};
	
	// Exports
	return Pin;
});
