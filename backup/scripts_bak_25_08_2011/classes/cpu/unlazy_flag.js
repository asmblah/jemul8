/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: CPU "Unlazy" Flag class support
 *		Notes: Allows a LazyFlagsRegister to also have non-lazy flags
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("cpu/unlazy_flag", function ( $ ) { "use strict";
	var x86Emu = this.data("x86Emu");
	
	// CPU Unlazy Flag class constructor
	function UnlazyFlag( name, regMaster, bitsInLeft ) {
		/* ==== Guards ==== */
		$.assert(this && (this instanceof UnlazyFlag), "UnlazyFlag ctor ::"
			+ " error - constructor not called properly");
		$.assert(regMaster && (regMaster instanceof x86Emu.LazyFlagRegister)
			, "UnlazyFlag constructor ::"
			+ " no valid master LazyFlagRegister specified.");
		/* ==== /Guards ==== */
		
		this.bitsInLeft = bitsInLeft;
		
		this.value = 0;
		
		this.name = name;	// May be null for anonymous / reserved flags
		this.regMaster = regMaster;
		
		// Add to master LazyFlagsRegister's hash
		regMaster.hsh_flg[ bitsInLeft ] = this;
	}
	UnlazyFlag.prototype.get = function () {
		return this.value;
	};
	UnlazyFlag.prototype.set = function () {
		this.value = 1;
	};
	UnlazyFlag.prototype.clear = function () {
		this.value = 0;
	};
	UnlazyFlag.prototype.setBin = function ( val ) {
		// Should be faster than eg. val ? 1 : 0
		this.value = val & 0x01;
	};
	UnlazyFlag.prototype.toggle = function () {
		this.set(!this.get());
	};
	
	/* ====== Private ====== */
	
	/* ====== /Private ====== */
	
	// Exports
	x86Emu.UnlazyFlag = UnlazyFlag;
});
