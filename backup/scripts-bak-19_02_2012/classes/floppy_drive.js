/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *	
 *	MODULE: Floppy Disk Drive support
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("floppy/drive", function ( $ ) { "use strict";
	var jemul8 = this.data("jemul8");
	
	// Import system after setup
	var machine, CPU, DRAM;
	this.bind("load", function ( $, machine_, CPU_, DRAM_ ) {
		machine = machine_; CPU = CPU_; DRAM = DRAM_;
	});
	/* ============ /Import system after setup ============ */
	
	// Floppy Drive class constructor
	function FloppyDrive( machine, idx ) {
		/* ==== Guards ==== */
		jemul8.assert(this != self, "FloppyDrive ctor :: not called as constructor.");
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
		jemul8.assert(diskFloppy && (diskFloppy instanceof jemul8.FloppyDisk)
			, "FloppyDrive.insertDisk() :: invalid disk object given.");
		/* ==== /Guards ==== */
		this.disk = diskFloppy;
	};
	// Load the specified no. of bytes at specified absolute offset into DRAM
	FloppyDrive.prototype.loadBytesIntoDRAM = function ( offsetDisk
													, offsetDRAM, numBytes ) {
		/* ==== Guards ==== */
		jemul8.assert(this.disk && (this.disk instanceof jemul8.FloppyDisk)
			, "FloppyDrive.loadBytesIntoDRAM() :: no valid disk inserted.");
		/* ==== /Guards ==== */
		
		var dram = this.machine.dram;
		
		for ( var idx = 0 ; idx < numBytes ; ++idx ) {
			dram.writeValue(offsetDRAM + idx
				, this.disk.readValue(offsetDisk + idx, 1), 1);
		}
	};
	// Read number of CHS bytes per sector from BIOS Parameter Block
	FloppyDrive.prototype.getBytesPerSector = function () {
		return this.disk.readValue(0x000B, 2);
	};
	// Read number of CHS sectors per track from BIOS Parameter Block
	FloppyDrive.prototype.getSectorsPerTrack = function () {
		return this.disk.readValue(0x0018, 2);
	};
	// Read number of CHS heads used for volume from BIOS Parameter Block
	FloppyDrive.prototype.getNumHeads = function () {
		return this.disk.readValue(0x001A, 2);
	};
	
	// Exports
	jemul8.FloppyDrive = FloppyDrive;
});
