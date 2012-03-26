/*
 *	jsEmu - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: Keyboard Key support
 */
var mod = new jsEmu.PrimaryModule( function ( jsEmu ) {
	/* ============ Import system after setup ============ */
	var machine, motherboard, CPU, FlashBIOSChip, BIOS, DRAM;
	this.RegisterDeferredLoader( function ( machine_, motherboard_, CPU_, FlashBIOSChip_, BIOS_, DRAM_ ) {
			machine = machine_; motherboard = motherboard_; CPU = CPU_; FlashBIOSChip = FlashBIOSChip_; BIOS = BIOS_; DRAM = DRAM_;
		});
	/* ============ /Import system after setup ============ */
	
	// Keyboard Key class constructor
	function Key( text, codeScan, codeUnicode ) {
		/* ==== Guards ==== */
		jsEmu.Assert(this != self, "Key constructor :: not called as constructor.");
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
		jsEmu.BIOS.KeyboardBuffer_AddKey(this.codeScan);
	};
	// Set this key as up ( released = "break" )
	Key.prototype.Up = function () {
		this.state = STATE_UP;
	};
	Key.prototype.GetState = function () {
		return this.state;
	};
	
	/* ===== Private ===== */
	var STATE_DOWN = 1;
	var STATE_UP = 2;
	/* ===== /Private ===== */
	
	/* ==== Exports ==== */
	jsEmu.Key = Key;
	/* ==== /Exports ==== */
});

// Add Module to emulator
jsEmu.AddModule(mod);