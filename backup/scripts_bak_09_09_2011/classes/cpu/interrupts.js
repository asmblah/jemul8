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
	var jemul8 = this.data("jemul8");
	
	// Generate a CPU/software/hardware interrupt
	jemul8.x86CPU.prototype.interrupt = function ( num ) {
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
			jemul8.problem("CPU.interrupt() :: Error - interrupt vector"
				+ " is out of IDT range");
		}
		
		if ( num === 0x10 ) {
			//console.log("INT 0x10 :: [" + String.fromCharCode(this.AL.get()) + "]");
		} else if ( num === 0x19 ) {
			this.halt();
		}
		
		// Boot 1st available device!
		//if ( num === 0x19 ) { debugger; }
		
		/* ==== Save current FLAGS and CS:IP (CPU state) on stack ==== */
		this.pushStack(this.FLAGS.get(), 2);
		this.IF.clear();	// Disable any maskable interrupts
		this.TF.clear();	// Disable any traps
		this.AC.clear();	// ???
		this.pushStack(this.CS.get(), 2);
		this.pushStack(this.IP.get(), 2);
		/* ==== /Save current FLAGS and CS:IP (CPU state) on stack ==== */
		
		addrVector = addrIDT + offsetVector;
		// Interrupt Handler code segment
		this.CS.set(this.machine.mem.readSegment(0, addrVector + 2, 2));
		// Interrupt Handler IP offset in segment ( set EIP to quickly
		//	ensure high word of EIP is set to zero, rather than just setting IP )
		this.EIP.set(this.machine.mem.readSegment(0, addrVector, 2) & 0xFFFF);
		
		//if ( this.CS.get() === 0xC000 && num === 0x10
		//	&& this.AH.get() === 0x13 ) { alert(this.CX.get()); debugger; }
	};
});
