/*
 * jemul8 - JavaScript x86 Emulator
 *
 * MODULE: BitFlag (1 bit of a BitField tied to a Register) class support
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
	"../util",
	"./bit",
	"./register"
], function (
	util,
	Bit,
	Register
) {
    "use strict";

	// CPU flags register (eg. EFLAGS) bit-flag
	//	(eg IF, AF, DF) class constructor
	function BitFlag(name, regMaster, bitsInLeft) {
		util.assert(this && this instanceof BitFlag,
			"BitFlag constructor :: not called as constructor.");
		util.assert(regMaster && regMaster instanceof Register,
			"BitFlag constructor :: no valid master register specified.");

		this.name = name;
		this.regMaster = regMaster;

		this.get = createGetter(regMaster, bitsInLeft);
		this.set = createSetter(regMaster, bitsInLeft);
		this.clear = createClearer(regMaster, bitsInLeft);
		this.setBin = createSetter_Binary(regMaster, bitsInLeft);
		this.toggle = createToggler(regMaster, bitsInLeft);
	}
	util.inherit(BitFlag, Bit); // Inheritance

	function createGetter(regMaster, bitsInLeft) {
		// Faster case; if no bits to shift, remove shift operation from method function
		if (bitsInLeft === 0) {
			return function () {
				// Mask, leaving only subvalue
				return (regMaster.get() & 0x01);
			};
		// General case
		} else {
			return function () {
				// Mask, leaving only subvalue
				return ((regMaster.get() >> bitsInLeft) & 0x01);
			};
		}
	}
	function createSetter(regMaster, bitsInLeft) {
		var bitmaskOccupies = (0x01 << bitsInLeft),
			// Bitmask for extracting only the bits not occupied by this BitFlag
			bitmaskNotOccupies = 0xFFFFFFFF - bitmaskOccupies;

		// Faster case; if no bits to shift, remove shift operation from method function
		if (bitsInLeft === 0) {
			return function () {
				/* ==== Guards ====
				util.assert(arguments.length === 0, "BitFlag.set :: Does not take any arguments (hint: just .set() to set=1 or .clear() to set=0).");*/
				/* ==== /Guards ==== */
				regMaster.set(
					// Mask out current BitFlag value
					(regMaster.get() & bitmaskNotOccupies) |
						// Set bit in flag's location
						0x01
				);
			};
		// General case
		} else {
			return function () {
				/* ==== Guards ====
				util.assert(arguments.length === 0, "BitFlag.set :: Does not take any arguments (hint: just .set() to set=1 or .clear() to set=0).");*/
				/* ==== /Guards ==== */
				regMaster.set(
					// Mask out current BitFlag value
					(regMaster.get() & bitmaskNotOccupies) |
						// Set bit in flag's location
						bitmaskOccupies
				);
			};
		}
	}
	function createSetter_Binary(regMaster, bitsInLeft) {
		/* ==== Malloc ==== */
		var bitmaskOccupies = (0x01 << bitsInLeft),
			// Bitmask for extracting only the bits not occupied by this BitFlag
			bitmaskNotOccupies = 0xFFFFFFFF - bitmaskOccupies;

		// Faster case; if no bits to shift, remove shift operation from method function
		if (bitsInLeft === 0) {
			return function (val) {
				regMaster.set(
					// Mask out current BitFlag value
					(regMaster.get() & bitmaskNotOccupies) |
						// Set/clear bit in flag's location
						val
				);
			};
		// General case
		} else {
			return function (val) {
				regMaster.set(
					// Mask out current BitFlag value
					(regMaster.get() & bitmaskNotOccupies) |
						// Set/clear bit in flag's location
						(val << bitsInLeft)
				);
			};
		}
	}
	function createClearer(regMaster, bitsInLeft) {
		var bitmaskOccupies = (0x01 << bitsInLeft),
			// Bitmask for extracting only the bits not occupied by this BitFlag
			bitmaskNotOccupies = 0xFFFFFFFF - bitmaskOccupies;

		// Only general case needed because this is so simple
		return function () {
			regMaster.set(
				// Mask out current BitFlag value
				(regMaster.get() & bitmaskNotOccupies)
			);
		};
	}
	function createToggler(regMaster, bitsInLeft) {
		var bitmaskOccupies;

		// Faster case; if no bits to shift, remove shift operation from method function
		if (bitsInLeft === 0) {
			return function () {
				regMaster.set(
					(regMaster.get() ^ 1)
				);
			};
		// General case
		} else {
			bitmaskOccupies = (0x01 << bitsInLeft);

			return function () {
				regMaster.set(
					(regMaster.get() ^ bitmaskOccupies)
				);
			};
		}
	}

	// Exports
	return BitFlag;
});
