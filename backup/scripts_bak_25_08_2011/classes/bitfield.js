/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: Bitfield class support
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("bitfield", function ( $ ) { "use strict";
	var x86Emu = this.data("x86Emu");
	
	function Bitfield( sizeBits ) {
		this.sizeBits = sizeBits;
		this.value = 0;
	}
	Bitfield.prototype.set = function ( val ) {
		this.value = val;
	};
	Bitfield.prototype.get = function () {
		return this.value;
	};
	Bitfield.prototype.setBit = function ( idx ) {
		this.value |= 1 << idx;
	};
	Bitfield.prototype.clearBit = function ( idx ) {
		this.value &= ~(1 << idx);
	};
	Bitfield.prototype.toggleBit = function ( idx ) {
		this.value ^= 1 << idx;
	};
	Bitfield.prototype.setBits = function ( idx, val, numBitsMax ) {
		/* ==== Malloc ==== */
		var bitmaskMaxSize = Math.pow(2, numBitsMax);
		/* ==== /Malloc ==== */
		this.value |= (val & bitmaskMaxSize) << idx;
	};
	
	// Exports
	x86Emu.Bitfield = Bitfield;
});
