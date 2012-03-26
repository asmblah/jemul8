/*
 *	jsEmu - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: CPU "Lazy" Flag class support
 */
var mod = new jsEmu.PrimaryModule( function ( jsEmu ) {
	/* ============ Import system after setup ============ */
	var machine, motherboard, CPU, FlashBIOSChip, BIOS, DRAM;
	this.RegisterDeferredLoader( function ( machine_, motherboard_, CPU_, FlashBIOSChip_, BIOS_, DRAM_ ) {
			machine = machine_; motherboard = motherboard_; CPU = CPU_; FlashBIOSChip = FlashBIOSChip_; BIOS = BIOS_; DRAM = DRAM_;
		});
	/* ============ /Import system after setup ============ */
	
	// CPU Lazy Flag class constructor
	function LazyFlag( name, regMaster, bitsInLeft ) {
		/* ==== Guards ==== */
		jsEmu.Assert(this != self, "LazyFlag constructor :: not called as constructor.");
		jsEmu.Assert(regMaster && regMaster instanceof jsEmu.LazyFlagRegister, "LazyFlag constructor :: no valid master LazyFlagRegister specified.");
		/* ==== /Guards ==== */
		
		this.bitsInLeft = bitsInLeft;
		this.bitmaskDirty = 1 << bitsInLeft;
		
		this.value = 0;
		
		this.name = name;
		this.regMaster = regMaster;
		
		switch ( name ) {
		case "CF":
			this.hshGetLazy = GetFlag_CF;
			break;
		case "PF":
			this.hshGetLazy = GetFlag_PF;
			break;
		case "AF":
			this.hshGetLazy = GetFlag_AF;
			break;
		case "ZF":
			this.hshGetLazy = GetFlag_ZF;
			break;
		case "SF":
			this.hshGetLazy = GetFlag_SF;
			break;
		case "OF":
			this.hshGetLazy = GetFlag_OF;
			break;
		}
		
		// Add to master LazyFlagsRegister's hash
		regMaster.hsh_flg[bitsInLeft] = this;
	}
	LazyFlag.prototype.GetName = function () {
		return this.name;
	};
	LazyFlag.prototype.Get = function () {
		// When flagged as dirty, reads must evaluate flag from result
		//	of last operation
		if ( this.regMaster.bitsDirty & this.bitmaskDirty ) {
			this.value = this.hshGetLazy[CPU.name_insnLast]();
			// Flag is no longer dirty; clear dirty bit in Register
			this.regMaster.bitsDirty &= ~this.bitmaskDirty;
		}
		return this.value;
	};
	LazyFlag.prototype.Set = function () {
		// Flag is definitely not dirty; clear dirty bit in Register
		this.regMaster.bitsDirty &= ~this.bitmaskDirty;
		this.value = 1;
	};
	LazyFlag.prototype.Clear = function () {
		// Flag is definitely not dirty; clear dirty bit in Register
		this.regMaster.bitsDirty &= ~this.bitmaskDirty;
		this.value = 0;
	};
	LazyFlag.prototype.SetBin = function ( val ) {
		// Flag is definitely not dirty; clear dirty bit in Register
		this.regMaster.bitsDirty &= ~this.bitmaskDirty;
		// Should be faster than eg. val ? 1 : 0
		this.value = val & 0xFFFFFFFF;
	};
	LazyFlag.prototype.Toggle = function () {
		this.Set(!this.Get());
	};
	
	/* ====== Private ====== */
	
	/* =========== Lazy Flags evaluation =========== */
	// Based on Bochs source code: cpu/lazy_flags.cc
	
	// Carry Flag
	var GetFlag_CF = {};
	GetFlag_CF["ADD"] = function () {
		CPU.CF.SetBin(CPU.resLast < CPU.valLast1);
	};
	GetFlag_CF["ADC"] = function () {
		CPU.CF.SetBin(CPU.resLast <= CPU.valLast1);
	};
	GetFlag_CF["SUB"] = function () {
		CPU.CF.SetBin(CPU.valLast1 < CPU.valLast2);
	};
	GetFlag_CF["SBB"] = function () {
		var bitmask = (1 << (CPU.size_insnLast_Bytes * 8)) - 1;
		CPU.CF.SetBin((CPU.valLast1 < CPU.resLast) || (CPU.valLast2 === bitmask));
	};
	GetFlag_CF["NEG"] = function () {
		CPU.CF.SetBin(CPU.resLast != 0);
	};
	GetFlag_CF["AND"] = GetFlag_CF["OR"] = GetFlag_CF["XOR"] = GetFlag_CF["NOT"] = GetFlag_CF["TEST"] = function () {
		CPU.CF.Clear();
	};
	// Parity Flag ( parity of low 8 bits )
	var GetFlag_PF = function () {
		// Simple lookup for parity of low 8 bits
		CPU.PF.SetBin(mapParity[CPU.resLast & 0xFF]);
	};
	// Auxiliary / BCD Adjustment Flag
	var GetFlag_AF = {};
	GetFlag_AF["ADD"] = GetFlag_AF["ADC"] = GetFlag_AF["SUB"] = GetFlag_AF["SBB"] = function () {
		CPU.AF.SetBin(((CPU.valLast1 ^ CPU.valLast2) ^ CPU.resLast) & 0x10);
	};
	GetFlag_AF["NEG"] = function () {
		CPU.AF.SetBin((CPU.resLast & 0x0F) != 0);
	};
	GetFlag_AF["INC"] = function () {
		CPU.AF.SetBin((CPU.resLast & 0x0F) == 0);
	};
	GetFlag_AF["DEC"] = function () {
		CPU.AF.SetBin((CPU.resLast & 0x0F) == 0x0F);
	};
	GetFlag_AF["AND"] = GetFlag_AF["OR"] = GetFlag_AF["XOR"] = GetFlag_AF["NOT"] = GetFlag_AF["TEST"] = function () {
		CPU.AF.Clear();
	};
	// Zero Flag
	var GetFlag_ZF = function () {
		CPU.ZF.SetBin(CPU.resLast === 0);
	};	
	// Sign Flag
	var GetFlag_SF = function () {
		// Sign flag set if negative ( use two's complement signed high-bit check )
		CPU.SF.SetBin(CPU.resLast >> 31);
	};	
	// Overflow Flag
	var GetFlag_OF = {};
	GetFlag_OF["ADD"] = GetFlag_OF["ADC"] = function () {
		var bitmask = (1 << (CPU.size_insnLast_Bytes * 8)) - 1;
		
		CPU.OF.SetBin(((~((CPU.valLast1) ^ (CPU.valLast2)) & ((CPU.valLast2) ^ (CPU.resLast))) & (bitmask)) != 0);
	};
	GetFlag_OF["SUB"] = GetFlag_OF["SBB"] = function () {
		var bitmask = (1 << (CPU.size_insnLast_Bytes * 8)) - 1;
		
		CPU.OF.SetBin(((((CPU.valLast1) ^ (CPU.valLast2)) & ((CPU.valLast1) ^ (CPU.resLast))) & (bitmask)) != 0);
	};
	GetFlag_OF["NEG"] = GetFlag_OF["INC"] = function () {
		// eg. 80, 8000, 80000000
		var half = Math.pow(2, CPU.size_insnLast_Bytes * 8 - 1);
		CPU.OF.SetBin(CPU.resLast === half);
	};
	GetFlag_OF["DEC"] = function () {
		// eg. 7F, 7FFF, 7FFFFFFF
		var half = ((1 << (CPU.size_insnLast_Bytes * 8)) - 1) / 2;
		CPU.OF.SetBin(CPU.resLast === half);
	};
	GetFlag_OF["AND"] = GetFlag_OF["OR"] = GetFlag_OF["XOR"] = GetFlag_OF["NOT"] = GetFlag_OF["TEST"] = function () {
		CPU.OF.Clear();
	};
	/* =========== /Lazy Flags evaluation =========== */
	
	function GetParity( num ) {
		/* ==== Malloc ==== */
		var res = 0;
		/* ==== /Malloc ==== */
		while ( num ) {
			++res;
			// Loop will execute once for each bit set in num
			num &= num - 1;
		}
		
		return (res % 2 == 0) ? 1 : 0;
	}
	
	// Cache parity values up to 0xFF in lookup table
	//	( eg. mapParity[val & 0xFF] )
	var mapParity = {};
	for ( var num = 0 ; num <= 0xFF ; ++num ) {
		mapParity[num] = GetParity(num);
	}
	
	/* ====== /Private ====== */
	
	/* ==== Exports ==== */
	jsEmu.LazyFlag = LazyFlag;
	/* ==== /Exports ==== */
});

// Add Module to emulator
jsEmu.AddModule(mod);