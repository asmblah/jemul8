/*
 *	jsEmu - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: CPU Instruction class support
 */
var mod = new jsEmu.PrimaryModule( function ( jsEmu ) {
	
	// Install all standard x86 Registers onto the CPU
	jsEmu.x86CPU.prototype.InstallStandardRegisters = function () {
		/* ==== Malloc ==== */
		var Register = jsEmu.Register;
		var SubRegister = jsEmu.SubRegister;
		var BitFlag = jsEmu.BitFlag;
		/* ==== /Malloc ==== */
		
		// Accumulator
		this.InstallComponent(new Register( "EAX", 4 ));
		this.InstallComponent(new SubRegister( "AX", 2, this.EAX, 0xFFFF, 0 ));
		this.InstallComponent(new SubRegister( "AH", 1, this.EAX, 0xFF, 1 ));
		this.InstallComponent(new SubRegister( "AL", 1, this.EAX, 0xFF, 0 ));
		// Base
		this.InstallComponent(new Register( "EBX", 4 ));
		this.InstallComponent(new SubRegister( "BX", 2, this.EBX, 0xFFFF, 0 ));
		this.InstallComponent(new SubRegister( "BH", 1, this.EBX, 0xFF, 1 ));
		this.InstallComponent(new SubRegister( "BL", 1, this.EBX, 0xFF, 0 ));
		// Counter
		this.InstallComponent(new Register( "ECX", 4 ));
		this.InstallComponent(new SubRegister( "CX", 2, this.ECX, 0xFFFF, 0 ));
		this.InstallComponent(new SubRegister( "CH", 1, this.ECX, 0xFF, 1 ));
		this.InstallComponent(new SubRegister( "CL", 1, this.ECX, 0xFF, 0 ));
		// Data
		this.InstallComponent(new Register( "EDX", 4 ));
		this.InstallComponent(new SubRegister( "DX", 2, this.EDX, 0xFFFF, 0 ));
		this.InstallComponent(new SubRegister( "DH", 1, this.EDX, 0xFF, 1 ));
		this.InstallComponent(new SubRegister( "DL", 1, this.EDX, 0xFF, 0 ));
		// Base pointer
		this.InstallComponent(new Register( "EBP", 4 ));
		this.InstallComponent(new SubRegister( "BP", 2, this.EBP, 0xFFFF, 0 ));
		// Dest. index
		this.InstallComponent(new Register( "EDI", 4 ));
		this.InstallComponent(new SubRegister( "DI", 2, this.EDI, 0xFFFF, 0 ));
		// Source index
		this.InstallComponent(new Register( "ESI", 4 ));
		this.InstallComponent(new SubRegister( "SI", 2, this.ESI, 0xFFFF, 0 ));
		// Stack pointer
		this.InstallComponent(new Register( "ESP", 4 ));
		this.InstallComponent(new SubRegister( "SP", 2, this.ESP, 0xFFFF, 0 ));
		
		// Instruction Pointer
		this.InstallComponent(new Register( "EIP", 4 ));
		this.InstallComponent(new SubRegister( "IP", 2, this.EIP, 0xFFFF, 0 ));
		
		// Code segment
		this.InstallComponent(new Register( "CS", 2 ));
		// Data segment
		this.InstallComponent(new Register( "DS", 2 ));
		// Extra segment
		this.InstallComponent(new Register( "ES", 2 ));
		// "FS" segment
		this.InstallComponent(new Register( "FS", 2 ));
		// "GS" segment
		this.InstallComponent(new Register( "GS", 2 ));
		// Stack segment
		this.InstallComponent(new Register( "SS", 2 ));
		
		// EFlags ( 32-bit ) register
		this.InstallComponent(new Register( "EFLAGS", 2 ));
		// Flags ( 16-bit ) register
		this.InstallComponent(new SubRegister( "FLAGS", 2, this.EFLAGS, 0xFFFF, 0 ));
		// Carry Flag
		this.CF = this.hsh_reg["CF"] = new BitFlag( "CF", this.EFLAGS, 0 );
		// Unknown(1) Flag
		this.UF1 = this.hsh_reg["UF1"] = new BitFlag( "UF1", this.EFLAGS, 1 );
		// Parity Flag
		this.PF = this.hsh_reg["PF"] = new BitFlag( "PF", this.EFLAGS, 2 );
		// Unknown(2) Flag
		this.UF2 = this.hsh_reg["UF2"] = new BitFlag( "UF2", this.EFLAGS, 3 );
		// Auxiliary Flag
		this.AF = this.hsh_reg["AF"] = new BitFlag( "AF", this.EFLAGS, 4 );
		// Unknown(3) Flag
		this.UF3 = this.hsh_reg["UF3"] = new BitFlag( "UF3", this.EFLAGS, 5 );
		// Zero Flag
		this.ZF = this.hsh_reg["ZF"] = new BitFlag( "ZF", this.EFLAGS, 6 );
		// Sign Flag
		this.SF = this.hsh_reg["SF"] = new BitFlag( "SF", this.EFLAGS, 7 );
		// Trap Flag ( Single Step )
		this.TF = this.hsh_reg["TF"] = new BitFlag( "TF", this.EFLAGS, 8 );
		// Interrupt Flag
		this.IF = this.hsh_reg["IF"] = new BitFlag( "IF", this.EFLAGS, 9 );
		// Direction Flag
		this.DF = this.hsh_reg["DF"] = new BitFlag( "DF", this.EFLAGS, 10 );
		// Overflow Flag
		this.OF = this.hsh_reg["OF"] = new BitFlag( "OF", this.EFLAGS, 11 );
		// IOPL ( I/O Privilege Level ) Flag - Intel 286+ only
		this.IOPL = this.hsh_reg["IOPL"] = new BitFlag( "IOPL", this.EFLAGS, 12 );
		this.IOPL2 = this.hsh_reg["IOPL2"] = new BitFlag( "IOPL2", this.EFLAGS, 13 );
		// NT ( Nested Task ) Flag - Intel 286+ only
		this.NT = this.hsh_reg["NT"] = new BitFlag( "NT", this.EFLAGS, 14 );
		// Unknown(4) Flag
		this.UF4 = this.hsh_reg["UF4"] = new BitFlag( "UF4", this.EFLAGS, 15 );
		// Resume Flag
		this.RF = this.hsh_reg["RF"] = new BitFlag( "RF", this.EFLAGS, 16 );
		// Virtual-8086 Mode Flag
		this.VM = this.hsh_reg["VM"] = new BitFlag( "VM", this.EFLAGS, 17 );
		// Alignment-Check ( 486SX+ only )
		this.AC = this.hsh_reg["AC"] = new BitFlag( "AC", this.EFLAGS, 18 );
		// Virtual Interrupt Flag ( Pentium+ )
		this.VIF = this.hsh_reg["VIF"] = new BitFlag( "VIF", this.EFLAGS, 19 );
		// Virtual Interrupt Pending Flag ( Pentium+ )
		this.VIP = this.hsh_reg["VIP"] = new BitFlag( "VIP", this.EFLAGS, 20 );
		// Identification Flag ( Pentium+ )
		this.ID = this.hsh_reg["ID"] = new BitFlag( "ID", this.EFLAGS, 21 );
		
		// Control Register 0
		this.InstallComponent(new Register( "CR0", 4 ));
		// Protected Mode Enable
		//	( If 1, system is in Protected Mode, else system is in Real Mode )
		this.PE = this.hsh_reg["PE"] = new BitFlag( "PE", this.CR0, 0 );
		// Monitor co-Processor
		//	( Controls interaction of WAIT/FWAIT Instructions with TS Flag in CR0 )
		this.MP = this.hsh_reg["MP"] = new BitFlag( "MP", this.CR0, 1 );
		// Emulation
		this.EM = this.hsh_reg["EM"] = new BitFlag( "EM", this.CR0, 2 );
		// Task Switched
		this.TS = this.hsh_reg["TS"] = new BitFlag( "TS", this.CR0, 3 );
		// Extension Type
		this.ET = this.hsh_reg["ET"] = new BitFlag( "ET", this.CR0, 4 );
		// Numeric Error
		//	( Enable internal x87 floating point error reporting when set, else enables PC style x87 error detection )
		this.NE = this.hsh_reg["NE"] = new BitFlag( "NE", this.CR0, 5 );
		/**** Gap ****/
		// Write Protect
		this.WP = this.hsh_reg["WP"] = new BitFlag( "WP", this.CR0, 16 );
		/**** Gap ****/
		// Alignment Mask
		this.AM = this.hsh_reg["AM"] = new BitFlag( "AM", this.CR0, 18 );
		/**** Gap ****/
		// Not-write through
		this.NW = this.hsh_reg["NW"] = new BitFlag( "NW", this.CR0, 29 );
		// Cache Disable
		this.CD = this.hsh_reg["CD"] = new BitFlag( "CD", this.CR0, 30 );
		// Paging - ( If 1, enable paging & use CR3, else disable paging )
		this.PG = this.hsh_reg["PG"] = new BitFlag( "PG", this.CR0, 31 );
		
		// Control Register 1 ( Reserved )
		this.InstallComponent(new Register( "CR1", 4 ));
		// Control Register 2 ( PFLA - Page Fault Linear Address )
		this.InstallComponent(new Register( "CR2", 4 ));
		// Control Register 3 ( Virtual addresses -> Physical addresses )
		this.InstallComponent(new Register( "CR3", 4 ));
		// Control Register 4
		this.InstallComponent(new Register( "CR4", 4 ));
		
		// Debug Register 0
		this.InstallComponent(new Register( "DR0", 4 ));
		// Debug Register 1
		this.InstallComponent(new Register( "DR1", 4 ));
		// Debug Register 2
		this.InstallComponent(new Register( "DR2", 4 ));
		// Debug Register 3
		this.InstallComponent(new Register( "DR3", 4 ));
		// Debug Register 4
		this.InstallComponent(new Register( "DR4", 4 ));
		// Debug Register 5
		this.InstallComponent(new Register( "DR5", 4 ));
		// Debug Register 6
		this.InstallComponent(new Register( "DR6", 4 ));
		// Debug Register 7
		this.InstallComponent(new Register( "DR7", 4 ));
		
		/* ======= Test Registers ======= */
		//	NB: Removed in newer CPUs & only numbered from 4 -> 7
		// Debug Register 4
		this.InstallComponent(new Register( "TR4", 4 ));
		// Debug Register 5
		this.InstallComponent(new Register( "TR5", 4 ));
		// Debug Register 6
		this.InstallComponent(new Register( "TR6", 4 ));
		// Debug Register 7
		this.InstallComponent(new Register( "TR7", 4 ));
		/* ======= /Test Registers ======= */
		
		/* ===== Default States for Boot ===== */
		// Enable Interrupts Flag
		this.IF.Set();
		/* ===== /Default States for Boot ===== */
	};
	
	/* ==== Exports ==== */
	
	/* ==== /Exports ==== */
});

// Add Module to emulator
jsEmu.AddModule(mod);