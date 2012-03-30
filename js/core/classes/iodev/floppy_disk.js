/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *	
 *	MODULE: Floppy Disk class support (see FDC for the drive/controller)
 */

define([
	"../../util"
	, "../http"
	, "../memory/buffer"
], function ( util, HTTP, Buffer ) { "use strict";
	
	// Constructor / pre-init
	function FloppyDisk( fd              // File descriptor
	                   , sectorsPerTrack // No. of sectors/track
				       , sectors         // No. of formatted sectors on diskette
				       , tracks          // No. of tracks
				       , heads           // No. of heads
				       , type            // (See FloppyType class)
				       , writeProtected  // Write Protect switch state
    ) {
		util.assert(this && (this instanceof FloppyDisk)
			, "FloppyDisk constructor :: error - not called properly"
		);
		
		this.fd = fd;
		this.sectors_per_track = sectorsPerTrack;
		this.sectors = sectors;
		this.tracks = tracks;
		this.heads = heads;
		this.type = type;
		this.write_protected = writeProtected;
		
		this.data = null;
	}
	FloppyDisk.prototype.loadFile = function ( path, done, fail ) {
		// FIXME: This value should be different
		//        for different types of diskette
		//this.data = HTTP.get(path);//, 1474560);
		
		//return this.data !== null;
		var disk = this;

		HTTP.get(path, function ( path, buffer ) {
			disk.data = buffer;
			done();
		}, fail);
	};
	FloppyDisk.prototype.getDataSize = function () {
		return this.data !== null ? Buffer.getBufferLength(this.data) : 0;
	};
	FloppyDisk.prototype.eject = function () {
		delete this.data;
	};
	
	// Exports
	return FloppyDisk;
});
