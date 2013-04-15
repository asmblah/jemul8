/*
 * jemul8 - JavaScript x86 Emulator
 *
 * MODULE: IBM-PC compatible machine support
 *
 * ====
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*jslint bitwise: true, plusplus: true */
/*global define, require */

define([
	"../util",
	"./pin",
	"./timer"
], function (
	util,
	Pin,
	Timer
) {
    "use strict";

	// IBM-compatible PC class constructor
	function PC(emu) {
		util.assert(this && (this instanceof PC)
			, "PC constructor :: error - not called properly"
		);

		this.emu = emu;

		this.list_tmr = [];

		// (H)old (R)e(Q)uest
		this.HRQ = new Pin("HRQ");

		this.enableA20 = false;
		this.maskA20 = util.MASK_DISABLE_A20;
	}
	PC.prototype.install = function (component) {
		switch (component.constructor) {
		default:
			util.problem("PC.install :: Provided component"
				+ " cannot be installed inside the PC.");
		}
	};
	// (Timer concept from Bochs)
	PC.prototype.MAX_TIMERS = 64; // Same as Bochs
	PC.prototype.registerTimer = function ( fn, obj_this, intervalUsecs
											, isContinuous, isActive, name ) {
		if (this.list_tmr.length > this.MAX_TIMERS) {
			return util.problem("PC.registerTimer() ::"
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
	PC.prototype.setEnableA20 = function (enable) {
		if (enable) {
			this.maskA20 = util.MASK_ENABLE_A20;
		} else {
			// Mask off the a20 address line
			this.maskA20 = util.MASK_DISABLE_A20;
		}
		util.debug("PC.setEnableA20() :: A20 address line "
			+ (enable ? "en" : "dis") + "abled");

		/*
		 * [Bochs] If there has been a transition, we need to notify the CPUs
		 *	so they can potentially invalidate certain cache info based on
		 *	A20-line-applied physical addresses.
		 */
		//if (this.enableA20 !== enable) MemoryMappingChanged();
		util.info("PC.setEnableA20() :: TODO - invalidate caches etc.");

		this.enableA20 = enable;
	};
	// Perform a reset of the emulated machine: 'type' must be
	//	either RESET_HARDWARE or RESET_SOFTWARE
	// Based on [bx_pc_system_c::Reset]
	PC.prototype.reset = function (type) {
		util.info("PC.reset() :: System reset called - type is '"
			+ (type === util.RESET_HARDWARE ? "hard" : "soft") + "ware'");

		// Unlike in Bochs' /pc_system.cc, we disable the A20 address line,
		//	as that is the real setting when the machine first boots up
		// TODO: Why did I decide on this? Need to check this is correct...
		this.setEnableA20(false);
		//this.setEnableA20(true);

		// Always reset CPU
		this.cpu.RESET.raise();

		// Only reset devices for Hardware resets
		if (type === util.RESET_HARDWARE) {
			this.resetIODevices(type);
		}
	};
	// Perform a reset of all I/O devices
	PC.prototype.resetIODevices = function (type) {
		this.cmos.reset(type);
		this.dma.reset(type);
		this.fdc.reset(type);
		this.pic.reset(type);
		this.pit.reset(type);
		this.keyboard.reset(type);
		this.vga.reset(type);
		this.guest2host.reset(type);

		// TODO: Call .reset() method of all I/O devices -
		//  these must be enumerable somehow?
	};
	if (Date.now) {
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

	// Exports
	return PC;
});
