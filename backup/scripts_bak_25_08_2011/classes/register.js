/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: Register class support
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("register", function ( $ ) { "use strict";
	var x86Emu = this.data("x86Emu");
	
	// Register ( eg. CPU registers EAX, EBX ) class constructor
	//	( NB: also used by I/O devices/chips eg. CMOS )
	function Register( name, sizeBytes ) {
		/* ==== Guards ==== */
		$.assert(this && (this instanceof Register), "Register ctor ::"
			+ " error - constructor not called properly");
		/* ==== /Guards ==== */
		
		this.name = name;
		this.value = 0;
		this.sizeBytes = sizeBytes;
		this.bitmaskSize = Math.pow(2, 8 * sizeBytes) - 1;
		
		this.selector = new Selector( this );
	}
	Register.prototype.get = function () {
		return this.value;
	};
	Register.prototype.set = function ( val ) {
		// Mask out bits of value outside Register's bit-width
		this.value = val & this.bitmaskSize;
	};
	Register.prototype.clear = function () {
		this.value = 0;
	};
	
	// Returns a nicely formatted hex string, with register value, padded to its size
	Register.prototype.getHexString = function () {
		/* ==== Malloc ==== */
		var val = this.get().toString(16).toUpperCase();
		var sizeHexChars = this.sizeBytes * 2;
		var textLeadingZeroes = new Array( sizeHexChars - val.length + 1 ).join("0");
		// Use spaces to right-align hex characters with the full 32-bit ones ( 8 chars )
		var textLeadingSpaces = new Array( 8 - sizeHexChars + 1 ).join(" ");
		/* ==== /Malloc ==== */
		return textLeadingSpaces + textLeadingZeroes + val;
	};
	Register.prototype.getSize = function () {
		return this.sizeBytes;
	};
	
	// Segment Register selector
	function Selector( reg ) {
		this.reg = reg;
		this.value = 0;
		this.index = 0;
		this.TI = 0;	// Table Indicator bit
		this.RPL = 0;	// Requested Privilege Level
	}
	// Load the Selector object with data from an x86 selector
	Selector.parse_x86 = function ( raw_selector ) {
		this.value = raw_selector;
		this.index = raw_selector >> 3;
		this.TI = (raw_selector >> 2) & 0x01;	// Bit 2
		this.RPL = raw_selector & 0x03;			// Bits 0 & 1
	};
	
	// CPU Sub-register ( eg AX, AL, AH ) class constructor
	function SubRegister( name, sizeBytes, regMaster
						, bitmaskSize, bytesInLeft ) {
		/* ==== Guards ==== */
		$.assert(this != self, "SubRegister constructor ::"
			+ " not called as constructor.");
		$.assert(regMaster && (regMaster instanceof x86Emu.Register
			|| regMaster instanceof x86Emu.LazyFlagRegister)
			, "SubRegister constructor :: no valid"
			+ " master register specified.");
		/* ==== /Guards ==== */
		
		this.name = name;
		this.sizeBytes = sizeBytes;
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
		return this.sizeBytes;
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
	x86Emu.Register = Register;
	x86Emu.SubRegister = SubRegister;
});
