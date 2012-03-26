/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: CPU Instruction class support
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("std_registers", function ( $ ) {
	var x86Emu = this.data("x86Emu");
	
	// Install all standard x86 Registers onto the CPU
	x86Emu.x86CPU.prototype.installStdRegisters = function () {
		var Register = x86Emu.Register;
			, LazyFlagRegister = x86Emu.LazyFlagRegister
			, SubRegister = x86Emu.SubRegister
			, BitFlag = x86Emu.BitFlag
			, LazyFlag = x86Emu.LazyFlag
			, UnlazyFlag = x86Emu.UnlazyFlag
			, Pin = x86Emu.Pin;
		
		// Accumulator
		this.install(new Register( "EAX", 4 ));
		this.install(new SubRegister( "AX", 2, this.EAX, 0xFFFF, 0 ));
		this.install(new SubRegister( "AH", 1, this.EAX, 0xFF, 1 ));
		this.install(new SubRegister( "AL", 1, this.EAX, 0xFF, 0 ));
		// Base
		this.install(new Register( "EBX", 4 ));
		this.install(new SubRegister( "BX", 2, this.EBX, 0xFFFF, 0 ));
		this.install(new SubRegister( "BH", 1, this.EBX, 0xFF, 1 ));
		this.install(new SubRegister( "BL", 1, this.EBX, 0xFF, 0 ));
		// Counter
		this.install(new Register( "ECX", 4 ));
		this.install(new SubRegister( "CX", 2, this.ECX, 0xFFFF, 0 ));
		this.install(new SubRegister( "CH", 1, this.ECX, 0xFF, 1 ));
		this.install(new SubRegister( "CL", 1, this.ECX, 0xFF, 0 ));
		// Data
		this.install(new Register( "EDX", 4 ));
		this.install(new SubRegister( "DX", 2, this.EDX, 0xFFFF, 0 ));
		this.install(new SubRegister( "DH", 1, this.EDX, 0xFF, 1 ));
		this.install(new SubRegister( "DL", 1, this.EDX, 0xFF, 0 ));
		// Base pointer
		this.install(new Register( "EBP", 4 ));
		this.install(new SubRegister( "BP", 2, this.EBP, 0xFFFF, 0 ));
		// Dest. index
		this.install(new Register( "EDI", 4 ));
		this.install(new SubRegister( "DI", 2, this.EDI, 0xFFFF, 0 ));
		// Source index
		this.install(new Register( "ESI", 4 ));
		this.install(new SubRegister( "SI", 2, this.ESI, 0xFFFF, 0 ));
		// Stack pointer
		this.install(new Register( "ESP", 4 ));
		this.install(new SubRegister( "SP", 2, this.ESP, 0xFFFF, 0 ));
		
		// Instruction Pointer
		this.install(new Register( "EIP", 4 ));
		this.install(new SubRegister( "IP", 2, this.EIP, 0xFFFF, 0 ));
		
		// Code segment
		this.install(new Register( "CS", 2 ));
		// Data segment
		this.install(new Register( "DS", 2 ));
		// Extra segment
		this.install(new Register( "ES", 2 ));
		// "FS" segment
		this.install(new Register( "FS", 2 ));
		// "GS" segment
		this.install(new Register( "GS", 2 ));
		// Stack segment
		this.install(new Register( "SS", 2 ));
		
		// EFlags ( 32-bit ) register
		this.install(new LazyFlagRegister( "EFLAGS", 4 ));
		// Flags ( 16-bit ) register
		this.install(new SubRegister( "FLAGS", 2, this.EFLAGS, 0xFFFF, 0 ));
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
		this.install(new LazyFlagRegister( "CR0", 4 ));
		// Protected Mode Enable
		//	( If 1, system is in Protected Mode, else system is in Real Mode )
		this.PE = this.hsh_reg["PE"] = new UnlazyFlag( "PE", this.CR0, 0 );
		// Monitor co-Processor
		//	( Controls interaction of WAIT/FWAIT Instructions
		//	with TS Flag in CR0 )
		this.MP = this.hsh_reg["MP"] = new UnlazyFlag( "MP", this.CR0, 1 );
		// Emulation
		this.EM = this.hsh_reg["EM"] = new UnlazyFlag( "EM", this.CR0, 2 );
		// Task Switched
		this.TS = this.hsh_reg["TS"] = new UnlazyFlag( "TS", this.CR0, 3 );
		// Extension Type
		this.ET = this.hsh_reg["ET"] = new UnlazyFlag( "ET", this.CR0, 4 );
		// Numeric Error
		//	( Enable internal x87 floating point error reporting when set,
		//	else enables PC style x87 error detection )
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
		this.install(new Register( "CR1", 4 ));
		// Control Register 2 ( PFLA - Page Fault Linear Address )
		this.install(new Register( "CR2", 4 ));
		// Control Register 3 ( Virtual addresses -> Physical addresses )
		this.install(new Register( "CR3", 4 ));
		// Control Register 4
		this.install(new Register( "CR4", 4 ));
		
		// Debug Register 0
		this.install(new Register( "DR0", 4 ));
		// Debug Register 1
		this.install(new Register( "DR1", 4 ));
		// Debug Register 2
		this.install(new Register( "DR2", 4 ));
		// Debug Register 3
		this.install(new Register( "DR3", 4 ));
		// Debug Register 4
		this.install(new Register( "DR4", 4 ));
		// Debug Register 5
		this.install(new Register( "DR5", 4 ));
		// Debug Register 6
		this.install(new Register( "DR6", 4 ));
		// Debug Register 7
		this.install(new Register( "DR7", 4 ));
		
		/* ======= Test Registers ======= */
		//	NB: Removed in newer CPUs & only numbered from 4 -> 7
		// Debug Register 4
		this.install(new Register( "TR4", 4 ));
		// Debug Register 5
		this.install(new Register( "TR5", 4 ));
		// Debug Register 6
		this.install(new Register( "TR6", 4 ));
		// Debug Register 7
		this.install(new Register( "TR7", 4 ));
		/* ======= /Test Registers ======= */
		
		/* ======== Interrupts ======== */
		// Interrupt pin #INTR
		this.install(new Pin( "INTR" ));
		// Interrupt Descriptor Table info register
		this.install(new Register( "IDTR", 6 ));
		/* ======== /Interrupts ======== */
		
		/* ==== Ordinal lookups ==== */
		// Indexes in array correspond with ModR/M Reg field
		this.arr_regOrdinals_Byte = [
			this.AL, this.CL, this.DL, this.BL
			, this.AH, this.CH, this.DH, this.BH
		];
		this.arr_regOrdinals_Word = [
			this.AX, this.CX, this.DX, this.BX
			, this.SP, this.BP
			, this.SI, this.DI
		];
		this.arr_regOrdinals_Segment = [
			this.ES, this.CS, this.SS, this.DS, this.FS, this.GS
		];
		this.arr_regOrdinals_Segment_Mod00RM06 = [
			this.DS, this.DS, this.SS, this.SS
			, this.DS, this.DS, this.DS, this.DS
		];
		this.arr_regOrdinals_Segment_Mod01or10RM06 = [
			this.DS, this.DS, this.SS, this.SS
			, this.DS, this.DS, this.SS, this.DS
		];
		this.arr_regOrdinals_Base = [
			this.BX, this.BX, this.BP, this.BP
			, this.SI, this.DI, this.BP, this.BX
		];
		this.arr_regOrdinals_Index = [
			this.SI, this.DI, this.SI, this.DI
			, null, null, null, null
		];
		/* ==== /Ordinal lookups ==== */
	};
	
	function Pin( name ) {
		this.name = name;
		this.val = 0;
	}
	Pin.prototype.getName = function () {
		return this.name;
	};
	Pin.prototype.raise = function () {
		this.val = 1;
	};
	Pin.prototype.lower = function () {
		this.val = 0;
	};
	Pin.prototype.set = function ( val ) {
		this.val = val;
	};
	Pin.prototype.IsHigh = function () {
		return this.val === 1;
	};
	
	// Exports
	x86Emu.Pin = Pin;
});
