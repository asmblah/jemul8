/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: Keyboard support
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
	
	// Keyboard class constructor
	function Keyboard( divScreen ) {
		/* ==== Guards ==== */
		jemul8.Assert(this != self, "Keyboard constructor :: not called as constructor.");
		/* ==== /Guards ==== */
		
		// Map from 1-byte Character Codes to Key objects
		this.arr_map_codeChar_ToKey = {};
		// Map from 2-byte Scan Codes to Key objects
		this.arr_map_codeScan_ToKey = {};
		// Map from Unicode key codes to Key objects
		this.arr_map_codeUnicode_ToKey = {};
	}
	// Set up the emulated Keyboard
	Keyboard.prototype.Init = function () {
		var keyboard = this;
		document.onkeydown = function ( evt ) {
			// X-browser event model
			if ( !evt ) { evt = window.event; }
			
			/* ==== Malloc ==== */
			// CharCode will be zero for non-ANSI keys ( or old IE );
			//	short-circuit eval will therefore use KeyCode
			var codeKey;
			var key;
			/* ==== /Malloc ==== */
			
			// Ensure a valid KeyCode was provided; otherwise no choice but to ignore
			if ( !(codeKey = evt.keyCode) ) { return false; }
			
			// TEMP! ignore modifier keys when pressed
			if ( codeKey == 16 || codeKey == 17 || codeKey == 18 ) {
				return;
			}
			
			//top.status = codeKey + "," + codeKey.toString(16).toUpperCase() + "h ";
			
			// Code for key available; use to get Key object
			//	directly from Controller
			//	( Validate key; ignore if not recognised code )
			if ( !(key = keyboard.getKey_ByUnicode(codeKey)) ) { return false; }
			
			//top.status += key.text;return;
			
			// Register key press
			key.Down();
			
			return false;
		};
	};
	// Install a Key onto the emulated Keyboard
	Keyboard.prototype.AddKey = function ( key ) {
		/* ==== Guards ==== */
		jemul8.Assert(key instanceof jemul8.Key, "Keyboard.AddKey :: object given is not a Key.");
		/* ==== /Guards ==== */
		
		/* ====== Set up fast mapping hashes ====== */
		this.arr_map_codeScan_ToKey[key.codeScan] = key;
		// Extract low-byte of Scan Code to use as character code for map
		this.arr_map_codeChar_ToKey[key.codeScan & 0x00FF] = key;
		this.arr_map_codeUnicode_ToKey[key.codeUnicode] = key;
		/* ====== /Set up fast mapping hashes ====== */
		
		// Keep a reference to the parent Keyboard object
		key.keyboard = this;
	};
	// Get a ref to a Key by its Scan Code
	Keyboard.prototype.getKey_ByScanCode = function ( codeScan ) {
		return this.arr_map_codeScan_ToKey[codeScan];
	};
	// Get a ref to a Key by its Char Code
	Keyboard.prototype.getKey_ByCharCode = function ( codeChar ) {
		return this.arr_map_codeChar_ToKey[codeChar];
	};
	// Get a ref to a Key by its Unicode value
	Keyboard.prototype.getKey_ByUnicode = function ( codeChar ) {
		return this.arr_map_codeUnicode_ToKey[codeChar];
	};
	
	/* ==== Exports ==== */
	jemul8.Keyboard = Keyboard;
	/* ==== /Exports ==== */
});

// Add Module to emulator
jemul8.AddModule(mod);