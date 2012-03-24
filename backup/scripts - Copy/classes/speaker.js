/*
 *	jsEmu - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: Speaker support
 */
var mod = new jsEmu.PrimaryModule( function ( jsEmu ) {
	/* ============ Import system after setup ============ */
	var machine, motherboard, CPU, FlashBIOSChip, BIOS, DRAM;
	this.RegisterDeferredLoader( function ( machine_, motherboard_, CPU_, FlashBIOSChip_, BIOS_, DRAM_ ) {
			machine = machine_; motherboard = motherboard_; CPU = CPU_; FlashBIOSChip = FlashBIOSChip_; BIOS = BIOS_; DRAM = DRAM_;
		});
	/* ============ /Import system after setup ============ */
	
	// Basic Speaker ( eg. Onboard motherboard ) class constructor
	function Speaker() {
		/* ==== Guards ==== */
		jsEmu.Assert(this != self, "Speaker constructor :: not called as constructor.");
		/* ==== /Guards ==== */
		
		this.aud = document.createElement("audio");
		if ( !this.aud || !this.aud.play ) {
			jsEmu.Warning("Speaker constructor :: No native <audio> support, terminal bell disabled");
		}
	}
	// Simple beep sound
	Speaker.prototype.Beep = function ( freqHertz, duration ) {
		/* ==== Defaults ==== */
		if ( !freqHertz ) freqHertz = 800;
		if ( !duration ) duration = 200;
		/* ==== /Defaults ==== */
		
		// TODO: ( see jsSound project )
		alert("Beep!");
	};
	
	/* ==== Exports ==== */
	jsEmu.Speaker = Speaker;
	/* ==== /Exports ==== */
});

// Add Module to emulator
jsEmu.AddModule(mod);