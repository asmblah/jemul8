/*
 *	jsEmu - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: IBM-PC compatible Intel CPU support
 */
var mod = new jsEmu.PrimaryModule( function ( jsEmu ) {
	// x86 CPU class constructor
	function x86CPU( name_class ) {
		// Class / type of CPU ( eg. 386, 486, PIII, D )
		this.name_class = name_class;
		// Hash of CPU Registers, mapped by name
		this.hsh_reg = {};
		// Instruction cache ( decoded Instructions are stored indexed by absolute memory address
		//	to avoid needing to redecode Instructions executed more than once ( eg. in a loop ).
		this.arr_insnCache = [];
		
		this.isHalted = false;
		
		/* ====== Operands & result from last flag-affecting operation ====== */
		this.valLast1 = 0;
		this.valLast2 = 0;
		this.resLast = 0;
		/* ====== /Operands & result from last flag-affecting operation ====== */
	}
	x86CPU.prototype.InstallComponent = function ( component ) {
		switch ( component.constructor ) {
		// Install a compatible Register onto the emulated CPU
		case jsEmu.Register:	// Fall through
		case jsEmu.SubRegister:
		case jsEmu.LazyFlagRegister:
			// Hash used to get Register by its name
			this.hsh_reg[component.GetName()] = component;
			// Shortcut to using hash for time-critical parts
			this[component.GetName()] = component;
			break;
		default:
			throw new Error( "x86CPU.InstallComponent :: Provided component cannot be installed into the CPU." );
		}
	};
	// Determine whether the emulated CPU is in a halted state or not
	x86CPU.prototype.IsHalted = function () {
		return this.isHalted;
	};
	// Force emulated CPU into a halted state
	x86CPU.prototype.Halt = function () {
		this.isHalted = true;
	};
	// Force emulated CPU to resume from CS:EIP
	x86CPU.prototype.Resume = function () {
		this.isHalted = false;
	};
	
	// For debugging purposes with Firebug
	x86CPU.prototype.GetState = function () {
		/* ==== Malloc ==== */
		var textEFlags;
		/* ==== /Malloc ==== */
		
		/* ====== Build DEBUG.COM-like Flags state text ====== */
		textEFlags = (this.OF.Get() ? "OV/1 " : "NV/0 ")
					+ (this.DF.Get() ? "DN/1 " : "UP/0 ")
					+ (this.IF.Get() ? "EI/1 " : "DI/0 ")
					+ (this.SF.Get() ? "NG/1 " : "PL/0 ")
					+ (this.ZF.Get() ? "ZR/1 " : "NZ/0 ")
					+ (this.AF.Get() ? "AC/1 " : "NA/0 ")
					+ (this.PF.Get() ? "PE/1 " : "PO/0 ")
					+ (this.CF.Get() ? "CY/1" : "NC/0");
		/* ====== /Build DEBUG.COM-like Flags state text ====== */
		
		// Numbers used to ensure correct order
		return {
				"1 :: EAX": this.EAX.GetHexString()
				, "2 :: EBX": this.EBX.GetHexString()
				, "3 :: ECX": this.ECX.GetHexString()
				, "4 :: EDX": this.EDX.GetHexString()
				, "5 :: ESP": this.ESP.GetHexString()
				, "6 :: EBP": this.EBP.GetHexString()
				, "7 :: ESI": this.ESI.GetHexString()
				, "8 :: EDI": this.EDI.GetHexString()
				, "9 :: DS": this.DS.GetHexString()
				, "10 :: ES": this.ES.GetHexString()
				, "11 :: SS": this.SS.GetHexString()
				, "12 :: CS": this.CS.GetHexString()
				, "13 :: EIP": this.EIP.GetHexString()
				, "14 :: EFLAGS": textEFlags
			};
	};
	
	/* ==== Exports ==== */
	jsEmu.x86CPU = x86CPU;
	/* ==== /Exports ==== */
});

// Add Module to emulator
jsEmu.AddModule(mod);