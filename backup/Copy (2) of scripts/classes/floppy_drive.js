/*
 *	jsEmu - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: Floppy Disk Drive support
 */
var mod = new jsEmu.PrimaryModule( function ( jsEmu ) {
	
	// Floppy Drive class constructor
	function FloppyDrive( idx ) {
		/* ==== Guards ==== */
		jsEmu.Assert(this != self, "FloppyDrive constructor :: not called as constructor.");
		/* ==== /Guards ==== */
		
		// Drive index; eg first is 0 ( Floppy0 )
		this.idx = idx;
		// Currently loaded Floppy Disk object
		this.disk;
	}
	// Load the specified Floppy Disk object into this Floppy Drive
	FloppyDrive.prototype.InsertDisk = function ( diskFloppy ) {
		/* ==== Guards ==== */
		jsEmu.Assert(diskFloppy && diskFloppy instanceof jsEmu.FloppyDisk, "FloppyDrive.InsertDisk :: invalid disk object given.");
		/* ==== /Guards ==== */
		this.disk = diskFloppy;
	};
	// Load the specified number of bytes at specified absolute offset into DRAM
	FloppyDrive.prototype.LoadBytesIntoDRAM = function ( offsetDisk, offsetDRAM, numBytes ) {
		/* ==== Guards ==== */
		jsEmu.Assert(this.disk && this.disk instanceof jsEmu.FloppyDisk, "FloppyDrive.LoadBytesIntoDRAM :: no valid disk inserted.");
		/* ==== /Guards ==== */
		
		for ( var idx = 0 ; idx < numBytes ; ++idx ) {
			jsEmu.DRAM.WriteBytes(offsetDRAM + idx, this.disk.ReadBytes(offsetDisk + idx, 1), 1);
		}
	};
	
	/* ==== Exports ==== */
	jsEmu.FloppyDrive = FloppyDrive;
	/* ==== /Exports ==== */
});

// Add Module to emulator
jsEmu.AddModule(mod);