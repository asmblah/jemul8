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
		this.bitmaskDirtyGet = 1 << bitsInLeft;
		// NB: zero-extend shift-right operator used to force unsigned result with one's-complement negation
		//	( eg. 0xFFFFFFFF >> 0 == -1, but 0xFFFFFFFF >>> 0 == 0xFFFFFFFF )
		// NB2: opposite is to "num | 0"
		this.bitmaskDirtySet = (~this.bitmaskDirtyGet) >>> 0;
		
		this.value = 0;
		
		this.name = name;
		this.regMaster = regMaster;
		
		switch ( name ) {
		case "CF":
			this.hshGetLazy = GetFlag_CF;
			this.Get = Get_Other;
			break;
		case "PF":
			this.Get = Get_PF;
			break;
		case "AF":
			this.hshGetLazy = GetFlag_AF;
			this.Get = Get_Other;
			break;
		case "ZF":
			this.Get = Get_ZF;
			break;
		case "SF":
			this.Get = Get_SF;
			break;
		case "OF":
			this.hshGetLazy = GetFlag_OF;
			this.Get = Get_Other;
			break;
		// Unsupported Lazy Flag type
		default:
			throw new Error( "LazyFlag constructor :: Unsupported Lazy Flag" );
		}
		
		// Add to master LazyFlagsRegister's hash
		regMaster.hsh_flg[bitsInLeft] = this;
	}
	LazyFlag.prototype.GetName = function () {
		return this.name;
	};
	// Polymorphic
	LazyFlag.prototype.Get = null;
	LazyFlag.prototype.Set = function () {
		// Flag is definitely not dirty; clear dirty bit in Register
		this.regMaster.bitsDirty = (this.regMaster.bitsDirty & this.bitmaskDirtySet) >>> 0;
		this.value = 1;
	};
	LazyFlag.prototype.Clear = function () {
		// Flag is definitely not dirty; clear dirty bit in Register
		this.regMaster.bitsDirty = (this.regMaster.bitsDirty & this.bitmaskDirtySet) >>> 0;
		this.value = 0;
	};
	LazyFlag.prototype.SetBin = function ( val ) {
		// Flag is definitely not dirty; clear dirty bit in Register
		this.regMaster.bitsDirty = (this.regMaster.bitsDirty & this.bitmaskDirtySet) >>> 0;
		// Should be faster than eg. val ? 1 : 0
		this.value = val & 0x01;
	};
	LazyFlag.prototype.Toggle = function () {
		this.Set(!this.Get());
	};
	
	/* ====== Private ====== */
	
	/* =========== Lazy Flags evaluation =========== */
	// Based on Bochs source code: cpu/lazy_flags.cc
	
	function Get_PF() {
		// When flagged as dirty, reads must evaluate flag from result
		//	of last operation
		if ( this.regMaster.bitsDirty & this.bitmaskDirtyGet ) {
			// Simple lookup for parity of low 8 bits
			this.value = mapParity[CPU.resLast & 0xFF];
			// Flag is no longer dirty; clear dirty bit in Register
			this.regMaster.bitsDirty = (this.regMaster.bitsDirty & this.bitmaskDirtySet) >>> 0;
		}
		return this.value;
	}
	function Get_ZF() {
		// When flagged as dirty, reads must evaluate flag from result
		//	of last operation
		if ( this.regMaster.bitsDirty & this.bitmaskDirtyGet ) {
			this.value = (CPU.resLast === 0);
			// Flag is no longer dirty; clear dirty bit in Register
			this.regMaster.bitsDirty = (this.regMaster.bitsDirty & this.bitmaskDirtySet) >>> 0;
		}
		return this.value;
	}
	function Get_SF() {
		// When flagged as dirty, reads must evaluate flag from result
		//	of last operation
		if ( this.regMaster.bitsDirty & this.bitmaskDirtyGet ) {
			// Sign flag set if negative ( use two's-complement signed high-bit check )
			this.value = (CPU.resLast >> 31);
			// Flag is no longer dirty; clear dirty bit in Register
			this.regMaster.bitsDirty = (this.regMaster.bitsDirty & this.bitmaskDirtySet) >>> 0;
		}
		return this.value;
	}
	
	function Get_Other() {
		// When flagged as dirty, reads must evaluate flag from result
		//	of last operation
		if ( this.regMaster.bitsDirty & this.bitmaskDirtyGet ) {
			this.hshGetLazy[CPU.name_insnLast].call(this);
			// Flag is no longer dirty; clear dirty bit in Register
			this.regMaster.bitsDirty = (this.regMaster.bitsDirty & this.bitmaskDirtySet) >>> 0;
		}
		return this.value;
	}
	
	// Carry Flag
	var GetFlag_CF = {};
	GetFlag_CF["ADD"] = GetFlag_CF["MUL"] = function () {
		this.value = (CPU.resLast < CPU.valLast1);
	};
	GetFlag_CF["ADC"] = function () {
		this.value = (CPU.resLast <= CPU.valLast1);
	};
	GetFlag_CF["SUB"] = GetFlag_CF["CMP"] = function () {
		this.value = (CPU.valLast1 < CPU.valLast2);
	};
	GetFlag_CF["SBB"] = function () {
		var bitmask = (1 << (CPU.size_insnLast_Bytes * 8)) - 1;
		this.value = ((CPU.valLast1 < CPU.resLast) || (CPU.valLast2 === bitmask));
	};
	GetFlag_CF["NEG"] = function () {
		this.value = (CPU.resLast != 0);
	};
	GetFlag_CF["AND"] = GetFlag_CF["OR"] = GetFlag_CF["XOR"] = GetFlag_CF["NOT"] = GetFlag_CF["TEST"]
			= GetFlag_CF["DIV"] = GetFlag_CF["DEC"] = function () {
		this.value = 0;
	};
	
	// Auxiliary / BCD Adjustment Flag
	var GetFlag_AF = {};
	GetFlag_AF["ADD"] = GetFlag_AF["MUL"] = GetFlag_AF["ADC"] = GetFlag_AF["SUB"] = GetFlag_AF["CMP"] = GetFlag_AF["SBB"] = function () {
		this.value = (((CPU.valLast1 ^ CPU.valLast2) ^ CPU.resLast) & 0x10);
	};
	GetFlag_AF["NEG"] = function () {
		this.value = ((CPU.resLast & 0x0F) != 0);
	};
	GetFlag_AF["INC"] = function () {
		this.value = ((CPU.resLast & 0x0F) == 0);
	};
	GetFlag_AF["DEC"] = function () {
		this.value = ((CPU.resLast & 0x0F) == 0x0F);
	};
	GetFlag_AF["AND"] = GetFlag_AF["OR"] = GetFlag_AF["XOR"] = GetFlag_AF["NOT"] = GetFlag_AF["TEST"]
			= GetFlag_AF["DIV"] = function () {
		this.value = 0;
	};
	
	// Overflow Flag
	var GetFlag_OF = {};
	GetFlag_OF["ADD"] = GetFlag_OF["MUL"] = GetFlag_OF["ADC"] = function () {
		var bitmask = (1 << (CPU.size_insnLast_Bytes * 8)) - 1;
		
		this.value = (((~((CPU.valLast1) ^ (CPU.valLast2)) & ((CPU.valLast2) ^ (CPU.resLast))) & (bitmask)) != 0);
	};
	GetFlag_OF["SUB"] = GetFlag_OF["CMP"] = GetFlag_OF["SBB"] = function () {
		var bitmask = (1 << (CPU.size_insnLast_Bytes * 8)) - 1;
		
		this.value = (((((CPU.valLast1) ^ (CPU.valLast2)) & ((CPU.valLast1) ^ (CPU.resLast))) & (bitmask)) != 0);
	};
	GetFlag_OF["NEG"] = GetFlag_OF["INC"] = function () {
		// eg. 80, 8000, 80000000
		var half = Math.pow(2, CPU.size_insnLast_Bytes * 8 - 1);
		this.value = (CPU.resLast === half);
	};
	GetFlag_OF["DEC"] = function () {
		// eg. 7F, 7FFF, 7FFFFFFF
		var half = ((1 << (CPU.size_insnLast_Bytes * 8)) - 1) / 2;
		this.value = (CPU.resLast === half);
	};
	GetFlag_OF["AND"] = GetFlag_OF["OR"] = GetFlag_OF["XOR"] = GetFlag_OF["NOT"] = GetFlag_OF["TEST"]
			= GetFlag_OF["DIV"] = function () {
		this.value = 0;
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