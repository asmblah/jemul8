/*
 *	jsEmu - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: BitFlag class support
 */
var mod = new jsEmu.PrimaryModule( function ( jsEmu ) {
	// CPU flags register ( eg. EFLAGS ) bit-flag ( eg IF, AF, DF ) class constructor
	function BitFlag( name, regMaster, bitsInLeft ) {
		/* ==== Guards ==== */
		jsEmu.Assert(this != self, "BitFlag constructor :: not called as constructor.");
		jsEmu.Assert(regMaster && regMaster instanceof jsEmu.Register, "BitFlag constructor :: no valid master register specified.");
		/* ==== /Guards ==== */
		
		this.name = name;
		this.regMaster = regMaster;
		
		this.Get = BitFlag_CreateGetter(regMaster, bitsInLeft);
		this.Set = BitFlag_CreateSetter(regMaster, bitsInLeft);
		this.Clear = BitFlag_CreateClearer(regMaster, bitsInLeft);
		this.SetBin = BitFlag_CreateSetter_Binary(regMaster, bitsInLeft);
		this.Toggle = BitFlag_CreateToggler(regMaster, bitsInLeft);
	}
	BitFlag.prototype.GetName = function () {
		return this.name;
	};

	function BitFlag_CreateGetter( regMaster, bitsInLeft ) {
		// Faster case; if no bits to shift, remove shift operation from method function
		if ( bitsInLeft == 0 ) {
			return function () {
				// Mask, leaving only subvalue
				return (regMaster.Get() & 0x01);
			};
		// General case
		} else {
			return function () {
				// Mask, leaving only subvalue
				return ((regMaster.Get() >> bitsInLeft) & 0x01);
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
				jsEmu.Assert(arguments.length === 0, "BitFlag.Set :: Does not take any arguments (hint: just .Set() to set=1 or .Clear() to set=0).");
				/* ==== /Guards ==== */
				regMaster.Set(
						// Mask out current BitFlag value
						(regMaster.Get() & bitmaskNotOccupies)
						// Set bit in flag's location
						| 0x01
					);
			};
		// General case
		} else {
			return function () {
				/* ==== Guards ==== */
				jsEmu.Assert(arguments.length === 0, "BitFlag.Set :: Does not take any arguments (hint: just .Set() to set=1 or .Clear() to set=0).");
				/* ==== /Guards ==== */
				regMaster.Set(
						// Mask out current BitFlag value
						(regMaster.Get() & bitmaskNotOccupies)
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
				regMaster.Set(
						// Mask out current BitFlag value
						(regMaster.Get() & bitmaskNotOccupies)
						// Set/clear bit in flag's location
						| val
					);
			};
		// General case
		} else {
			return function ( val ) {
				regMaster.Set(
						// Mask out current BitFlag value
						(regMaster.Get() & bitmaskNotOccupies)
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
			regMaster.Set(
					// Mask out current BitFlag value
					(regMaster.Get() & bitmaskNotOccupies)
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
				regMaster.Set(
						(regMaster.Get() ^ 1)
					);
			};
		// General case
		} else {
			bitmaskOccupies = (0x01 << bitsInLeft);
			return function () {
				regMaster.Set(
						(regMaster.Get() ^ bitmaskOccupies)
					);
			};
		}
	}
	
	/* ==== Exports ==== */
	jsEmu.BitFlag = BitFlag;
	/* ==== /Exports ==== */
});

// Add Module to emulator
jsEmu.AddModule(mod);