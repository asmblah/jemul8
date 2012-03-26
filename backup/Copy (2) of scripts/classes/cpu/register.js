/*
 *	jsEmu - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: CPU Register class support
 */
var mod = new jsEmu.PrimaryModule( function ( jsEmu ) {
	// CPU Register ( eg. EAX, EBX ) class constructor
	function Register( name, sizeBytes ) {
		/* ==== Guards ==== */
		jsEmu.Assert(this != self, "Register constructor :: not called as constructor.");
		/* ==== /Guards ==== */
		
		this.name = name;
		this.value = 0;
		this.sizeBytes = sizeBytes;
		this.bitmaskSize = Math.pow(2, 8 * sizeBytes) - 1;
		this.valNegativeWrap = this.bitmaskSize + 1;
	}
	Register.prototype.Get = function () {
		return this.value;
	};
	Register.prototype.Set = function ( val ) {
		// Mask out bits of value outside Register's bit-width
		this.value = val & this.bitmaskSize;
	};
	// Returns a nicely formatted hex string, with register value, padded to its size
	Register.prototype.GetHexString = function () {
		/* ==== Malloc ==== */
		var val = this.Get().toString(16).toUpperCase();
		var sizeHexChars = this.sizeBytes * 2;
		var textLeadingZeroes = new Array(sizeHexChars - val.length + 1).join("0");
		// Use spaces to right-align hex characters with the full 32-bit ones ( 8 chars )
		var textLeadingSpaces = new Array(8 - sizeHexChars + 1).join(" ");
		/* ==== /Malloc ==== */
		return textLeadingSpaces + textLeadingZeroes + val;
	};
	Register.prototype.GetSize = function () {
		return this.sizeBytes;
	};
	Register.prototype.GetName = function () {
		return this.name;
	};
	
	// CPU Sub-register ( eg AX, AL, AH ) class constructor
	function SubRegister( name, sizeBytes, regMaster, bitmaskSize, bytesInLeft ) {
		/* ==== Guards ==== */
		jsEmu.Assert(this != self, "SubRegister constructor :: not called as constructor.");
		jsEmu.Assert(regMaster && (regMaster instanceof jsEmu.Register || regMaster instanceof jsEmu.LazyFlagRegister), "SubRegister constructor :: no valid master register specified.");
		/* ==== /Guards ==== */
		
		this.name = name;
		this.sizeBytes = sizeBytes;
		//this.Get = SubRegister_CreateGetter(regMaster, bitmaskSize, bytesInLeft);
		//this.Set = SubRegister_CreateSetter(regMaster, bitmaskSize, bytesInLeft);
		
		// Faster case; if no bits to shift, remove shift operation from method function
		if ( bytesInLeft == 0 ) {
			this.Get = SubRegister_Get_First;
			this.Set = SubRegister_Set_First;
		// General case
		} else {
			this.bitsShiftRight = bytesInLeft * 8;
			this.Get = SubRegister_Get_General;
			this.Set = SubRegister_Set_General;
		}
	}
	SubRegister.prototype.GetSize = function () {
		return this.sizeBytes;
	};
	SubRegister.prototype.GetName = function () {
		return this.name;
	};
	
	var SubRegister_Get_General = function () {
		// Mask, leaving only subvalue
		return ((regMaster.Get() >> bitsShiftRight) & bitmaskSize);
	};
	var SubRegister_Get_First = function () {
		// Mask, leaving only subvalue
		return (regMaster.Get() & bitmaskSize);
	};
	
	
	function SubRegister_CreateGetter( regMaster, bitmaskSize, bytesInLeft ) {
		/* ==== Malloc ==== */
		// Amount to 
		var bitsShiftRight = bytesInLeft * 8;
		/* ==== /Malloc ==== */
		
		// Faster case; if no bits to shift, remove shift operation from method function
		if ( bitsShiftRight == 0 ) {
			return function () {
				// Mask, leaving only subvalue
				return (regMaster.Get() & bitmaskSize);
			};
		// General case
		} else {
			return function () {
				// Mask, leaving only subvalue
				return ((regMaster.Get() >> bitsShiftRight) & bitmaskSize);
			};
		}
	}
	function SubRegister_CreateSetter( regMaster, bitmaskSize, bytesInLeft ) {
		/* ==== Malloc ==== */
		// Amount to 
		var bitsShiftRight = bytesInLeft * 8;
		// Amount to add to wrap negative number around
		var valNegativeWrap = bitmaskSize + 1;
		var bitmaskOccupies = bitmaskSize << bitsShiftRight;
		// Bitmask for extracting only the part of the value not occupied by this subregister
		var bitmaskNotOccupies = 0xFFFFFFFF - bitmaskOccupies;
		/* ==== /Malloc ==== */
		
		// Faster case; if no bits to shift, remove shift operation from method function
		if ( bitsShiftRight == 0 ) {
			return function ( val ) {
				regMaster.Set(
						// Mask out current SubRegister value
						(regMaster.Get() & bitmaskNotOccupies)
						// Restrict new value to max size of SubRegister
						//	( no need to move, SubRegister is at low end of bits )
						| (val & bitmaskOccupies)
					);
			};
		// General case
		} else {
			return function ( val ) {
				/* ==== Guards ==== */
				//jsEmu.Assert(val >= 0, "SubRegister.Set :: tried to set a register to a negative value (hint: use two's complement).");
				/* ==== /Guards ==== */
				
				regMaster.Set(
						// Mask out current SubRegister value
						(regMaster.Get() & bitmaskNotOccupies)
						// Move & Restrict new value to position & max size of SubRegister
						| ((val << bitsShiftRight) & bitmaskOccupies)
					);
			};
		}
	}
	
	/* ==== Exports ==== */
	jsEmu.Register = Register;
	jsEmu.SubRegister = SubRegister;
	/* ==== /Exports ==== */
});

// Add Module to emulator
jsEmu.AddModule(mod);