/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *	
 *	MODULE: Keyboard Key support
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

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("keyboard/key", function ($) { "use strict";
	var jemul8 = this.data("jemul8");
	
	// Keyboard Key class constructor
	function Key(text, codeScan, codeUnicode) {
		/* ==== Guards ==== */
		util.assert(this && (this instanceof Key), "Key ctor ::"
			+ " error - constructor not called properly");
		/* ==== /Guards ==== */
		
		// eg. "Q" for the Q key, or PrtScrn for the Print Screen key
		this.text = text;
		// 2-byte Scan Code for the key (low byte is ASCII character code)
		this.codeScan = codeScan;
		// Unicode value returned by JavaScript key event .keyCode
		this.codeUnicode = codeUnicode;
		// By default all keys are released
		this.state = STATE_UP;
		// Parent Keyboard object
		this.keyboard = null;
	}
	// Set this key as down (depressed - "make")
	Key.prototype.down = function () {
		this.state = STATE_DOWN;
		// Add the keystroke to the BIOS' buffer
		jemul8.bios.KeyboardBuffer_AddKey(this.codeScan);
	};
	// Set this key as up (released = "break")
	Key.prototype.up = function () {
		this.state = STATE_UP;
	};
	Key.prototype.getState = function () {
		return this.state;
	};
	
	/* ===== Private ===== */
	var STATE_DOWN = 1;
	var STATE_UP = 2;
	/* ===== /Private ===== */
	
	// Exports
	jemul8.Key = Key;
});
