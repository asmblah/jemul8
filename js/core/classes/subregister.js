/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *
 *	MODULE: SubRegister class support
 *
 *  ====
 *
 *  This file is part of jemul8.
 *
 *  jemul8 is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  jemul8 is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with jemul8.  If not, see <http://www.gnu.org/licenses/>.
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
		util.assert(this != self, "SubRegister constructor ::"
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
