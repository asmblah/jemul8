/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: CPU "Lazy" Flag class support
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("lazy_flag", function ( $ ) { "use strict";
	var x86Emu = this.data("x86Emu")
		// Flag getter lookups
		, hsh_getCF = {}, hsh_getAF = {}, hsh_getOF = {};
	
	// CPU Lazy Flag class constructor
	function LazyFlag( name, regMaster, bitsInLeft ) {
		/* ==== Guards ==== */
		$.assert(this && (this instanceof LazyFlag), "LazyFlag ctor ::"
			+ " error - constructor not called properly");
		$.assert(regMaster && (regMaster instanceof x86Emu.LazyFlagRegister)
			, "LazyFlag constructor ::"
			+ " no valid master LazyFlagRegister specified.");
		/* ==== /Guards ==== */
		
		this.cpu = null; // Set on installation
		
		this.bitsInLeft = bitsInLeft;
		this.bitmaskDirtyGet = 1 << bitsInLeft;
		// NB: zero-extend shift-right operator used to force
		//	unsigned result with one's-complement negation
		//	(eg. 0xFFFFFFFF >> 0 == -1, but 0xFFFFFFFF >>> 0 == 0xFFFFFFFF)
		// NB2: opposite is to "num | 0"
		this.bitmaskDirtySet = (~this.bitmaskDirtyGet) >>> 0;
		
		// NB: It is EXTREMELY important that .value is ALWAYS stored
		//	as a 0 or 1, otherwise the use of identity operators throughout
		//	the code (=== & !==) will fail if comparing booleans to ints!
		this.value = 0;
		
		this.name = name;
		this.regMaster = regMaster;
		
		switch ( name ) {
		case "CF":
			this.hsh_get = hsh_getCF;
			this.get = getWithLookup;
			break;
		case "PF":
			this.get = getPF;
			break;
		case "AF":
			this.hsh_get = hsh_getAF;
			this.get = getWithLookup;
			break;
		case "ZF":
			this.get = getZF;
			break;
		case "SF":
			this.get = getSF;
			break;
		case "OF":
			this.hsh_get = hsh_getOF;
			this.get = getWithLookup;
			break;
		// Unsupported Lazy Flag type
		default:
			$.problem("LazyFlag constructor :: Unsupported Lazy Flag");
		}
		
		// Add to master LazyFlagsRegister's hash
		regMaster.hsh_flg[ bitsInLeft ] = this;
	}
	LazyFlag.prototype.get = null; // Polymorphic
	LazyFlag.prototype.set = function () {
		// Flag is definitely not dirty; clear dirty bit in Register
		this.regMaster.bitsDirty = (this.regMaster.bitsDirty
			& this.bitmaskDirtySet) >>> 0;
		this.value = 1;
	};
	LazyFlag.prototype.clear = function () {
		// Flag is definitely not dirty; clear dirty bit in Register
		this.regMaster.bitsDirty = (this.regMaster.bitsDirty
			& this.bitmaskDirtySet) >>> 0;
		this.value = 0;
	};
	LazyFlag.prototype.setBin = function ( val ) {
		// Flag is definitely not dirty; clear dirty bit in Register
		this.regMaster.bitsDirty = (this.regMaster.bitsDirty
			& this.bitmaskDirtySet) >>> 0;
		// Should be faster than eg. val ? 1 : 0
		this.value = val & 1;
	};
	LazyFlag.prototype.toggle = function () {
		this.set(!this.get());
	};
	
	/* ====== Private ====== */
	
	/* =========== Lazy Flags evaluation =========== */
	// Based on Bochs source code: cpu/lazy_flags.cc
	
	// These flags' calculations are the same for all instructions
	function getPF() {
		// When flagged as dirty, reads must evaluate flag from result
		//	of last operation
		if ( this.regMaster.bitsDirty & this.bitmaskDirtyGet ) {
			// Simple lookup for parity of low 8 bits
			this.value = mapParity[ this.cpu.resLast & 0xFF ];
			// Flag is no longer dirty; clear dirty bit in Register
			this.regMaster.bitsDirty = (this.regMaster.bitsDirty
				& this.bitmaskDirtySet) >>> 0;
		}
		return this.value;
	}
	function getZF() {
		// When flagged as dirty, reads must evaluate flag from result
		//	of last operation
		if ( this.regMaster.bitsDirty & this.bitmaskDirtyGet ) {
			this.value = (this.cpu.resLast === 0) & 1;
			// Flag is no longer dirty; clear dirty bit in Register
			this.regMaster.bitsDirty = (this.regMaster.bitsDirty
				& this.bitmaskDirtySet) >>> 0;
		}
		return this.value;
	}
	function getSF() {
		// When flagged as dirty, reads must evaluate flag from result
		//	of last operation
		if ( this.regMaster.bitsDirty & this.bitmaskDirtyGet ) {
			// Sign flag set if negative (use two's-complement signed high-bit check)
			this.value = (this.cpu.resLast >> 31);
			// Flag is no longer dirty; clear dirty bit in Register
			this.regMaster.bitsDirty = (this.regMaster.bitsDirty & this.bitmaskDirtySet) >>> 0;
		}
		return this.value;
	}
	// Other flags' values depend on the instruction
	function getWithLookup() {
		var cpu = this.cpu;
		// When flagged as dirty, reads must evaluate flag from result
		//	of last operation
		if ( this.regMaster.bitsDirty & this.bitmaskDirtyGet ) {
			if ( this.hsh_get[ cpu.insnLast.name ] ) {
				this.value
					= this.hsh_get[ cpu.insnLast.name ](cpu);
			} else {
				$.warning("Cannot calculate value for lazy-flag " + this.name
					+ ", leaving unchanged (this needs fixing!!!)");
			}
			
			// Flag is no longer dirty; clear dirty bit in Register
			this.regMaster.bitsDirty = (this.regMaster.bitsDirty
				& this.bitmaskDirtySet) >>> 0;
		}
		return this.value;
	}
	
	// Carry Flag
	hsh_getCF[ "ADD" ] = hsh_getCF[ "MUL" ] = function ( cpu ) {
		return (cpu.resLast < cpu.valLast1) & 1;
	};
	hsh_getCF[ "ADC" ] = function ( cpu ) {
		return (cpu.resLast <= cpu.valLast1) & 1;
	};
	hsh_getCF[ "SUB" ] = hsh_getCF[ "CMP" ] = function ( cpu ) {
		return (cpu.valLast1 < cpu.valLast2) & 1;
	};
	hsh_getCF[ "SBB" ] = function ( cpu ) {
		$.assert(cpu.insnLast.sizeOperand < 4
			, "Needs to call .generateMask() if this ever occurs");
		var bitmask = (1 << (cpu.insnLast.sizeOperand * 8)) - 1;
		return ((cpu.valLast1 < cpu.resLast) || (cpu.valLast2 === bitmask)) & 1;
	};
	hsh_getCF[ "NEG" ] = function ( cpu ) {
		return (cpu.resLast != 0) & 1;
	};
	hsh_getCF[ "AND" ] = hsh_getCF[ "OR" ] = hsh_getCF[ "XOR" ]
	= hsh_getCF[ "NOT" ] = hsh_getCF[ "TEST" ]
	= hsh_getCF[ "DIV" ] = hsh_getCF[ "DEC" ]
	= function ( cpu ) {
		return 0;
	};
	
	// Auxiliary / BCD Adjustment Flag
	hsh_getAF[ "ADD" ] = hsh_getAF[ "MUL" ] = hsh_getAF[ "ADC" ]
	= hsh_getAF[ "SUB" ] = hsh_getAF[ "CMP" ] = hsh_getAF[ "SBB" ]
	= function ( cpu ) {
		return (((cpu.valLast1 ^ cpu.valLast2) ^ cpu.resLast) & 0x10);
	};
	hsh_getAF[ "NEG" ] = function ( cpu ) {
		return ((cpu.resLast & 0x0F) != 0) & 1;
	};
	hsh_getAF[ "INC" ] = function ( cpu ) {
		return ((cpu.resLast & 0x0F) === 0) & 1;
	};
	hsh_getAF[ "DEC" ] = function ( cpu ) {
		return ((cpu.resLast & 0x0F) === 0x0F) & 1;
	};
	hsh_getAF[ "AND" ] = hsh_getAF[ "OR" ] = hsh_getAF[ "XOR" ]
			= hsh_getAF[ "NOT" ] = hsh_getAF[ "TEST" ]
			= hsh_getAF[ "DIV" ] = function ( cpu ) {
		return 0;
	};
	
	// Overflow Flag
	hsh_getOF[ "ADD" ] = hsh_getOF[ "MUL" ] = hsh_getOF[ "ADC" ]
	= function ( cpu ) {
		$.assert(cpu.insnLast.sizeOperand < 4
			, "Needs to call .generateMask() if this ever occurs");
		var bitmask = (1 << (cpu.insnLast.sizeOperand * 8)) - 1;
		
		return (((~((cpu.valLast1) ^ (cpu.valLast2))
			& ((cpu.valLast2) ^ (cpu.resLast))) & (bitmask)) != 0) & 1;
	};
	hsh_getOF[ "SUB" ] = hsh_getOF[ "CMP" ] = hsh_getOF[ "SBB" ]
	= function ( cpu ) {
		$.assert(cpu.insnLast.sizeOperand < 4
			, "Needs to call .generateMask() if this ever occurs");
		var bitmask = (1 << (cpu.insnLast.sizeOperand * 8)) - 1;
		
		return (((((cpu.valLast1) ^ (cpu.valLast2))
			& ((cpu.valLast1) ^ (cpu.resLast))) & (bitmask)) != 0) & 1;
	};
	hsh_getOF[ "NEG" ] = hsh_getOF[ "INC" ] = function ( cpu ) {
		// eg. 80, 8000, 80000000
		var half = Math.pow(2, cpu.insnLast.sizeOperand * 8 - 1);
		return (cpu.resLast === half) & 1;
	};
	hsh_getOF[ "DEC" ] = function ( cpu ) {
		$.assert(cpu.insnLast.sizeOperand < 4
			, "Needs to call .generateMask() if this ever occurs");
		// eg. 7F, 7FFF, 7FFFFFFF
		var half = ((1 << (cpu.insnLast.sizeOperand * 8)) - 1) / 2;
		return (cpu.resLast === half) & 1;
	};
	hsh_getOF[ "AND" ] = hsh_getOF[ "OR" ] = hsh_getOF[ "XOR" ]
			= hsh_getOF[ "NOT" ] = hsh_getOF[ "TEST" ]
			= hsh_getOF[ "DIV" ] = function ( cpu ) {
		return 0;
	};
	/* =========== /Lazy Flags evaluation =========== */
	
	// Determine whether there are an odd or even number
	//	of set bits in number "num"
	function getParity( num ) {
		var res = 0;
		
		while ( num ) {
			++res;
			// Loop will execute once for each bit set in num
			num &= num - 1;
		}
		return (res % 2 === 0) & 1;
	}
	
	// Cache parity values up to 0xFF in lookup table
	//	( eg. mapParity[val & 0xFF] )
	var mapParity = {};
	for ( var num = 0 ; num <= 0xFF ; ++num ) {
		mapParity[ num ] = getParity(num);
	}
	
	/* ====== /Private ====== */
	
	// Exports
	x86Emu.LazyFlag = LazyFlag;
});
