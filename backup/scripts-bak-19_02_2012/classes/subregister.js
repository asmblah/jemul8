/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *	
 *	MODULE: SubRegister class support
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("subregister", function ( $ ) { "use strict";
	var jemul8 = this.data("jemul8");
	
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
	$.inherit(SubRegister, jemul8.Register); // Inheritance
	
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
	jemul8.SubRegister = SubRegister;
});
