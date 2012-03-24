/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: IBM-PC compatible machine support
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("ibm_pc", function ( $ ) { "use strict";
	var x86Emu = this.data("x86Emu");
	
	// IBM-compatible PC class constructor
	function IBM_PC( emu ) {
		this.emu = emu;
		
		this.hsh_portIORead = {};
		this.hsh_portIOWrite = {};
		this.list_tmr = [];
		
		// (H)old (R)e(Q)uest
		this.HRQ = new x86Emu.Pin( "HRQ" );
		
		this.enableA20 = false;
		this.maskA20 = 0x0007FFFF;
	}
	IBM_PC.prototype.install = function ( component ) {
		switch ( component.constructor ) {
		default:
			$.problem("IBM_PC.install :: Provided component"
				+ " cannot be installed inside the PC.");
		}
	};
	// Concept from Bochs
	IBM_PC.prototype.MAX_TIMERS = 64; // Same as Bochs
	IBM_PC.prototype.registerTimer = function ( fn, obj_this, intervalUsecs
											, isContinuous, isActive, name ) {
		if ( this.list_tmr.length > this.MAX_TIMERS ) {
			return $.problem("IBM_PC.registerTimer() ::"
				+ " MAX_TIMERS already registered");
		}
		var tmr = new Timer( this, fn, obj_this, intervalUsecs, isContinuous
			, isActive, name, this.list_tmr.length );
		this.list_tmr.push(tmr);
		return tmr;
	};
	IBM_PC.prototype.getEnableA20 = function ( enable ) {
		return this.enableA20;
	};
	IBM_PC.prototype.setEnableA20 = function ( enable ) {
		if ( enable ) {
			this.maskA20 = 0xFFFFFFFF;
		} else {
			// Mask off the a20 address line
			this.maskA20 = 0xFFeFFFFF;
		}
		$.debug("IBM_PC.setEnableA20() :: A20 address line "
			+ (enable ? "en" : "dis") + "abled");
		
		/*
		 * [Bochs] If there has been a transition, we need to notify the CPUs
		 *	so they can potentially invalidate certain cache info based on
		 *	A20-line-applied physical addresses.
		 */
		if ( this.enableA20 !== enable ) MemoryMappingChanged();
		
		this.enableA20 = enable;
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
	x86Emu.IBM_PC = IBM_PC;
});
