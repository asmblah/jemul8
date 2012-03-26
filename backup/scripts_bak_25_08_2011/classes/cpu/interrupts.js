/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: HLE ( High-Level Emulation ) CPU Interrupts support
 *		( NB: many of these are BIOS-registered, but kept here for simplicity )
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("cpu/interrupts", function ( $ ) { "use strict";
	var x86Emu = this.data("x86Emu");
	
	// Generate a CPU/software/hardware interrupt
	x86Emu.x86CPU.prototype.interrupt = function ( num ) {
		var IDTR = this.IDTR.get();
		var addrIDT = IDTR >> 16;
		var sizeIDT = IDTR & 0xFFFF;
		// Calc offset as 4 bytes for every vector before this one
		var offsetVector = num * 4;
		var addrVector;
		
		// Check whether vector is out of bounds (vector being read
		//	must be inside IDTR - its size is variable)
		if ( offsetVector > sizeIDT ) {
			// TODO: Trigger the correct CPU #exception here instead...
			$.problem("CPU.interrupt() :: Error - interrupt vector"
				+ " is out of IDT range");
		}
		
		// Skip, as VGA is not set up properly yet...
		//if ( num === 0x10 ) { alert(String.fromCharCode(this.AL.get())); return; }
		
		if ( num === 0x19 ) { debugger; }
		
		/* ====== Save current FLAGS and CS:IP ( CPU state ) on stack ====== */
		this.pushStack(this.FLAGS.get(), 2);
		this.IF.clear();	// Disable any maskable interrupts
		this.TF.clear();	// Disable any traps
		this.AC.clear();	// ???
		this.pushStack(this.CS.get(), 2);
		this.pushStack(this.IP.get(), 2);
		/* ====== /Save current FLAGS and CS:IP ( CPU state ) on stack ====== */
		
		addrVector = addrIDT + offsetVector;
		// Interrupt Handler code segment
		this.CS.set(this.machine.dram.readBytes(addrVector + 2, 2));
		// Interrupt Handler IP offset in segment ( set EIP to quickly
		//	ensure high word of EIP is set to zero, rather than just setting IP )
		this.EIP.set(this.machine.dram.readBytes(addrVector, 2) & 0xFFFF);
	};
	
	/* ==== Exports ==== */
	
	/* ==== /Exports ==== */
});
