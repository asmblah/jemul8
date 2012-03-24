/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: Stack support
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("cpu/instruction/stack", function ( $ ) { "use strict";
	var jemul8 = this.data("jemul8");
	
	// Stack Address Size is determined by the address-size attribute of the Stack Segment
	jemul8.x86CPU.prototype.getStackAddressSize = function () {
		return 16;
	};
	// Push data onto the Stack
	jemul8.x86CPU.prototype.pushStack = function ( val, sizeBytes ) {//debugger;
		// Get pointer to top of Stack
		var ptrStack = this.ESP.get()
			, bitmaskSize, addr;
		
		// Sign-extend byte values to a round 2 or 4 bytes wide
		//	( NB: sizes 2 and 4 are left out as these are already ok. )
		switch ( sizeBytes ) {
		case 1:
			// Calc MSB, if 1 value is negative so extend 1 into high byte,
			//	if 0 value is positive, high byte is already zero
			if ( val >> 7 ) { val |= 0xFF00; }
			sizeBytes = 2;
			break;
		case 3:
			// Calc MSB, if 1 value is negative so extend 1 into high byte of high word,
			//	if 0 value is positive, high byte of high word is already zero
			if ( val >> 7 ) { val |= 0xFF000000; }
			sizeBytes = 4;
			break;
		}
		
		bitmaskSize = (1 << sizeBytes * 8) - 1;
		
		// Write data to Stack top ( SS:SP )
		addr = ((this.SS.get() << 4) + ptrStack) - sizeBytes;//alert(addr);
		this.machine.dram.writeBytes(addr, val, sizeBytes);
		
		// Update Stack pointer
		this.ESP.set((ptrStack - sizeBytes) & bitmaskSize);
	};
	
	// Pop data off the Stack
	jemul8.x86CPU.prototype.popStack = function ( sizeBytes ) {
		// Pointer to top of Stack
		var ptrStack = this.ESP.get()
			, bitmaskSize, addr, res;
		
		// Sign-extend byte values to a round 2 or 4 bytes wide
		//	( NB: sizes 2 and 4 are left out as these are already ok. )
		switch ( sizeBytes ) {
		case 1:
			sizeBytes = 2;
			break;
		case 3:
			sizeBytes = 4;
			break;
		}
		
		bitmaskSize = (1 << sizeBytes * 8) - 1;
		
		// Read data from Stack top (SS:SP)
		addr = ((this.SS.get() << 4) + ptrStack);//alert(addr);
		res = this.machine.dram.readBytes(addr, sizeBytes);
		
		// Update Stack pointer
		this.ESP.set((ptrStack + sizeBytes) & bitmaskSize);
		
		return res;
	};
	
	/* ==== Exports ==== */
	
	/* ==== /Exports ==== */
});
