/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: IBM-PC compatible Intel CPU support
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("cpu", function ( $ ) { "use strict";
	var jemul8 = this.data("jemul8");
	
	// Memory access types (read/write/execute/rw)
	var TYPE_READ		= 0
		, TYPE_WRITE	= 1
		, TYPE_EXECUTE	= 2
		, TYPE_RW		= 3;
	
	// x86 CPU class constructor
	function x86CPU( machine, name_class ) {
		this.machine = machine;
		
		// Class / type of CPU (eg. 386, 486, PIII, D)
		this.name_class = name_class;
		// Hash of CPU Registers, mapped by name
		this.hsh_reg = {};
		
		// Lookup hash for byte-size -> accumulator register
		//	(ie. 1 is AL, 2 is AX, 4 is EAX)
		this.accumulator = null;
		
		// Get lookup hash of execution handlers for CPU instructions
		//	(inside a closure, for speed & to keep code-size down)
		this.hsh_fn_insnExecute = this.getInstructions();
		
		this.hsh_regOrdinals_Byte = null;
		this.hsh_regOrdinals_Word = null;
		this.hsh_regOrdinals_Segment = null;
		this.hsh_regOrdinals_Segment_Mod00RM06 = null;
		this.hsh_regOrdinals_Segment_Mod01or10RM06 = null;
		this.hsh_regOrdinals_Base = null;
		this.hsh_regOrdinals_Index = null;
		
		// Instruction cache ( decoded Instructions are stored indexed
		//	by absolute memory address to avoid needing
		//	to redecode Instructions executed more than once
		//	( eg. in a loop or an OS scheduler ).
		this.cache_insn = [];
		
		// Accessors used for data memory (ie. non-code areas)
		//	- separate ones are used for reads & writes because otherwise
		//	the accessor could be denied access, eg. for CMOS BIOS,
		//	read access is allowed but not write, so TYPE_RW would fail
		//this.accessorRead = machine.mem.createAccessor(TYPE_READ);
		//this.accessorWrite = machine.mem.createAccessor(TYPE_WRITE);
		//this.accessorCode = machine.mem.createAccessor(TYPE_EXECUTE);
		
		this.isHalted = false;
		
		// Operands & result from last flag-affecting operation
		//	(used by the Bochs-derived Lazy Flags optimisation system)
		this.insnLast = null;
		this.valLast1 = 0;
		this.valLast2 = 0;
		this.resLast = 0;
	}
	x86CPU.prototype.install = function ( component ) {
		switch ( component.constructor ) {
		// Install a compatible Register onto the emulated CPU
		case jemul8.LazyFlagRegister:	// Fall through
		case jemul8.Register:
		case jemul8.SubRegister:
		case jemul8.SegRegister:
		// CPU pins, eg. #INTR for interrupts
		case jemul8.Pin:
			component.cpu = this;
			// Don't bother for unnamed components
			if ( component.name ) {
				// Hash used to get Register by its name
				this.hsh_reg[ component.name ] = component;
				// Shortcut to using hash for time-critical parts
				this[ component.name ] = component;
			}
			break;
		default:
			jemul8.problem("x86CPU.install :: Provided component cannot be"
				+ " installed into the CPU.");
		}
	};
	// Determine whether the emulated CPU is in a halted state or not
	x86CPU.prototype.halted = function () {
		return this.isHalted;
	};
	// Force emulated CPU into a halted state
	x86CPU.prototype.halt = function () {
		this.isHalted = true;
	};
	// Command emulated CPU to resume from CS:EIP
	x86CPU.prototype.resume = function () {
		this.isHalted = false;
	};
	// Hold emulated CPU #RESET pin and release
	x86CPU.prototype.reset = function () {
		// Enable maskable interrupts
		this.IF.set();
		
		// Set registers to initial state
		this.CS.set(0xF000);
		this.EIP.set(0x0000FFF0);
		// Clear all memory segment registers
		this.DS.set(0x0000); this.ES.set(0x0000);
		this.FS.set(0x0000); this.GS.set(0x0000);
		this.SS.set(0x0000);
		
		// Clear all general-purpose registers
		this.EAX.set(0x00000000); this.EBX.set(0x00000000);
		this.ECX.set(0x00000000); this.EDX.set(0x00000000);
		this.EBP.set(0x00000000); this.ESI.set(0x00000000);
		this.EDI.set(0x00000000); this.ESP.set(0x00000000);
		
		/*
		 *	- Real mode
		 *	- FPU disabled
		 *	- Do not emulate FPU
		 *	- Use DOS-compat. FPU error reporting (assert #FERR out)
		 *	- OS can write to read-only pages
		 *	- Alignment Check exception disabled
		 *	- Internal cache disabled
		 *	- Paging disabled
		 */
		this.CR0.set(0x60000010);
		/*
		 *	- Single-step disabled
		 *	- Recognition of external interrupts (on INTR) disabled
		 *	- String instructions auto-INCREMENT address
		 *	- IOPL = 0 ( no effect in Real Mode )
		 *	- Debug fault checking enabled after exec. of IRETD insn.
		 *	- Virtual 8086 mode disabled
		 *	- Alignment Checking disabled
		 */
		this.EFLAGS.set(0x00000002);
		// Page Fault Linear Address of 00000000h.
		//	No effect in Real Mode ( paging disabled )
		this.CR2.set(0x00000000);
		// Contains Page Directory start address of 00000000h,
		//	page directory caching set to enabled and write-back.
		//	No effect ( because paging disabled )
		this.CR3.set(0x00000000);
		// Processor extensions disabled.
		//	No effect in real mode.
		this.CR4.set(0x00000000);
		
		/* ==== Debug ==== */
		// Disable breakpoint recognition.
		this.DR7.set(0x00000400);
		/* ==== /Debug ==== */
		
		// Interrupt Descriptor table is at offset 00000000h
		//	and has a limit of 03FFh.
		this.IDTR.set(0x0000000003FF);
	};
	// For reinterpreting a number as signed / "sign-extending" a number
	x86CPU.prototype.signExtend = function ( num, length, lengthTo ) {
		var numBits = length * 8, numBitsTo = lengthTo * 8;
		// Sign bit set
		if ( num >> (numBits - 1) ) {
			// TODO: Convert "<<" to Math.pow() or multiply? May overflow
			//	the JavaScript 32-bit limit...
			return num | ((Math.pow(2, numBitsTo - numBits) - 1) << numBits);
		} else {
			return num;
		}
	};
	x86CPU.prototype.mask = function ( num, mask ) {debugger;
		if ( num < 0xFFFFFFFF ) {
			return num & mask;
		} else {
			return num % (mask + 1);
		}
	};
	
	// For debugging purposes with Firebug
	x86CPU.prototype.getState = function () {
		/* ==== Malloc ==== */
		var textEFlags;
		/* ==== /Malloc ==== */
		
		/* ====== Build DEBUG.COM-like Flags state text ====== */
		textEFlags = (this.OF.get() ? "OV/1 " : "NV/0 ")
					+ (this.DF.get() ? "DN/1 " : "UP/0 ")
					+ (this.IF.get() ? "EI/1 " : "DI/0 ")
					+ (this.SF.get() ? "NG/1 " : "PL/0 ")
					+ (this.ZF.get() ? "ZR/1 " : "NZ/0 ")
					+ (this.AF.get() ? "AC/1 " : "NA/0 ")
					+ (this.PF.get() ? "PE/1 " : "PO/0 ")
					+ (this.CF.get() ? "CY/1" : "NC/0");
		/* ====== /Build DEBUG.COM-like Flags state text ====== */
		
		// Numbers used to ensure correct order
		return {
				"1 :: EAX": this.EAX.getHexString()
				, "2 :: EBX": this.EBX.getHexString()
				, "3 :: ECX": this.ECX.getHexString()
				, "4 :: EDX": this.EDX.getHexString()
				, "5 :: ESP": this.ESP.getHexString()
				, "6 :: EBP": this.EBP.getHexString()
				, "7 :: ESI": this.ESI.getHexString()
				, "8 :: EDI": this.EDI.getHexString()
				, "9 :: DS": this.DS.getHexString()
				, "10 :: ES": this.ES.getHexString()
				, "11 :: SS": this.SS.getHexString()
				, "12 :: CS": this.CS.getHexString()
				, "13 :: EIP": this.EIP.getHexString()
				, "14 :: EFLAGS": textEFlags
			};
	};
	
	// Exports
	jemul8.x86CPU = x86CPU;
});
