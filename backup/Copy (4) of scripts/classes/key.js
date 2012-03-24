/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: Keyboard Key support
 */

// Augment jQuery plugin
new jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("emulator", function ( $ ) {
	var jemul8 = this.data("jemul8");
	
	/* ============ Import system after setup ============ */
	var machine, CPU, DRAM;
	this.RegisterDeferredLoader( function ( machine_, CPU_, DRAM_ ) {
		machine = machine_; CPU = CPU_; DRAM = DRAM_;
	});
	/* ============ /Import system after setup ============ */
	
	// Keyboard Key class constructor
	function Key( text, codeScan, codeUnicode ) {
		/* ==== Guards ==== */
		jemul8.Assert(this != self, "Key constructor :: not called as constructor.");
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
	Key.prototype.Down = function () {
		this.state = STATE_DOWN;
		// Add the keystroke to the BIOS' buffer
		jemul8.BIOS.KeyboardBuffer_AddKey(this.codeScan);
	};
	// Set this key as up ( released = "break" )
	Key.prototype.Up = function () {
		this.state = STATE_UP;
	};
	Key.prototype.getState = function () {
		return this.state;
	};
	
	/* ===== Private ===== */
	var STATE_DOWN = 1;
	var STATE_UP = 2;
	/* ===== /Private ===== */
	
	/* ==== Exports ==== */
	jemul8.Key = Key;
	/* ==== /Exports ==== */
});

// Add Module to emulator
jemul8.AddModule(mod);