/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: BitFlag ( 1 bit of a BitField tied to a Register ) class support
 */

// Augment jQuery plugin
new jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("emulator", function ( $ ) {
	var jemul8 = this.data("jemul8");
	
	// CPU flags register ( eg. EFLAGS ) bit-flag ( eg IF, AF, DF ) class constructor
	function BitFlag( name, regMaster, bitsInLeft ) {
		/* ==== Guards ==== */
		jemul8.Assert(this != self, "BitFlag constructor :: not called as constructor.");
		jemul8.Assert(regMaster && regMaster instanceof jemul8.Register, "BitFlag constructor :: no valid master register specified.");
		/* ==== /Guards ==== */
		
		this.name = name;
		this.regMaster = regMaster;
		
		this.get = BitFlag_CreateGetter(regMaster, bitsInLeft);
		this.set = BitFlag_CreateSetter(regMaster, bitsInLeft);
		this.clear = BitFlag_CreateClearer(regMaster, bitsInLeft);
		this.setBin = BitFlag_CreateSetter_Binary(regMaster, bitsInLeft);
		this.Toggle = BitFlag_CreateToggler(regMaster, bitsInLeft);
	}
	BitFlag.prototype.getName = function () {
		return this.name;
	};
	
	function BitFlag_CreateGetter( regMaster, bitsInLeft ) {
		// Faster case; if no bits to shift, remove shift operation from method function
		if ( bitsInLeft == 0 ) {
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
	function BitFlag_CreateSetter( regMaster, bitsInLeft ) {
		/* ==== Malloc ==== */
		var bitmaskOccupies = (0x01 << bitsInLeft);
		// Bitmask for extracting only the bits not occupied by this BitFlag
		var bitmaskNotOccupies = 0xFFFFFFFF - bitmaskOccupies;
		/* ==== /Malloc ==== */
		
		// Faster case; if no bits to shift, remove shift operation from method function
		if ( bitsInLeft == 0 ) {
			return function () {
				/* ==== Guards ==== */
				jemul8.Assert(arguments.length === 0, "BitFlag.set :: Does not take any arguments (hint: just .set() to set=1 or .clear() to set=0).");
				/* ==== /Guards ==== */
				regMaster.set(
						// Mask out current BitFlag value
						(regMaster.get() & bitmaskNotOccupies)
						// Set bit in flag's location
						| 0x01
					);
			};
		// General case
		} else {
			return function () {
				/* ==== Guards ==== */
				jemul8.Assert(arguments.length === 0, "BitFlag.set :: Does not take any arguments (hint: just .set() to set=1 or .clear() to set=0).");
				/* ==== /Guards ==== */
				regMaster.set(
						// Mask out current BitFlag value
						(regMaster.get() & bitmaskNotOccupies)
						// Set bit in flag's location
						| bitmaskOccupies
					);
			};
		}
	}
	function BitFlag_CreateSetter_Binary( regMaster, bitsInLeft ) {
		/* ==== Malloc ==== */
		var bitmaskOccupies = (0x01 << bitsInLeft);
		// Bitmask for extracting only the bits not occupied by this BitFlag
		var bitmaskNotOccupies = 0xFFFFFFFF - bitmaskOccupies;
		/* ==== /Malloc ==== */
		
		// Faster case; if no bits to shift, remove shift operation from method function
		if ( bitsInLeft == 0 ) {
			return function ( val ) {
				regMaster.set(
						// Mask out current BitFlag value
						(regMaster.get() & bitmaskNotOccupies)
						// Set/clear bit in flag's location
						| val
					);
			};
		// General case
		} else {
			return function ( val ) {
				regMaster.set(
						// Mask out current BitFlag value
						(regMaster.get() & bitmaskNotOccupies)
						// Set/clear bit in flag's location
						| (val << bitsInLeft)
					);
			};
		}
	}
	function BitFlag_CreateClearer( regMaster, bitsInLeft ) {
		/* ==== Malloc ==== */
		var bitmaskOccupies = (0x01 << bitsInLeft);
		// Bitmask for extracting only the bits not occupied by this BitFlag
		var bitmaskNotOccupies = 0xFFFFFFFF - bitmaskOccupies;
		/* ==== /Malloc ==== */
		
		// Only general case needed because this is so simple
		return function () {
			regMaster.set(
					// Mask out current BitFlag value
					(regMaster.get() & bitmaskNotOccupies)
				);
		};
	}
	function BitFlag_CreateToggler( regMaster, bitsInLeft ) {
		/* ==== Malloc ==== */
		var bitmaskOccupies;
		/* ==== /Malloc ==== */
		
		// Faster case; if no bits to shift, remove shift operation from method function
		if ( bitsInLeft == 0 ) {
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
	
	/* ==== Exports ==== */
	jemul8.BitFlag = BitFlag;
	/* ==== /Exports ==== */
});

// Add Module to emulator
jemul8.AddModule(mod);