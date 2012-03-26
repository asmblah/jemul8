/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: CPU Instruction class support
 */
var mod = new jemul8.SecondaryModule( function ( jemul8, machine, CPU, DRAM ) {
	// Indexes in array correspond with ModR/M Reg field
	x86Emu.x86CPU.prototype.arr_regOrdinals_Byte = [
		CPU.AL, CPU.CL, CPU.DL, CPU.BL
		, CPU.AH, CPU.CH, CPU.DH, CPU.BH
	];
	x86Emu.x86CPU.prototype.arr_regOrdinals_Word = [
		CPU.AX, CPU.CX, CPU.DX, CPU.BX
		, CPU.SP, CPU.BP
		, CPU.SI, CPU.DI
	];
	x86Emu.x86CPU.prototype.arr_regOrdinals_Segment = [
		CPU.ES, CPU.CS, CPU.SS, CPU.DS, CPU.FS, CPU.GS
	];
	x86Emu.x86CPU.prototype.arr_regOrdinals_Segment_Mod00RM06 = [
		CPU.DS, CPU.DS, CPU.SS, CPU.SS, CPU.DS, CPU.DS, CPU.DS, CPU.DS
	];
	x86Emu.x86CPU.prototype.arr_regOrdinals_Segment_Mod01or10RM06 = [
		CPU.DS, CPU.DS, CPU.SS, CPU.SS, CPU.DS, CPU.DS, CPU.SS, CPU.DS
	];
	x86Emu.x86CPU.prototype.arr_regOrdinals_Base = [
		CPU.BX, CPU.BX, CPU.BP, CPU.BP, CPU.SI, CPU.DI, CPU.BP, CPU.BX
	];
	x86Emu.x86CPU.prototype.arr_regOrdinals_Index = [
		CPU.SI, CPU.DI, CPU.SI, CPU.DI, null, null, null, null
	];
});
