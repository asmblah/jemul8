/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: Floppy Disk Drive support
 */

// Augment jQuery plugin
new jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("emulator", function ( $ ) {
	var jemul8 = this.data("jemul8");
	
	/* ============ Import system after setup ============ */
	var machine, CPU, DRAM;
	this.RegisterDeferredLoader( function ( machine_, CPU_, DRAM_ ) {
		machine = machine_; CPU = CPU_; DRAM = DRAM_;
	});
	/* ============ /Import system after setup ============ */
	
	// Floppy Drive class constructor
	function FloppyDrive( idx ) {
		/* ==== Guards ==== */
		jemul8.Assert(this != self, "FloppyDrive constructor :: not called as constructor.");
		/* ==== /Guards ==== */
		
		// Drive index; eg first is 0 ( floppy0 )
		this.idx = idx;
		// Currently loaded Floppy Disk object
		this.disk;
	}
	// Load the specified Floppy Disk object into this Floppy Drive
	FloppyDrive.prototype.InsertDisk = function ( diskFloppy ) {
		/* ==== Guards ==== */
		jemul8.Assert(diskFloppy && diskFloppy instanceof jemul8.FloppyDisk, "FloppyDrive.InsertDisk :: invalid disk object given.");
		/* ==== /Guards ==== */
		this.disk = diskFloppy;
	};
	// Load the specified number of bytes at specified absolute offset into DRAM
	FloppyDrive.prototype.LoadBytesIntoDRAM = function ( offsetDisk, offsetDRAM, numBytes ) {
		/* ==== Guards ==== */
		jemul8.Assert(this.disk && this.disk instanceof jemul8.FloppyDisk, "FloppyDrive.LoadBytesIntoDRAM :: no valid disk inserted.");
		/* ==== /Guards ==== */
		
		for ( var idx = 0 ; idx < numBytes ; ++idx ) {
			DRAM.WriteBytes(offsetDRAM + idx, this.disk.ReadBytes(offsetDisk + idx, 1), 1);
		}
	};
	// Read number of CHS bytes per sector from BIOS Parameter Block
	FloppyDrive.prototype.getBytesPerSector = function () {
		return this.disk.ReadBytes(0x000B, 2);
	};
	// Read number of CHS sectors per track from BIOS Parameter Block
	FloppyDrive.prototype.getSectorsPerTrack = function () {
		return this.disk.ReadBytes(0x0018, 2);
	};
	// Read number of CHS heads used for volume from BIOS Parameter Block
	FloppyDrive.prototype.getNumHeads = function () {
		return this.disk.ReadBytes(0x001A, 2);
	};
	
	/* ==== Exports ==== */
	jemul8.FloppyDrive = FloppyDrive;
	/* ==== /Exports ==== */
});

// Add Module to emulator
jemul8.AddModule(mod);