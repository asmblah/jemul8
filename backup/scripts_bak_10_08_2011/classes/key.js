/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: Keyboard Key support
 */

// Augment jQuery plugin
new jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("emulator", function ( $ ) {
	var x86Emu = this.data("x86Emu");
	
	// Import system after setup
	var machine, CPU, DRAM;
	this.bind("load", function ( $, machine_, CPU_, DRAM_ ) {
		machine = machine_; CPU = CPU_; DRAM = DRAM_;
	});
	/* ============ /Import system after setup ============ */
	
	// Keyboard Key class constructor
	function Key( text, codeScan, codeUnicode ) {
		/* ==== Guards ==== */
		$.assert(this != self, "Key constructor :: not called as constructor.");
		/* ==== /Guards ==== */
		
		// eg. "Q" for the Q key, or PrtScrn for the Print Screen key
		this.text = text;
		// 2-byte Scan Code for the key ( low byte is ASCII character code )
		this.codeScan = codeScan;
		// Unicode value returned by JavaScript key event .keyCode
		this.codeUnicode = codeUnicode;
		// By default all keys are released
		this.state = STATE_UP;
		// Parent Keyboard object
		this.keyboard = null;
	}
	// Set this key as down ( depressed - "make" )
	Key.prototype.down = function () {
		this.state = STATE_DOWN;
		// Add the keystroke to the BIOS' buffer
		x86Emu.BIOS.KeyboardBuffer_AddKey(this.codeScan);
	};
	// Set this key as up ( released = "break" )
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
	x86Emu.Key = Key;
});
