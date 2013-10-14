/*
 * jemul8 - JavaScript x86 Emulator
 *
 * MODULE: SubRegister class support
 *
 * ====
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*jslint bitwise: true, plusplus: true */
/*global define, require */

define([
	"../util"
	, "./register"
	, "./cpu/lazy_flags_register"
], function (
	util,
	Register,
	LazyFlagRegister
) {
    "use strict";

	// CPU Sub-register (eg AX, AL, AH) class constructor
	function SubRegister( name, size, regMaster
						, mask, bytesInLeft ) {
		util.assert(this != util.global, "SubRegister constructor ::"
			+ " not called as constructor.");
		util.assert(regMaster && (regMaster instanceof Register
			|| regMaster instanceof LazyFlagRegister)
			, "SubRegister constructor :: no valid"
			+ " master register specified.");

		this.name = name;
		this.size = size;
		this.regMaster = regMaster;

		this.mask = mask;

		// Faster case; if no bits to shift, remove shift operation from method function
		if (bytesInLeft == 0) {
			this.bitmaskOccupies = mask;
			// Bitmask for extracting only the part of the value not occupied by this subregister
			this.bitmaskNotOccupies = 0xFFFFFFFF - this.bitmaskOccupies;

			this.get = subreg_getFirst;
			this.set = subreg_setFirst;
		// General case
		} else {
			this.bitsShiftRight = bytesInLeft * 8;
			this.bitmaskOccupies = mask << this.bitsShiftRight;
			// Bitmask for extracting only the part of the value not occupied by this subregister
			this.bitmaskNotOccupies = 0xFFFFFFFF - this.bitmaskOccupies;

			this.get = subreg_getGeneral;
			this.set = subreg_setGeneral;
		}
	}
	util.inherit(SubRegister, Register); // Inheritance

	// Optimised for getting LeastSignif.Bits
	var subreg_getFirst = function () {
		// Mask, leaving only subvalue
		return (this.regMaster.get() & this.mask);
	};
	var subreg_getGeneral = function () {
		// Mask, leaving only subvalue
		return ((this.regMaster.get() >> this.bitsShiftRight)
			& this.mask);
	};

	// Faster case; if no bits to shift, remove shift operation
	//	from method function
	var subreg_setFirst = function (val) {
		this.regMaster.set(
			// Mask out current SubRegister value
			(this.regMaster.get() & this.bitmaskNotOccupies)
			// Restrict new value to max size of SubRegister
			//	(no need to move, SubRegister is at low end of bits)
			| (val & this.bitmaskOccupies)
		);
	};
	var subreg_setGeneral = function (val) {
		this.regMaster.set(
			// Mask out current SubRegister value
			(this.regMaster.get() & this.bitmaskNotOccupies)
			// Move & Restrict new value to position
			//	& max size of SubRegister
			| ((val << this.bitsShiftRight) & this.bitmaskOccupies)
		);
	};

	// Exports
	return SubRegister;
});
