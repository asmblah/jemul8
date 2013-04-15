/*
 * jemul8 - JavaScript x86 Emulator
 *
 * MODULE: Keyboard Key support
 *
 * ====
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("keyboard/key", function ($) {
    "use strict";
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
