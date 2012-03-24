/*
 *	jsEmu - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: IBM-PC compatible machine support
 */
var mod = new jsEmu.PrimaryModule( function ( jsEmu ) {
	// IBM-compatible PC class constructor
	function x86IBM_PC() {
		this.motherboard = null;
	}
	x86IBM_PC.prototype.InstallComponent = function ( component ) {
		switch ( component.constructor ) {
		// Install a compatible Motherboard into the emulated IBM-compatible PC
		case jsEmu.x86IBM_Motherboard:
			this.motherboard = component;
			break;
		default:
			throw new Error( "x86IBM_PC.InstallComponent :: Provided component cannot be installed inside the PC." );
		}
	};
	
	/* ==== Exports ==== */
	jsEmu.x86IBM_PC = x86IBM_PC;
	/* ==== /Exports ==== */
});

// Add Module to emulator
jsEmu.AddModule(mod);