/*
 *	jsEmu - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: Bitfield class support
 */
var mod = new jsEmu.PrimaryModule( function ( jsEmu ) {
	
	function Bitfield( sizeBits ) {
		this.sizeBits = sizeBits;
		this.value = 0;
	}
	Bitfield.prototype.Set = function ( val ) {
		this.value = val;
	};
	Bitfield.prototype.SetBit = function ( idx ) {
		this.value |= 1 << idx;
	};
	Bitfield.prototype.ClearBit = function ( idx ) {
		this.value &= ~(1 << idx);
	};
	Bitfield.prototype.ToggleBit = function ( idx ) {
		this.value ^= 1 << idx;
	};
	Bitfield.prototype.SetBits = function ( idx, val, numBitsMax ) {
		/* ==== Malloc ==== */
		var bitmaskMaxSize = Math.pow(2, numBitsMax);
		/* ==== /Malloc ==== */
		this.value |= (val & bitmaskMaxSize) << idx;
	};
	
	/* ==== Exports ==== */
	jsEmu.Bitfield = Bitfield;
	/* ==== /Exports ==== */
});

// Add Module to emulator
jsEmu.AddModule(mod);