/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: Floppy Disk support
 */

// Augment jQuery plugin
new jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("emulator", function ( $ ) {
	var jemul8 = this.data("jemul8");
	
	// Floppy Disk class constructor
	function FloppyDisk( textPhysicalLabel, path ) {
		/* ==== Guards ==== */
		jemul8.Assert(this != self, "FloppyDisk constructor :: not called as constructor.");
		/* ==== /Guards ==== */
		
		// Store the text on the physical label of the Floppy Disk itself
		this.textPhysicalLabel = textPhysicalLabel;
		
		// Download the specified image file, from path, into this Floppy Disk
		this.memData = jemul8.getSyncHTTP_Binary(path);
	}
	// Read the specified number of bytes at specified absolute offset ( little-endian )
	FloppyDisk.prototype.ReadBytes = function ( addr, num ) {
		// Use size of operand to determine how many bytes to read
		switch ( num ) {
		case 1:	// Byte ( 8-bit )
			return this.memData[addr];
		case 2:	// Word ( 16-bit )
			return (this.memData[addr + 1] << 8) | (this.memData[addr]);
		case 4:	// Dword ( 32-bit )
			return (this.memData[addr + 3] << 24) | (this.memData[addr + 2] << 16) | (this.memData[addr + 1] << 8) | (this.memData[addr]);
		default:
			throw new Error( "FloppyDisk.ReadBytes :: Operand size > 32-bit not supported" );
		}
	};
	
	/* ==== Exports ==== */
	jemul8.FloppyDisk = FloppyDisk;
	/* ==== /Exports ==== */
});

// Add Module to emulator
jemul8.AddModule(mod);