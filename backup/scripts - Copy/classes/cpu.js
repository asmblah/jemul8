/*
 *	jsEmu - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: IBM-PC compatible Intel CPU support
 */
var mod = new jsEmu.PrimaryModule( function ( jsEmu ) {
	/* ============ Import system after setup ============ */
	var machine, motherboard, CPU, FlashBIOSChip, BIOS, DRAM;
	this.RegisterDeferredLoader( function ( machine_, motherboard_, CPU_, FlashBIOSChip_, BIOS_, DRAM_ ) {
			machine = machine_; motherboard = motherboard_; CPU = CPU_; FlashBIOSChip = FlashBIOSChip_; BIOS = BIOS_; DRAM = DRAM_;
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
		
		/* ====== Operands & result from last flag-affecting operation ====== */
		this.valLast1 = 0;
		this.valLast2 = 0;
		this.resLast = 0;
		/* ====== /Operands & result from last flag-affecting operation ====== */
	}
	x86CPU.prototype.InstallComponent = function ( component ) {
		switch ( component.constructor ) {
		// Install a compatible Register onto the emulated CPU
		case jsEmu.Register:	// Fall through
		case jsEmu.SubRegister:
		case jsEmu.LazyFlagRegister:
			// Hash used to get Register by its name
			this.hsh_reg[ component.GetName() ] = component;
			// Shortcut to using hash for time-critical parts
			this[ component.GetName() ] = component;
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
		this.IF.Set();
		
		// Set registers to initial state
		this.CS.Set(0xF000);
		this.EIP.Set(0x0000FFF0);
		// Clear all memory segment registers
		this.DS.Set(0x0000); this.ES.Set(0x0000); this.FS.Set(0x0000); this.GS.Set(0x0000);
		this.SS.Set(0x0000);
		
		// Clear all general-purpose registers
		this.EAX.Set(0x00000000); this.EBX.Set(0x00000000); this.ECX.Set(0x00000000); this.EDX.Set(0x00000000);
		this.EBP.Set(0x00000000); this.ESI.Set(0x00000000); this.EDI.Set(0x00000000); this.ESP.Set(0x00000000);
		
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
		this.CR0.Set(0x60000010);
		/*
		 *	- Single-step disabled
		 *	- Recognition of external interrupts (on INTR) disabled
		 *	- String instructions auto-INCREMENT address
		 *	- IOPL = 0 ( no effect in Real Mode )
		 *	- Debug fault checking enabled after exec. of IRETD insn.
		 *	- Virtual 8086 mode disabled
		 *	- Alignment Checking disabled
		 */
		this.EFLAGS.Set(0x00000002);
		// Page Fault Linear Address of 00000000h.
		//	No effect in Real Mode ( paging disabled )
		this.CR2.Set(0x00000000);
		// Contains Page Directory start address of 00000000h,
		//	page directory caching set to enabled and write-back.
		//	No effect ( because paging disabled )
		this.CR3.Set(0x00000000);
		// Processor extensions disabled.
		//	No effect in real mode.
		this.CR4.Set(0x00000000);
		
		/* ==== Debug ==== */
		// Disable breakpoint recognition.
		this.DR7.Set(0x00000400);
		/* ==== /Debug ==== */
		
		// Interrupt Descriptor table is at offset 00000000h and has a limit of 03FFh.
		this.IDTR.Set(0x0000000003FF);
		
		// Ready BIOS for booting ( copy into DRAM, CS:EIP will point there )
		BIOS.Prepare();
	};
	
	// For debugging purposes with Firebug
	x86CPU.prototype.GetState = function () {
		/* ==== Malloc ==== */
		var textEFlags;
		/* ==== /Malloc ==== */
		
		/* ====== Build DEBUG.COM-like Flags state text ====== */
		textEFlags = (this.OF.Get() ? "OV/1 " : "NV/0 ")
					+ (this.DF.Get() ? "DN/1 " : "UP/0 ")
					+ (this.IF.Get() ? "EI/1 " : "DI/0 ")
					+ (this.SF.Get() ? "NG/1 " : "PL/0 ")
					+ (this.ZF.Get() ? "ZR/1 " : "NZ/0 ")
					+ (this.AF.Get() ? "AC/1 " : "NA/0 ")
					+ (this.PF.Get() ? "PE/1 " : "PO/0 ")
					+ (this.CF.Get() ? "CY/1" : "NC/0");
		/* ====== /Build DEBUG.COM-like Flags state text ====== */
		
		// Numbers used to ensure correct order
		return {
				"1 :: EAX": this.EAX.GetHexString()
				, "2 :: EBX": this.EBX.GetHexString()
				, "3 :: ECX": this.ECX.GetHexString()
				, "4 :: EDX": this.EDX.GetHexString()
				, "5 :: ESP": this.ESP.GetHexString()
				, "6 :: EBP": this.EBP.GetHexString()
				, "7 :: ESI": this.ESI.GetHexString()
				, "8 :: EDI": this.EDI.GetHexString()
				, "9 :: DS": this.DS.GetHexString()
				, "10 :: ES": this.ES.GetHexString()
				, "11 :: SS": this.SS.GetHexString()
				, "12 :: CS": this.CS.GetHexString()
				, "13 :: EIP": this.EIP.GetHexString()
				, "14 :: EFLAGS": textEFlags
			};
	};
	
	/* ==== Exports ==== */
	jsEmu.x86CPU = x86CPU;
	/* ==== /Exports ==== */
});

// Add Module to emulator
jsEmu.AddModule(mod);