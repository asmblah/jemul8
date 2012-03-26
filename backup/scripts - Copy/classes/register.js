/*
 *	jsEmu - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: Register class support
 */
var mod = new jsEmu.PrimaryModule( function ( jsEmu ) {
	// Register ( eg. CPU registers EAX, EBX ) class constructor
	//	( NB: also used by chips eg. CMOS )
	function Register( name, sizeBytes ) {
		/* ==== Guards ==== */
		jsEmu.Assert(this != self, "Register constructor :: not called as constructor.");
		/* ==== /Guards ==== */
		
		this.name = name;
		this.value = 0;
		this.sizeBytes = sizeBytes;
		this.bitmaskSize = Math.pow(2, 8 * sizeBytes) - 1;
		
		this.selector = new Selector( this );
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
	
	// Segment Register selector
	function Selector( reg ) {
		this.reg = reg;
		this.value = 0;
		this.index = 0;
		this.TI = 0;	// Table Indicator bit
		this.RPL = 0;	// Requested Privilege Level
	}
	Selector.Parse = function ( raw_selector ) {
		this.value = raw_selector;
		this.index = raw_selector >> 3;
		this.TI = (raw_selector >> 2) & 0x01;	// Bit 2
		this.RPL = raw_selector & 0x03;			// Bits 0 & 1
	};
	
	// CPU Sub-register ( eg AX, AL, AH ) class constructor
	function SubRegister( name, sizeBytes, regMaster, bitmaskSize, bytesInLeft ) {
		/* ==== Guards ==== */
		jsEmu.Assert(this != self, "SubRegister constructor :: not called as constructor.");
		jsEmu.Assert(regMaster && (regMaster instanceof jsEmu.Register || regMaster instanceof jsEmu.LazyFlagRegister), "SubRegister constructor :: no valid master register specified.");
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
			
			this.Get = SubRegister_Get_First;
			this.Set = SubRegister_Set_First;
		// General case
		} else {
			this.bitsShiftRight = bytesInLeft * 8;
			this.bitmaskOccupies = bitmaskSize << this.bitsShiftRight;
			// Bitmask for extracting only the part of the value not occupied by this subregister
			this.bitmaskNotOccupies = 0xFFFFFFFF - this.bitmaskOccupies;
			
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
	
	var SubRegister_Get_First = function () {
		// Mask, leaving only subvalue
		return (this.regMaster.Get() & this.bitmaskSize);
	};
	var SubRegister_Get_General = function () {
		// Mask, leaving only subvalue
		return ((this.regMaster.Get() >> this.bitsShiftRight) & this.bitmaskSize);
	};
	
	// Faster case; if no bits to shift, remove shift operation from method function
	var SubRegister_Set_First = function ( val ) {
		this.regMaster.Set(
				// Mask out current SubRegister value
				(this.regMaster.Get() & this.bitmaskNotOccupies)
				// Restrict new value to max size of SubRegister
				//	( no need to move, SubRegister is at low end of bits )
				| (val & this.bitmaskOccupies)
			);
	};
	var SubRegister_Set_General = function ( val ) {
		this.regMaster.Set(
				// Mask out current SubRegister value
				(this.regMaster.Get() & this.bitmaskNotOccupies)
				// Move & Restrict new value to position & max size of SubRegister
				| ((val << this.bitsShiftRight) & this.bitmaskOccupies)
			);
	};
	
	/* ==== Exports ==== */
	jsEmu.Register = Register;
	jsEmu.SubRegister = SubRegister;
	/* ==== /Exports ==== */
});

// Add Module to emulator
jsEmu.AddModule(mod);