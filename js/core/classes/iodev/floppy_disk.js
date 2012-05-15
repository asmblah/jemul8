/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *	
 *	MODULE: Floppy Disk class support (see FDC for the drive/controller)
 *
 *  ====
 *  
 *  This file is part of jemul8.
 *  
 *  jemul8 is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *  
 *  jemul8 is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *  
 *  You should have received a copy of the GNU General Public License
 *  along with jemul8.  If not, see <http://www.gnu.org/licenses/>.
 */

define([
	"../../util"
	, "../http"
	, "../memory/buffer"
], function (util, HTTP, Buffer) { "use strict";
	
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
	FloppyDisk.prototype.loadFile = function (path, done, fail) {
		// FIXME: This value should be different
		//        for different types of diskette
		//this.data = HTTP.get(path);//, 1474560);
		
		//return this.data !== null;
		var disk = this;

		HTTP.get(path, function (path, buffer) {
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
