/*
 *	jsEmu - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: Emulator Main System class support
 */
// Scope encapsulator
new function () {
	/* ==== Malloc ==== */
	// jsEmu Main System object
	self.jsEmu = new x86Emulator();
	/* ==== /Malloc ==== */
	
	// x86 Emulator class constructor
	function x86Emulator() {
		this.arr_modPrimary = [];
		this.arr_modSecondary = [];
	}
	x86Emulator.prototype.AddModule = function ( mod ) {
		switch ( mod.constructor ) {
		case jsEmu.PrimaryModule:
			this.arr_modPrimary[this.arr_modPrimary.length] = mod;
			break;
		case jsEmu.SecondaryModule:
			this.arr_modSecondary[this.arr_modSecondary.length] = mod;
			break;
		}
	};
	// Initialise the Emulator & all its Modules
	x86Emulator.prototype.InitPrimaryModules = function () {
		/* ==== Malloc ==== */
		var idx_mod;
		var num_mod;
		var mod;
		/* ==== /Malloc ==== */
		
		// Load all Primary Modules first
		for ( idx_mod = 0, num_mod = this.arr_modPrimary.length ; idx_mod < num_mod ; ++idx_mod ) {
			mod = this.arr_modPrimary[idx_mod];
			mod.funcScopeWrapper.call(mod, this);
		}
	};
	// 
	x86Emulator.prototype.DeferredModuleLoaders = function ( machine, motherboard, CPU, FlashBIOSChip, BIOS, DRAM ) {
		/* ==== Malloc ==== */
		var idx_mod;
		var num_mod;
		var mod;
		/* ==== /Malloc ==== */
		
		// Load all Primary Modules first
		for ( idx_mod = 0, num_mod = this.arr_modPrimary.length ; idx_mod < num_mod ; ++idx_mod ) {
			mod = this.arr_modPrimary[idx_mod];
			if ( mod.funcDeferredLoader ) {
				mod.funcDeferredLoader.call(mod, machine, motherboard, CPU, FlashBIOSChip, BIOS, DRAM);
			}
		}
	};
	
	// Initialise the Emulator & all its Modules
	x86Emulator.prototype.InitSecondaryModules = function ( machine, motherboard, CPU, FlashBIOSChip, BIOS, DRAM ) {
		/* ==== Malloc ==== */
		var idx_mod;
		var num_mod;
		var mod;
		/* ==== /Malloc ==== */
		
		// Load all Secondary Modules
		for ( idx_mod = 0, num_mod = this.arr_modSecondary.length ; idx_mod < num_mod ; ++idx_mod ) {
			mod = this.arr_modSecondary[idx_mod];
			mod.funcScopeWrapper.call(mod, this, machine, motherboard, CPU, FlashBIOSChip, BIOS, DRAM);
		}
	};
	
	/* ==== System Module Exports ==== */
	jsEmu.x86Emulator = x86Emulator;
	/* ==== /System Module Exports ==== */
}