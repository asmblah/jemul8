/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *	
 *	MODULE: Speaker support
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
], function (util) { "use strict";
	
	// Basic Speaker (ie. motherboard onboard) class constructor
	function Speaker() {
		/* ==== Guards ==== */
		util.assert(this && (this instanceof Speaker), "Speaker ctor ::"
			+ " error - constructor not called properly");
		/* ==== /Guards ==== */
		
		this.aud = document.createElement("audio");
		if (!this.aud || !this.aud.play) {
			util.warning("Speaker constructor :: No native <audio> support,"
				+ " terminal bell disabled");
		}
	}
	// Simple beep sound
	Speaker.prototype.beep = function (freqHertz, duration) {
		/* ==== Defaults ==== */
		if (!freqHertz) freqHertz = 800;
		if (!duration) duration = 200;
		/* ==== /Defaults ==== */
		
		// TODO: (see jsSound project)
		alert("Beep!");
	};
	
	// Exports
	return Speaker;
});
