/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: CPU Instruction class support
 */

// Augment jQuery plugin
new jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("emulator", function ( $ ) {
	var jemul8 = this.data("jemul8");
	
	// Install all standard x86 Registers onto the CPU
	jemul8.x86CPU.prototype.InstallStandardRegisters = function () {
		/* ==== Malloc ==== */
		var Register = jemul8.Register;
		var LazyFlagRegister = jemul8.LazyFlagRegister;
		var SubRegister = jemul8.SubRegister;
		var BitFlag = jemul8.BitFlag;
		var LazyFlag = jemul8.LazyFlag;
		var UnlazyFlag = jemul8.UnlazyFlag;
		var Pin = jemul8.Pin;
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
		this.InstallComponent(new LazyFlagRegister( "EFLAGS", 4 ));
		// Flags ( 16-bit ) register
		this.InstallComponent(new SubRegister( "FLAGS", 2, this.EFLAGS, 0xFFFF, 0 ));
		// Carry Flag
		this.CF = this.hsh_reg["CF"] = new LazyFlag( "CF", this.EFLAGS, 0 );
		/* ==== Gap ==== */
		new UnlazyFlag( null, this.EFLAGS, 1 );
		/* ==== /Gap ==== */
		// Parity Flag
		this.PF = this.hsh_reg["PF"] = new LazyFlag( "PF", this.EFLAGS, 2 );
		/* ==== Gap ==== */
		new UnlazyFlag( null, this.EFLAGS, 3 );
		/* ==== /Gap ==== */
		// Auxiliary Flag
		this.AF = this.hsh_reg["AF"] = new LazyFlag( "AF", this.EFLAGS, 4 );
		/* ==== Gap ==== */
		new UnlazyFlag( null, this.EFLAGS, 5 );
		/* ==== /Gap ==== */
		// Zero Flag
		this.ZF = this.hsh_reg["ZF"] = new LazyFlag( "ZF", this.EFLAGS, 6 );
		// Sign Flag
		this.SF = this.hsh_reg["SF"] = new LazyFlag( "SF", this.EFLAGS, 7 );
		// Trap Flag ( Single Step )
		this.TF = this.hsh_reg["TF"] = new UnlazyFlag( "TF", this.EFLAGS, 8 );
		// Interrupt Flag
		this.IF = this.hsh_reg["IF"] = new UnlazyFlag( "IF", this.EFLAGS, 9 );
		// Direction Flag
		this.DF = this.hsh_reg["DF"] = new UnlazyFlag( "DF", this.EFLAGS, 10 );
		// Overflow Flag
		this.OF = this.hsh_reg["OF"] = new LazyFlag( "OF", this.EFLAGS, 11 );
		// IOPL ( I/O Privilege Level ) Flag - Intel 286+ only
		//	NB: this is a 2-bit value (privilege level - eg. level 0 is OS), not a flag
		this.IOPL = this.hsh_reg["IOPL"] = new UnlazyFlag( "IOPL", this.EFLAGS, 12 );
		this.IOPL2 = this.hsh_reg["IOPL2"] = new UnlazyFlag( "IOPL2", this.EFLAGS, 13 );
		// NT ( Nested Task ) Flag - Intel 286+ only
		this.NT = this.hsh_reg["NT"] = new UnlazyFlag( "NT", this.EFLAGS, 14 );
		/* ==== Gap ==== */
		new UnlazyFlag( null, this.EFLAGS, 15 );
		/* ==== /Gap ==== */
		// Resume Flag
		this.RF = this.hsh_reg["RF"] = new UnlazyFlag( "RF", this.EFLAGS, 16 );
		// Virtual-8086 Mode Flag
		this.VM = this.hsh_reg["VM"] = new UnlazyFlag( "VM", this.EFLAGS, 17 );
		// Alignment-Check ( 486SX+ only )
		this.AC = this.hsh_reg["AC"] = new UnlazyFlag( "AC", this.EFLAGS, 18 );
		// Virtual Interrupt Flag ( Pentium+ )
		this.VIF = this.hsh_reg["VIF"] = new UnlazyFlag( "VIF", this.EFLAGS, 19 );
		// Virtual Interrupt Pending Flag ( Pentium+ )
		this.VIP = this.hsh_reg["VIP"] = new UnlazyFlag( "VIP", this.EFLAGS, 20 );
		// Identification Flag ( Pentium+ )
		this.ID = this.hsh_reg["ID"] = new UnlazyFlag( "ID", this.EFLAGS, 21 );
		/* ==== Gap ==== */
		new UnlazyFlag( null, this.EFLAGS, 22 );
		new UnlazyFlag( null, this.EFLAGS, 23 );
		new UnlazyFlag( null, this.EFLAGS, 24 );
		new UnlazyFlag( null, this.EFLAGS, 25 );
		new UnlazyFlag( null, this.EFLAGS, 26 );
		new UnlazyFlag( null, this.EFLAGS, 27 );
		new UnlazyFlag( null, this.EFLAGS, 28 );
		new UnlazyFlag( null, this.EFLAGS, 29 );
		new UnlazyFlag( null, this.EFLAGS, 30 );
		new UnlazyFlag( null, this.EFLAGS, 31 );
		/* ==== /Gap ==== */
		
		// Control Register 0
		this.InstallComponent(new LazyFlagRegister( "CR0", 4 ));
		// Protected Mode Enable
		//	( If 1, system is in Protected Mode, else system is in Real Mode )
		this.PE = this.hsh_reg["PE"] = new UnlazyFlag( "PE", this.CR0, 0 );
		// Monitor co-Processor
		//	( Controls interaction of WAIT/FWAIT Instructions with TS Flag in CR0 )
		this.MP = this.hsh_reg["MP"] = new UnlazyFlag( "MP", this.CR0, 1 );
		// Emulation
		this.EM = this.hsh_reg["EM"] = new UnlazyFlag( "EM", this.CR0, 2 );
		// Task Switched
		this.TS = this.hsh_reg["TS"] = new UnlazyFlag( "TS", this.CR0, 3 );
		// Extension Type
		this.ET = this.hsh_reg["ET"] = new UnlazyFlag( "ET", this.CR0, 4 );
		// Numeric Error
		//	( Enable internal x87 floating point error reporting when set, else enables PC style x87 error detection )
		this.NE = this.hsh_reg["NE"] = new UnlazyFlag( "NE", this.CR0, 5 );
		/* ==== Gap ==== */
		new UnlazyFlag( null, this.CR0, 6 );
		new UnlazyFlag( null, this.CR0, 7 );
		new UnlazyFlag( null, this.CR0, 8 );
		new UnlazyFlag( null, this.CR0, 9 );
		new UnlazyFlag( null, this.CR0, 10 );
		new UnlazyFlag( null, this.CR0, 11 );
		new UnlazyFlag( null, this.CR0, 12 );
		new UnlazyFlag( null, this.CR0, 13 );
		new UnlazyFlag( null, this.CR0, 14 );
		new UnlazyFlag( null, this.CR0, 15 );
		/* ==== /Gap ==== */
		// Write Protect
		this.WP = this.hsh_reg["WP"] = new UnlazyFlag( "WP", this.CR0, 16 );
		/* ==== Gap ==== */
		new UnlazyFlag( null, this.CR0, 17 );
		/* ==== /Gap ==== */
		// Alignment Mask
		this.AM = this.hsh_reg["AM"] = new UnlazyFlag( "AM", this.CR0, 18 );
		/* ==== Gap ==== */
		new UnlazyFlag( null, this.CR0, 19 );
		new UnlazyFlag( null, this.CR0, 20 );
		new UnlazyFlag( null, this.CR0, 21 );
		new UnlazyFlag( null, this.CR0, 22 );
		new UnlazyFlag( null, this.CR0, 23 );
		new UnlazyFlag( null, this.CR0, 24 );
		new UnlazyFlag( null, this.CR0, 25 );
		new UnlazyFlag( null, this.CR0, 26 );
		new UnlazyFlag( null, this.CR0, 27 );
		new UnlazyFlag( null, this.CR0, 28 );
		/* ==== /Gap ==== */
		// Not-write through
		this.NW = this.hsh_reg["NW"] = new UnlazyFlag( "NW", this.CR0, 29 );
		// Cache Disable
		this.CD = this.hsh_reg["CD"] = new UnlazyFlag( "CD", this.CR0, 30 );
		// Paging - ( If 1, enable paging & use CR3, else disable paging )
		this.PG = this.hsh_reg["PG"] = new UnlazyFlag( "PG", this.CR0, 31 );
		
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
		
		/* ======== Interrupts ======== */
		// Interrupt pin #INTR
		this.InstallComponent(new Pin( "INTR" ));
		// Interrupt Descriptor Table info register
		this.InstallComponent(new Register( "IDTR", 6 ));
		/* ======== /Interrupts ======== */
	};
	
	function Pin( name ) {
		this.name = name;
		this.val = 0;
	}
	Pin.prototype.getName = function () {
		return this.name;
	};
	Pin.prototype.Raise = function () {
		this.val = 1;
	};
	Pin.prototype.Lower = function () {
		this.val = 0;
	};
	Pin.prototype.set = function ( val ) {
		this.val = val;
	};
	Pin.prototype.IsHigh = function () {
		return this.val === 1;
	};
	
	/* ==== Exports ==== */
	jemul8.Pin = Pin;
	/* ==== /Exports ==== */
});

// Add Module to emulator
jemul8.AddModule(mod);