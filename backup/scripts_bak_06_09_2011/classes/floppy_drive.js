/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: Floppy Disk Drive support
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("floppy/drive", function ( $ ) { "use strict";
	var x86Emu = this.data("x86Emu");
	
	// Import system after setup
	var machine, CPU, DRAM;
	this.bind("load", function ( $, machine_, CPU_, DRAM_ ) {
		machine = machine_; CPU = CPU_; DRAM = DRAM_;
	});
	/* ============ /Import system after setup ============ */
	
	// Floppy Drive class constructor
	function FloppyDrive( machine, idx ) {
		/* ==== Guards ==== */
		$.assert(this != self, "FloppyDrive ctor :: not called as constructor.");
		/* ==== /Guards ==== */
		
		this.machine = machine;
		
		// Drive index; eg first is 0 (floppy0)
		this.idx = idx;
		// Currently loaded Floppy Disk object
		this.disk = null;
	}
	// Load the specified Floppy Disk object into this Floppy Drive
	FloppyDrive.prototype.insertDisk = function ( diskFloppy ) {
		/* ==== Guards ==== */
		$.assert(diskFloppy && (diskFloppy instanceof x86Emu.FloppyDisk)
			, "FloppyDrive.insertDisk() :: invalid disk object given.");
		/* ==== /Guards ==== */
		this.disk = diskFloppy;
	};
	// Load the specified no. of bytes at specified absolute offset into DRAM
	FloppyDrive.prototype.loadBytesIntoDRAM = function ( offsetDisk
													, offsetDRAM, numBytes ) {
		/* ==== Guards ==== */
		$.assert(this.disk && (this.disk instanceof x86Emu.FloppyDisk)
			, "FloppyDrive.loadBytesIntoDRAM() :: no valid disk inserted.");
		/* ==== /Guards ==== */
		
		var dram = this.machine.dram;
		
		for ( var idx = 0 ; idx < numBytes ; ++idx ) {
			dram.writeBytes(offsetDRAM + idx
				, this.disk.readBytes(offsetDisk + idx, 1), 1);
		}
	};
	// Read number of CHS bytes per sector from BIOS Parameter Block
	FloppyDrive.prototype.getBytesPerSector = function () {
		return this.disk.readBytes(0x000B, 2);
	};
	// Read number of CHS sectors per track from BIOS Parameter Block
	FloppyDrive.prototype.getSectorsPerTrack = function () {
		return this.disk.readBytes(0x0018, 2);
	};
	// Read number of CHS heads used for volume from BIOS Parameter Block
	FloppyDrive.prototype.getNumHeads = function () {
		return this.disk.readBytes(0x001A, 2);
	};
	
	// Exports
	x86Emu.FloppyDrive = FloppyDrive;
});
