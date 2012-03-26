/*
 *	jsEmu - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: IBM-PC compatible machine support
 */
var mod = new jsEmu.PrimaryModule( function ( jsEmu ) {
	/* ============ Import system after setup ============ */
	var machine, motherboard, CPU, FlashBIOSChip, BIOS, DRAM;
	this.RegisterDeferredLoader( function ( machine_, motherboard_, CPU_, FlashBIOSChip_, BIOS_, DRAM_ ) {
		machine = machine_; motherboard = motherboard_; CPU = CPU_; FlashBIOSChip = FlashBIOSChip_; BIOS = BIOS_; DRAM = DRAM_;
	});
	/* ============ /Import system after setup ============ */
	
	// IBM-compatible PC class constructor
	function x86IBM_PC() {
		this.motherboard = null;
		this.list_tmr = [];
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
	// Concept from Bochs
	x86IBM_PC.prototype.MAX_TIMERS = 64; // Same as Bochs
	x86IBM_PC.prototype.RegisterTimer = function ( fn, intervalUsecs, isContinuous, isActive, name ) {
		if ( this.list_tmr.length > this.MAX_TIMERS ) {
			return jsEmu.Error("x86IBM_PC.RegisterTimer() :: MAX_TIMERS already registered");
		}
		var tmr = new Timer( fn, intervalUsecs, isContinuous, isActive, name, this.list_tmr.length );
		this.list_tmr.push(tmr);
		return tmr;
	};
	
	// Internal timers
	//	( could use setTimeout/setInterval,
	//	but these would run unchecked between yields:
	//	this should offer more control )
	function Timer( fn, intervalUsecs, isContinuous, isActive, name, idx ) {
		this.fn = fn;
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
		this.ticksNextFire = new Date().getTime() + this.intervalUsecs;
		this.isContinuous = isContinuous; // Update flag
	};
	Timer.prototype.Deactivate = function () {
		this.ticksNextFire = 0;
		this.isActive = false;
	};
	
	/* ==== Exports ==== */
	jsEmu.x86IBM_PC = x86IBM_PC;
	/* ==== /Exports ==== */
});

// Add Module to emulator
jsEmu.AddModule(mod);