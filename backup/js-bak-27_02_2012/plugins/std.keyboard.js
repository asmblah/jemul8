
define([
	"jquery"
	, "../core/util"
	, "../core/classes/iodev/keyboard/scancode"
], function ( $, util, Scancode ) { "use strict";
	var keyboardPlugin = {
		applyTo: function ( emu ) {
			var cancelKeypress = false;
			$(document).keydown(function ( evt ) {
				var key = toKeyIndex(evt.keyCode);
				
				// Simple translation to KEY_* values (needs a keymap)
				emu.machine.keyboard.keyboard.generateScancode(key, "make");
				
				// Stop browser reacting to keystroke
				cancelKeypress = true;
				evt.preventDefault();
				return false;
			}).keyup(function ( evt ) {
				var key = toKeyIndex(evt.keyCode);
				
				// Simple translation to KEY_* values (needs a keymap)
				emu.machine.keyboard.keyboard.generateScancode(key, "break");
			}).keypress(function ( evt ) {
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
		switch ( keyCode ) {
		case 8:
			return Scancode.getKeyIndex("KEY_BACKSPACE");
		case 13:
			return Scancode.getKeyIndex("KEY_ENTER");
		// Other ANSI key
		default:
			return keyCode - (65 - 20);
		}
	}
	
	return keyboardPlugin;
});
