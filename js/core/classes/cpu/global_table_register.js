/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *	
 *	MODULE: Global (Descriptor) Table Register (GDTR, IDTR) class support
 */

define([
	"../../util"
], function ( util ) { "use strict";
	
	// Global Table Register class constructor
	function GlobalTableRegister( name ) {
		util.assert(this && (this instanceof GlobalTableRegister)
			, "GlobalTableRegister constructor :: error - not called properly"
		);
		
        this.name = name;
		this.base = 0;
        this.limit = 0;
	}
	util.extend(GlobalTableRegister.prototype, {
		// Sets the register back to its startup state
		reset: function ( raw ) {
			this.base = 0x00000000;
            this.limit =    0xFFFF;
		}
	});
	
	// Exports
	return GlobalTableRegister;
});
