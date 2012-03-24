/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: IBM-PC compatible Intel CPU support
 */

// Augment jQuery plugin
new jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("emulator", function ( $ ) {
	var jemul8 = this.data("jemul8");
	
	/* ============ Import system after setup ============ */
	var machine, CPU, DRAM;
	this.RegisterDeferredLoader( function ( machine_, CPU_, DRAM_ ) {
		machine = machine_; CPU = CPU_; DRAM = DRAM_;
	});
	/* ============ /Import system after setup ============ */
	
	// x86 CPU class constructor
	function x86CPU( name_class ) {
		// Class / type of CPU ( eg. 386, 486, PIII, D )
		this.name_class = name_class;
		// Hash of CPU Registers, mapped by name
		this.hsh_reg = {};
		// Instruction cache ( decoded Instructions are stored indexed by absolute memory address
		//	to avoid needing to redecode Instructions executed more than once ( eg. in a loop or an OS scheduler ).
		this.arr_insnCache = [];
		
		this.isHalted = false;
		
		// Is there a Non-Maskable Interrupt pending?
		this.isNMIPending = false;
		
		/* ====== Operands & result from last flag-affecting operation ====== */
		this.valLast1 = 0;
		this.valLast2 = 0;
		this.resLast = 0;
		/* ====== /Operands & result from last flag-affecting operation ====== */
	}
	x86CPU.prototype.InstallComponent = function ( component ) {
		switch ( component.constructor ) {
		// Install a compatible Register onto the emulated CPU
		case jemul8.Register:	// Fall through
		case jemul8.SubRegister:
		case jemul8.LazyFlagRegister:
			// Hash used to get Register by its name
			this.hsh_reg[ component.getName() ] = component;
			// Shortcut to using hash for time-critical parts
			this[ component.getName() ] = component;
			break;
		// CPU pins, eg. #INTR for interrupts
		case jemul8.Pin:
			// Shortcut to using hash for time-critical parts
			this[ component.getName() ] = component;
			break;
		default:
			throw new Error( "x86CPU.InstallComponent :: Provided component cannot be installed into the CPU." );
		}
	};
	// Determine whether the emulated CPU is in a halted state or not
	x86CPU.prototype.IsHalted = function () {
		return this.isHalted;
	};
	// Force emulated CPU into a halted state
	x86CPU.prototype.Halt = function () {
		this.isHalted = true;
	};
	// Force emulated CPU to resume from CS:EIP
	x86CPU.prototype.Resume = function () {
		this.isHalted = false;
	};
	// Hold emulated CPU #RESET pin and release
	x86CPU.prototype.Reset = function () {
		// Enable Interrupts
		this.IF.set();
		
		// Set registers to initial state
		this.CS.set(0xF000);
		this.EIP.set(0x0000FFF0);
		// Clear all memory segment registers
		this.DS.set(0x0000); this.ES.set(0x0000); this.FS.set(0x0000); this.GS.set(0x0000);
		this.SS.set(0x0000);
		
		// Clear all general-purpose registers
		this.EAX.set(0x00000000); this.EBX.set(0x00000000); this.ECX.set(0x00000000); this.EDX.set(0x00000000);
		this.EBP.set(0x00000000); this.ESI.set(0x00000000); this.EDI.set(0x00000000); this.ESP.set(0x00000000);
		
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
		
		// Interrupt Descriptor table is at offset 00000000h and has a limit of 03FFh.
		this.IDTR.set(0x0000000003FF);
		
		// Ready BIOS for booting ( copy into DRAM, CS:EIP will point there )
		//	TODO: Move this to a more suitable location/routine?
		machine.BIOS.Prepare();
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
	
	/* ==== Exports ==== */
	jemul8.x86CPU = x86CPU;
	/* ==== /Exports ==== */
});

// Add Module to emulator
jemul8.AddModule(mod);