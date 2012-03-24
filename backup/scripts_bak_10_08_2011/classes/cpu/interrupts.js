/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: HLE ( High-Level Emulation ) CPU Interrupts support
 *		( NB: many of these are BIOS-registered, but kept here for simplicity )
 */
var mod = new jemul8.SecondaryModule( function ( jemul8, machine, CPU, DRAM ) {
	/* ==== Malloc ==== */
	
	/* ==== /Malloc ==== */
	
	// Generate a CPU/software/hardware interrupt
	x86Emu.x86CPU.prototype.interrupt = function ( num ) {
		/* ==== Malloc ==== */
		var IDTR = this.IDTR.get();
		var addrIDT = IDTR >> 16;
		var sizeIDT = IDTR & 0xFFFF;
		// Calc offset as 4 bytes for every vector before this one
		var offsetVector = num * 4;
		var addrVector;
		/* ==== /Malloc ==== */
		
		// Check whether vector is out of bounds ( vector being read
		//	must be inside IDTR - its size is variable )
		if ( offsetVector > sizeIDT ) {
			$.problem("Interrupt vector is out of IDT range");
		}
		
		/* ====== Save current FLAGS and CS:IP ( CPU state ) on stack ====== */
		this.pushStack(this.FLAGS.get(), 2);
		this.IF.clear();	// Disable any maskable interrupts
		this.TF.clear();	// Disable any traps
		this.pushStack(this.CS.get(), 2);
		this.pushStack(this.IP.get(), 2);
		/* ====== /Save current FLAGS and CS:IP ( CPU state ) on stack ====== */
		
		addrVector = addrIDT + offsetVector;
		// Interrupt Handler code segment
		this.CS.set(DRAM.ReadBytes(addrVector, 2));
		// Interrupt Handler IP offset in segment ( set EIP to quickly
		//	ensure high word of EIP is set to zero, rather than just setting IP )
		this.EIP.set(DRAM.ReadBytes(addrVector + 2, 2));
	};
	
	/* ==== Exports ==== */
	
	/* ==== /Exports ==== */
});
