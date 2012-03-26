/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: IBM-PC compatible machine support
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("ibm_pc", function ( $ ) {
	var x86Emu = this.data("x86Emu");
	
	// Import system after setup
	var machine, CPU, DRAM;
	this.bind("load", function ( $, machine_, CPU_, DRAM_ ) {
		machine = machine_; CPU = CPU_; DRAM = DRAM_;
	});
	
	// IBM-compatible PC class constructor
	function x86IBM_PC() {
		this.hsh_portIORead = {};
		this.hsh_portIOWrite = {};
		this.list_tmr = [];
		
		this.HRQ = new x86Emu.Pin( "HRQ" );
	}
	x86IBM_PC.prototype.install = function ( component ) {
		switch ( component.constructor ) {
		default:
			throw new Error( "x86IBM_PC.install :: Provided component cannot be installed inside the PC." );
		}
	};
	// Concept from Bochs
	x86IBM_PC.prototype.MAX_TIMERS = 64; // Same as Bochs
	x86IBM_PC.prototype.registerTimer = function ( fn, obj_this, intervalUsecs, isContinuous, isActive, name ) {
		if ( this.list_tmr.length > this.MAX_TIMERS ) {
			return $.problem("x86IBM_PC.registerTimer() :: MAX_TIMERS already registered");
		}
		var tmr = new Timer( fn, obj_this, intervalUsecs, isContinuous, isActive, name, this.list_tmr.length );
		this.list_tmr.push(tmr);
		return tmr;
	};
	
	// Internal timers
	//	( could use setTimeout/setInterval,
	//	but these would run unchecked between yields:
	//	this should offer more control )
	function Timer( fn, obj_this, intervalUsecs, isContinuous, isActive, name, idx ) {
		this.fn = fn;
		this.obj_this = obj_this; // Scope "this" object for callback function
		this.ticksNextFire;
		this.intervalUsecs = 0;
		this.isActive = isActive;
		this.name = name;
		this.idx = idx;
		this.Activate(intervalUsecs, isContinuous);
	}
	Timer.prototype.UnRegister = function () {
		machine.list_tmr[ this.idx ] = null;
	};
	Timer.prototype.Activate = function ( intervalUsecs, isContinuous ) {
		// Useconds is not 0, so set & use new period/interval
		if ( intervalUsecs !== 0 ) {
			this.intervalUsecs = intervalUsecs;
		}
		// Calculate & store the next expiry time for this timer
		this.ticksNextFire = new Date().getTime() + this.intervalUsecs / 1000;
		this.isContinuous = isContinuous; // Update flag
	};
	Timer.prototype.Deactivate = function () {
		this.ticksNextFire = 0;
		this.isActive = false;
	};
	
	// Exports
	x86Emu.x86IBM_PC = x86IBM_PC;
});
