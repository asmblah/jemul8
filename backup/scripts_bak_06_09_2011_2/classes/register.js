/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: Register class support
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("register", function ( $ ) { "use strict";
	var jemul8 = this.data("jemul8");
	
	// Register (eg. CPU registers EAX, EBX) class constructor
	//	(NB: also used by I/O devices eg. CMOS)
	function Register( name, len ) {
		/* ==== Guards ==== */
		jemul8.assert(this && (this instanceof Register), "Register ctor ::"
			+ " error - constructor not called properly");
		if ( !len ) { len = 0; }
		/* ==== /Guards ==== */
		
		// Set on installation
		this.cpu = null;
		
		this.name = name;
		this.value = 0;
		this.len = len;
		this.bitmaskSize = jemul8.generateMask(len);
	}
	Register.prototype.get = function () {
		return this.value;
	};
	Register.prototype.set = function ( val ) {
		if ( this.name === "CS" && (val & 0xFFF) ) { debugger; }
		
		// Mask out bits of value outside Register's bit-width
		this.value = val & this.bitmaskSize;
	};
	Register.prototype.clear = function () {
		this.set(0x00);
	};
	// Returns a nicely formatted hex string, with register value, padded to its size
	Register.prototype.getHexString = function () {
		var val = this.get().toString(16).toUpperCase();
		var sizeHexChars = this.getSize() * 2;
		var textLeadingZeroes = new Array( sizeHexChars - val.length + 1 ).join("0");
		// Use spaces to right-align hex characters with the full 32-bit ones ( 8 chars )
		var textLeadingSpaces = new Array( 8 - sizeHexChars + 1 ).join(" ");
		
		return textLeadingSpaces + textLeadingZeroes + val;
	};
	Register.prototype.getSize = function () {
		return this.len;
	};
	
	// CPU Sub-register ( eg AX, AL, AH ) class constructor
	function SubRegister( name, len, regMaster
						, bitmaskSize, bytesInLeft ) {
		/* ==== Guards ==== */
		jemul8.assert(this != self, "SubRegister constructor ::"
			+ " not called as constructor.");
		jemul8.assert(regMaster && (regMaster instanceof jemul8.Register
			|| regMaster instanceof jemul8.LazyFlagRegister)
			, "SubRegister constructor :: no valid"
			+ " master register specified.");
		/* ==== /Guards ==== */
		
		this.name = name;
		this.len = len;
		this.regMaster = regMaster;
		
		this.bitmaskSize = bitmaskSize;
		
		// Faster case; if no bits to shift, remove shift operation from method function
		if ( bytesInLeft == 0 ) {
			this.bitmaskOccupies = bitmaskSize;
			// Bitmask for extracting only the part of the value not occupied by this subregister
			this.bitmaskNotOccupies = 0xFFFFFFFF - this.bitmaskOccupies;
			
			this.get = subreg_getFirst;
			this.set = subreg_setFirst;
		// General case
		} else {
			this.bitsShiftRight = bytesInLeft * 8;
			this.bitmaskOccupies = bitmaskSize << this.bitsShiftRight;
			// Bitmask for extracting only the part of the value not occupied by this subregister
			this.bitmaskNotOccupies = 0xFFFFFFFF - this.bitmaskOccupies;
			
			this.get = subreg_getGeneral;
			this.set = subreg_setGeneral;
		}
	}
	SubRegister.prototype.getSize = function () {
		return this.len;
	};
	
	// Optimised for getting LeastSignif.Bits
	var subreg_getFirst = function () {
		// Mask, leaving only subvalue
		return (this.regMaster.get() & this.bitmaskSize);
	};
	var subreg_getGeneral = function () {
		// Mask, leaving only subvalue
		return ((this.regMaster.get() >> this.bitsShiftRight)
			& this.bitmaskSize);
	};
	
	// Faster case; if no bits to shift, remove shift operation
	//	from method function
	var subreg_setFirst = function ( val ) {
		this.regMaster.set(
			// Mask out current SubRegister value
			(this.regMaster.get() & this.bitmaskNotOccupies)
			// Restrict new value to max size of SubRegister
			//	( no need to move, SubRegister is at low end of bits )
			| (val & this.bitmaskOccupies)
		);
	};
	var subreg_setGeneral = function ( val ) {
		this.regMaster.set(
			// Mask out current SubRegister value
			(this.regMaster.get() & this.bitmaskNotOccupies)
			// Move & Restrict new value to position
			//	& max size of SubRegister
			| ((val << this.bitsShiftRight) & this.bitmaskOccupies)
		);
	};
	
	// Exports
	jemul8.Register = Register;
	jemul8.SubRegister = SubRegister;
});
