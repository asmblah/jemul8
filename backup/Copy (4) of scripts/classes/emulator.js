/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: Emulator Main System class support
 */

// Augment jQuery plugin
new jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("emulator", function ( $ ) {
	/* ==== Malloc ==== */
	// jemul8 Main System object
	self.jemul8 = new x86Emulator();
	/* ==== /Malloc ==== */
	
	// x86 Emulator class constructor
	function x86Emulator() {
		this.arr_modPrimary = [];
		this.arr_modSecondary = [];
	}
	x86Emulator.prototype.AddModule = function ( mod ) {
		switch ( mod.constructor ) {
		case jemul8.PrimaryModule:
			this.arr_modPrimary[this.arr_modPrimary.length] = mod;
			break;
		case jemul8.SecondaryModule:
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
	x86Emulator.prototype.DeferredModuleLoaders = function ( machine, CPU, DRAM ) {
		/* ==== Malloc ==== */
		var idx_mod;
		var num_mod;
		var mod;
		/* ==== /Malloc ==== */
		
		// Load all Primary Modules first
		for ( idx_mod = 0, num_mod = this.arr_modPrimary.length ; idx_mod < num_mod ; ++idx_mod ) {
			mod = this.arr_modPrimary[idx_mod];
			if ( mod.funcDeferredLoader ) {
				mod.funcDeferredLoader.call(mod, machine, CPU, DRAM);
			}
		}
	};
	
	// Initialise the Emulator & all its Modules
	x86Emulator.prototype.InitSecondaryModules = function ( machine, CPU, DRAM ) {
		/* ==== Malloc ==== */
		var idx_mod;
		var num_mod;
		var mod;
		/* ==== /Malloc ==== */
		
		// Load all Secondary Modules
		for ( idx_mod = 0, num_mod = this.arr_modSecondary.length ; idx_mod < num_mod ; ++idx_mod ) {
			mod = this.arr_modSecondary[idx_mod];
			mod.funcScopeWrapper.call(mod, this, machine, CPU, DRAM);
		}
	};
	// Format number as pretty hex string
	x86Emulator.prototype.HexFormat = function ( val ) {
		return "0x" + val.toString(16).toUpperCase();
	};
	// Format time as pretty string
	x86Emulator.prototype.TimeFormat = function ( hour, minute, sec ) {
		return hour + ":" + minute + ":" + sec;
	};
	// Format boolean as pretty string
	x86Emulator.prototype.BoolFormat = function ( bool ) {
		return bool ? "true" : "false";
	};
	
	/* ==== System Module Exports ==== */
	jemul8.x86Emulator = x86Emulator;
	/* ==== /System Module Exports ==== */
});
