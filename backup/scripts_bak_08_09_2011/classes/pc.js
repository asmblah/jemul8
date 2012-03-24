/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: IBM-PC compatible machine support
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("pc", function ( $ ) { "use strict";
	var jemul8 = this.data("jemul8")
	
	// Constants
		, MASK_ENABLE_A20 = 0xFFFFFFFF
		, MASK_DISABLE_A20 = 0xFFeFFFFF;
	
	// IBM-compatible PC class constructor
	function PC( emu ) {
		this.emu = emu;
		
		this.list_tmr = [];
		
		// (H)old (R)e(Q)uest
		this.HRQ = new jemul8.Pin( "HRQ" );
		
		this.enableA20 = false;
		this.maskA20 = MASK_DISABLE_A20;
	}
	PC.prototype.RESET_HARDWARE = 1;
	PC.prototype.RESET_SOFTWARE = 2;
	PC.prototype.install = function ( component ) {
		switch ( component.constructor ) {
		default:
			jemul8.problem("PC.install :: Provided component"
				+ " cannot be installed inside the PC.");
		}
	};
	// (Timer concept from Bochs)
	PC.prototype.MAX_TIMERS = 64; // Same as Bochs
	PC.prototype.registerTimer = function ( fn, obj_this, intervalUsecs
											, isContinuous, isActive, name ) {
		if ( this.list_tmr.length > this.MAX_TIMERS ) {
			return jemul8.problem("PC.registerTimer() ::"
				+ " MAX_TIMERS already registered");
		}
		var tmr = new Timer( this, fn, obj_this, intervalUsecs, isContinuous
			, isActive, name, this.list_tmr.length );
		this.list_tmr.push(tmr);
		return tmr;
	};
	PC.prototype.getEnableA20 = function () {
		return this.enableA20;
	};
	PC.prototype.setEnableA20 = function ( enable ) {
		if ( enable ) {
			this.maskA20 = MASK_ENABLE_A20;
		} else {
			// Mask off the a20 address line
			this.maskA20 = MASK_DISABLE_A20;
		}
		jemul8.debug("PC.setEnableA20() :: A20 address line "
			+ (enable ? "en" : "dis") + "abled");
		
		/*
		 * [Bochs] If there has been a transition, we need to notify the CPUs
		 *	so they can potentially invalidate certain cache info based on
		 *	A20-line-applied physical addresses.
		 */
		if ( this.enableA20 !== enable ) MemoryMappingChanged();
		
		this.enableA20 = enable;
	};
	// Perform a reset of the emulated machine: 'type' must be
	//	either RESET_HARDWARE or RESET_SOFTWARE
	// Based on [bx_pc_system_c::Reset]
	PC.prototype.reset = function ( type ) {
		jemul8.info("PC.reset() :: System reset called - type is '"
			+ (type === this.RESET_HARDWARE ? "hard" : "soft") + "ware'");
		
		// Unlike in Bochs' /pc_system.cc, we disable the A20 address line,
		//	as that is the setting when the machine first boots up
		this.setEnableA20(false);
		
		// Always reset CPU
		this.cpu.reset();
		
		// Only reset devices for Hardware resets
		if ( type === this.RESET_HARDWARE ) {
			this.resetIODevices(type);
		}
	};
	// Perform a reset of all I/O devices
	PC.prototype.resetIODevices = function ( type ) {
		
	};
	if ( Date.now ) {
		PC.prototype.getTimeMsecs = function () {
			return Date.now();
		};
	} else {
		PC.prototype.getTimeMsecs = function () {
			return new Date().getTime();
		};
	}
	PC.prototype.getTimeUsecs = function () {
		// We can only go down to milliseconds in JavaScript,
		//	rather than the microsecond granularity used in eg. Bochs.
		return this.getTimeMsecs() * 1000;
	};
	
	// Internal timers
	//	( could use setTimeout/setInterval,
	//	but these would run unchecked between yields:
	//	this should offer more control )
	function Timer( machine, fn, obj_this, intervalUsecs, isContinuous
				, isActive, name, idx ) {
		this.machine = machine;
		
		this.fn = fn;
		this.obj_this = obj_this; // Scope "this" object for callback function
		this.ticksNextFire;
		this.intervalUsecs = 0;
		this.isActive = isActive;
		this.name = name;
		this.idx = idx;
		this.activate(intervalUsecs, isContinuous);
	}
	Timer.prototype.unregister = function () {
		this.machine.list_tmr[ this.idx ] = null;
	};
	Timer.prototype.activate = function ( intervalUsecs, isContinuous ) {
		// Useconds is not 0, so set & use new period/interval
		if ( intervalUsecs !== 0 ) {
			this.intervalUsecs = intervalUsecs;
		}
		// Calculate & store the next expiry time for this timer
		this.ticksNextFire = new Date().getTime() + this.intervalUsecs / 1000;
		this.isContinuous = isContinuous; // Update flag
	};
	Timer.prototype.deactivate = function () {
		this.ticksNextFire = 0;
		this.isActive = false;
	};
	
	// Exports
	jemul8.PC = PC;
});
