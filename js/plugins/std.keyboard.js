/*
 *  jemul8 - JavaScript x86 Emulator
 *  Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *  
 *  MODULE: Simple DOM event-based keyboard plugin
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
	"jquery"
	, "../core/util"
	, "../core/classes/iodev/keyboard/scancode"
], function ($, util, Scancode) { "use strict";
	var keyboardPlugin = {
		applyTo: function (emu) {
			var cancelKeypress = false;
			$(document).keydown(function (evt) {
				var key = toKeyIndex(evt.keyCode);
				
				// Simple translation to KEY_* values (needs a keymap)
				emu.machine.keyboard.keyboard.generateScancode(key, "make");
				
				// Stop browser reacting to keystroke
				cancelKeypress = true;
				evt.preventDefault();
				return false;
			}).keyup(function (evt) {
				var key = toKeyIndex(evt.keyCode);
				
				// Simple translation to KEY_* values (needs a keymap)
				emu.machine.keyboard.keyboard.generateScancode(key, "break");
			}).keypress(function (evt) {
				if ( cancelKeypress ) {
					cancelKeypress = false; // Only this keypress
					evt.preventDefault();
					return false;
				}
			});
		}
	};
	
	// Convert a DOM keyCode to a key index
	function toKeyIndex( keyCode ) {
        //$("<div>").text(keyCode).insertBefore($("canvas"));

        if (keyCode >= 112 && keyCode <= 112 + 12) {
        	return Scancode.getKeyIndex("KEY_F" + (keyCode - 112 + 1));
        }
        
		switch ( keyCode ) {
		case 8:
			return Scancode.getKeyIndex("KEY_BACKSPACE");
		case 13:
			return Scancode.getKeyIndex("KEY_ENTER");
		case 16:
			return Scancode.getKeyIndex("KEY_SHIFT_L");
		case 27:
			return Scancode.getKeyIndex("KEY_ESC");
		case 32:
			return Scancode.getKeyIndex("KEY_SPACE");
		case 37:
			return Scancode.getKeyIndex("KEY_LEFT");
		case 38:
			return Scancode.getKeyIndex("KEY_UP");
		case 39:
			return Scancode.getKeyIndex("KEY_RIGHT");
		case 40:
			return Scancode.getKeyIndex("KEY_DOWN");
        case 190:
            return Scancode.getKeyIndex("KEY_PERIOD");
		// Other ANSI key
		default:
			return keyCode - (65 - 20);
		}
	}
	
	return keyboardPlugin;
});
