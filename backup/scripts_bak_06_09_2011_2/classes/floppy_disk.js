/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: Floppy Disk support
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("floppy/disk", function ( $ ) { "use strict";
	var jemul8 = this.data("jemul8");
	
	// Floppy Disk class constructor
	function FloppyDisk( textPhysicalLabel, path ) {
		/* ==== Guards ==== */
		jemul8.assert(this != self, "FloppyDisk constructor :: not called as constructor.");
		/* ==== /Guards ==== */
		
		// Store the text on the physical label of the Floppy Disk itself
		this.textPhysicalLabel = textPhysicalLabel;
		
		// Download the specified image file, from path, into this Floppy Disk
		this.bufData = jemul8.getFile(path);
	}
	// Read the specified number of bytes at specified absolute offset ( little-endian )
	FloppyDisk.prototype.readBytes = function ( addr, num ) {
		// Use size of operand to determine how many bytes to read
		switch ( num ) {
		case 1:	// Byte ( 8-bit )
			return this.bufData[ addr ];
		case 2:	// Word ( 16-bit )
			return (this.bufData[ addr + 1 ] << 8) | (this.bufData[ addr ]);
		case 4:	// Dword ( 32-bit )
			return (this.bufData[ addr + 3 ] << 24)
				| (this.bufData[ addr + 2 ] << 16)
				| (this.bufData[ addr + 1 ] << 8) | (this.bufData[ addr ]);
		default:
			jemul8.problem("FloppyDisk.readBytes() :: Operand size > 32-bit not supported");
		}
	};
	
	// Exports
	jemul8.FloppyDisk = FloppyDisk;
});
