/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: CPU Register class support
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("cpu/lazy_flags_register", function ( $ ) { "use strict";
	var jemul8 = this.data("jemul8");
	
	// LazyFlagRegister ( eg. EFLAGS ) class constructor
	function LazyFlagRegister( name, len ) {
		/* ==== Guards ==== */
		jemul8.assert(this && (this instanceof LazyFlagRegister)
			, "LazyFlagRegister ctor ::"
			+ " error - constructor not called properly");
		/* ==== /Guards ==== */
		
		this.cpu = null; // Set on installation
		
		this.name = name;
		this.len = len;
		
		this.hsh_flg = [];
		
		// Bit array; set bits indicate dirty flags
		//	( must be evaluated next time they are read )
		this.bitsDirty = 0x00000000;
	}
	LazyFlagRegister.prototype.install = function ( component ) {
		switch ( component.constructor ) {
		// Install a compatible Register onto the emulated CPU
		case jemul8.LazyFlag:	// Fall through
		case jemul8.UnlazyFlag:
			component.cpu = this.cpu;
			this.cpu[ component.name ] = component;
			this.hsh_flg[ component.name ] = component;
			break;
		default:
			jemul8.problem("x86CPU.install :: Provided component cannot be installed into the CPU.");
		}
	};
	// Register is rarely evaluated in full, so performance is heavily biased toward
	//	speed in the Flags themselves - each stores their value independent of
	//	this Register
	// TODO: make this polymorphic as size is going to be 8, 16, 32, 64 or 128 bits
	LazyFlagRegister.prototype.get = function () {
		/* ==== Malloc ==== */
		var idx_bit;
		var num_bit = this.len * 8;
		var value = 0;
		var hsh_flg = this.hsh_flg;
		/* ==== /Malloc ==== */
		// Hash contains one Flag per Bit in register
		for ( idx_bit = 0 ; idx_bit < num_bit ; ++idx_bit ) {
			value |= hsh_flg[idx_bit].get() << idx_bit;
		}
		return value;
	};
	// Register is rarely evaluated in full, so performance is heavily biased toward
	//	speed in the Flags themselves - each stores their value independent of
	//	this Register
	// TODO: make this polymorphic as size is going to be 8, 16, 32, 64 or 128 bits
	LazyFlagRegister.prototype.set = function ( val ) {
		/* ==== Malloc ==== */
		var idx_bit;
		var num_bit = this.len * 8;
		var hsh_flg = this.hsh_flg;
		/* ==== /Malloc ==== */
		// Hash contains one Flag per Bit in register
		for ( idx_bit = 0 ; idx_bit < num_bit ; ++idx_bit ) {
			hsh_flg[idx_bit].setBin(val & (1 << idx_bit));
		}
		// All bits have just been set; none can be dirty so just quickly clean list out
		this.bitsDirty = 0x00000000;
	};
	// Returns a nicely formatted hex string, with register value, padded to its size
	LazyFlagRegister.prototype.getHexString = function () {
		/* ==== Malloc ==== */
		var val = this.get().toString(16).toUpperCase();
		var sizeHexChars = this.len * 2;
		var textLeadingZeroes = new Array(sizeHexChars - val.length + 1).join("0");
		// Use spaces to right-align hex characters with the full 32-bit ones ( 8 chars )
		var textLeadingSpaces = new Array(8 - sizeHexChars + 1).join(" ");
		/* ==== /Malloc ==== */
		return textLeadingSpaces + textLeadingZeroes + val;
	};
	LazyFlagRegister.prototype.getSize = function () {
		return this.len;
	};
	
	// Exports
	jemul8.LazyFlagRegister = LazyFlagRegister;
});
