/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: IBM-PC compatible BIOS firmware support
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("bios", function ( $ ) { "use strict";
	var x86Emu = this.data("x86Emu");
	
	// IBM-compatible x86 BIOS firmware
	function BIOS( machine, name ) {
		this.machine = machine;
		
		this.name = name;
		// Status of last BIOS disk operation
		//	 (00h being success)
		this.statusDiskLast = 0x00;
		// Define BIOS' machine Equipment List word ( 16 bits wide )
		this.wordEquipmentList = new x86Emu.Bitfield( 16 );
		
		// Download & store BIOS firmware image
		this.memData = x86Emu.getFile(
			"docs/bochs-20100605/bios/BIOS-bochs-legacy");
	}
	// Prepare BIOS to be loaded (no chipset/Northbridge emulation used
	//	so must be copied to DRAM)
	BIOS.prototype.prepare = function () {
		var cpu = this.machine.cpu
			, dram = this.machine.dram
		// Copy BIOS code into DRAM
		/*
		 *	( This removes the need to install addl. hooks
		 *	into the IO read logic for redirection -
		 *	normally the Northbridge would handle sending
		 *	requests to the flash BIOS instead of DRAM )
		 */
			, cache_segment = 0 //0xFFF00000;
			, segment = cpu.CS.get() // Should be 0xF000;
		// FIX 05/09: ROM loaded in this segment, but at offset zero!
		//	(First command in POST is at offset EIP though)
			, offset = 0
		// Bitshift reqd. to force integer interpretation
			, addrFlat = (cache_segment | (segment << 4) + offset) >>> 0
			, memData = this.memData, memData_DRAM = dram.memData
			, idx, len = memData.length;
		
		for ( idx = 0 ; idx < len ; ++idx ) {
			memData_DRAM[ addrFlat + idx ] = memData[ idx ];
		}
	};
	
	// Exports
	x86Emu.BIOS = BIOS;
});
