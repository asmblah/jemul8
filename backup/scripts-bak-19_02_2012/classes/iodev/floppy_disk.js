/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *	
 *	MODULE: Floppy Disk class support (see FDC for the drive/controller)
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("iodev/floppy_disk", function ( $ ) { "use strict";
	var jemul8 = this.data("jemul8");
	
	// Constructor / pre-init
	function FloppyDisk( fd              // File descriptor
	                   , sectorsPerTrack // No. of sectors/track
				       , sectors         // No. of formatted sectors on diskette
				       , tracks          // No. of tracks
				       , heads           // No. of heads
				       , type            // (See FloppyType class)
				       , writeProtected  // Write Protect switch state
				) {
		jemul8.assert(this && (this instanceof FloppyDisk)
			, "FloppyDisk ctor :: error - constructor not called properly");
		
		this.fd = fd;
		this.sectors_per_track = sectorsPerTrack;
		this.sectors = sectors;
		this.tracks = tracks;
		this.heads = heads;
		this.type = type;
		this.write_protected = writeProtected;
		
		this.data = null;
	}
	FloppyDisk.prototype.loadFile = function ( path ) {
		// FIXME: This value should be different
		//        for different types of diskette
		this.data = jemul8.getFile(path, 1474560);
		
		return this.data !== null;
	};
	FloppyDisk.prototype.getDataSize = function () {
		return this.data !== null ? jemul8.getBufferLength(this.data) : 0;
	};
	FloppyDisk.prototype.eject = function () {
		delete this.data;
	};
	
	// Exports
	jemul8.FloppyDisk = FloppyDisk;
});
