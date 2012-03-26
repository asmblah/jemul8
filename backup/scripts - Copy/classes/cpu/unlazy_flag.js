/*
 *	jsEmu - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: CPU "Unlazy" Flag class support
 *		Notes: Allows a LazyFlagsRegister to also have non-lazy flags
 */
var mod = new jsEmu.PrimaryModule( function ( jsEmu ) {
	/* ============ Import system after setup ============ */
	var machine, motherboard, CPU, FlashBIOSChip, BIOS, DRAM;
	this.RegisterDeferredLoader( function ( machine_, motherboard_, CPU_, FlashBIOSChip_, BIOS_, DRAM_ ) {
		machine = machine_; motherboard = motherboard_; CPU = CPU_; FlashBIOSChip = FlashBIOSChip_; BIOS = BIOS_; DRAM = DRAM_;
	});
	/* ============ /Import system after setup ============ */
	
	// CPU Unlazy Flag class constructor
	function UnlazyFlag( name, regMaster, bitsInLeft ) {
		/* ==== Guards ==== */
		jsEmu.Assert(this != self, "UnlazyFlag constructor :: not called as constructor.");
		jsEmu.Assert(regMaster && regMaster instanceof jsEmu.LazyFlagRegister, "UnlazyFlag constructor :: no valid master LazyFlagRegister specified.");
		/* ==== /Guards ==== */
		
		this.bitsInLeft = bitsInLeft;
		
		this.value = 0;
		
		this.name = name;	// May be null for anonymous / reserved flags
		this.regMaster = regMaster;
		
		// Add to master LazyFlagsRegister's hash
		regMaster.hsh_flg[ bitsInLeft ] = this;
	}
	UnlazyFlag.prototype.GetName = function () {
		return this.name;
	};
	UnlazyFlag.prototype.Get = function () {
		return this.value;
	};
	UnlazyFlag.prototype.Set = function () {
		this.value = 1;
	};
	UnlazyFlag.prototype.Clear = function () {
		this.value = 0;
	};
	UnlazyFlag.prototype.SetBin = function ( val ) {
		// Should be faster than eg. val ? 1 : 0
		this.value = val & 0x01;
	};
	UnlazyFlag.prototype.Toggle = function () {
		this.Set(!this.Get());
	};
	
	/* ====== Private ====== */
	
	/* ====== /Private ====== */
	
	/* ==== Exports ==== */
	jsEmu.UnlazyFlag = UnlazyFlag;
	/* ==== /Exports ==== */
});

// Add Module to emulator
jsEmu.AddModule(mod);