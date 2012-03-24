/*
 *	jsEmu - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: CPU Instruction class support
 */
var mod = new jsEmu.SecondaryModule( function ( jsEmu, machine, motherboard, CPU, FlashBIOSChip, BIOS, DRAM ) {
	// Indexes in array correspond with ModR/M Reg field
	jsEmu.x86CPU.prototype.arr_regOrdinals_Byte = [
			CPU.AL, CPU.CL, CPU.DL, CPU.BL
			, CPU.AH, CPU.CH, CPU.DH, CPU.BH
		];
	jsEmu.x86CPU.prototype.arr_regOrdinals_Word = [
			CPU.AX, CPU.CX, CPU.DX, CPU.BX
			, CPU.SP, CPU.BP
			, CPU.SI, CPU.DI
		];
	jsEmu.x86CPU.prototype.arr_regOrdinals_Segment = [
			CPU.ES, CPU.CS, CPU.SS, CPU.DS, CPU.FS, CPU.GS
		];
	
	/* ==== Exports ==== */
	
	/* ==== /Exports ==== */
});

// Add Module to emulator
jsEmu.AddModule(mod);