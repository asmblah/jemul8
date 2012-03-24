/*
 *	jsEmu - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: IBM-PC compatible BIOS firmware support
 */
var mod = new jsEmu.PrimaryModule( function ( jsEmu ) {
	/* ==== Malloc ==== */
	/* ====== Only available after Init() ====== */
	var machine;
	var motherboard;
	var CPU;
	var FlashBIOSChip;
	var DRAM;
	/* ====== /Only available after Init() ====== */
	/* ==== /Malloc ==== */
	
	// IBM-compatible x86 BIOS firmware
	function x86BIOS( name ) {
		this.name = name;
		// Status of last BIOS disk operation
		//	 ( 00h being success )
		this.statusDiskLast = 0x00;
		// Define BIOS' machine Equipment List word ( 16 bits wide )
		this.wordEquipmentList = new jsEmu.Bitfield( 16 );
	}
	// All the emulated BIOS's basic setup
	//	( eg. values read from motherboard switches / memory size etc. )
	x86BIOS.prototype.Init = function () {
		/* ===== Import other System objects ===== */
		machine = jsEmu.machine;
		motherboard = jsEmu.motherboard;
		CPU = jsEmu.CPU;
		FlashBIOSChip = jsEmu.FlashBIOSChip;
		DRAM = jsEmu.DRAM;
		/* ===== /Import other System objects ===== */
		
		// Word at 0040h:0013h contains no. of kilobytes of contiguous memory available
		DRAM.WriteBytes((0x0040 << 4) + 0x0013, DRAM.GetAvailableRAMKilobytes(), 2);
		
		/* ==== Malloc ==== */
		var numFloppies = 1;
		var is80x87CoprocessorInstalled = 0;
		// Legacy - only for original IBM-PC, leave at zero should be safe
		var num16K_RAMBanks_Onboard = 0;
		// 00h - EGA, VGA or PGA
		// 01h - 40x25 colour
		// 10h - 80x25 colour
		// 11h - 80x25 monochrome
		var modeVideoInitial = 0x10;
		// DMA support ( only for PCjr, Tandy 1400LT )
		var isDMASupportInstalled = 0;
		// Number of serial/COM ports installed
		var numSerialPortsInstalled = 0;
		// Game port installed ?
		var isGamePortInstalled = 0;
		// Internal modem installed ?
		var isInternalModemInstalled = 0;
		// Number of parallel/LPT ports installed
		var numParallelPortsInstalled = 0;
		/* ==== /Malloc ==== */
		
		/* ==== Set up Equipment List Word ==== */
		// TODO: support the 2nd byte's info
		// Floppy disks installed ( number specified by bits 7 - 6 )
		this.wordEquipmentList.SetBits(0, numFloppies > 0 ? 1 : 0, 1);
		// 80x87 coprocessor installed
		this.wordEquipmentList.SetBits(1, is80x87CoprocessorInstalled ? 1 : 0, 1);
		// Number of 16K banks of RAM on motherboard
		this.wordEquipmentList.SetBits(2, num16K_RAMBanks_Onboard, 2);
		// Initial Video mode
		this.wordEquipmentList.SetBits(4, modeVideoInitial, 2);
		// Number of floppies installed less 1 ( if bit 0 set )
		this.wordEquipmentList.SetBits(6, numFloppies > 1 ? numFloppies - 1 : 0, 2);
		// DMA support installed
		this.wordEquipmentList.SetBits(8, isDMASupportInstalled, 1);
		// Number of serial ports installed
		this.wordEquipmentList.SetBits(9, numSerialPortsInstalled, 3);
		// Game port installed ?
		this.wordEquipmentList.SetBits(12, isGamePortInstalled, 1);
		// Internal modem installed ?
		this.wordEquipmentList.SetBits(13, isInternalModemInstalled, 1);
		// Number of parallel ports installed
		this.wordEquipmentList.SetBits(14, numParallelPortsInstalled, 2);
		/* ==== /Set up Equipment List Word ==== */
	};
	// Load an x86 Master Boot Record ( 512-byte boot sector )
	//	( IBM-compatible BIOS load )
	x86BIOS.prototype.LoadMBR = function ( arr_bytMBR ) {
		/* ==== Malloc ==== */
		var offset = 0x00007C00;
		/* ==== /Malloc ==== */
		
		// Load Master Boot Record into physical RAM address 0x7C00 ( derived from CS above )
		for ( var idx = 0 ; idx < 512 ; ++idx ) {
			DRAM.WriteBytes(offset + idx, arr_bytMBR[idx], 1);
		}
		
		// Start executing at new load location to boot
		CPU.CS.Set(0x0000);
		CPU.EIP.Set(offset);
	};
	
	/* ==== Exports ==== */
	jsEmu.x86BIOS = x86BIOS;
	/* ==== /Exports ==== */
});

// Add Module to emulator
jsEmu.AddModule(mod);