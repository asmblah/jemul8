/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: Stack support
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("cpu/instruction/stack", function ( $ ) { "use strict";
	var x86Emu = this.data("x86Emu");
	
	// Stack Address Size is determined by the address-size attribute of the Stack Segment
	x86Emu.x86CPU.prototype.getStackAddressSize = function () {
		return 16;
	};
	// Push data onto the Stack
	x86Emu.x86CPU.prototype.pushStack = function ( val, len ) {//debugger;
		/* ==== Malloc ==== */
		// Get pointer to top of Stack
		var ptrStack = this.ESP.get();
		var bitmaskSize;
		/* ==== /Malloc ==== */
		
		if ( len === 0 ) { debugger; }
		
		// Sign-extend byte values to a round 2 or 4 bytes wide
		//	( NB: sizes 2 and 4 are left out as these are already ok. )
		switch ( len ) {
		case 1:
			// Calc MSB, if 1 value is negative so extend 1 into high byte,
			//	if 0 value is positive, high byte is already zero
			if ( val >> 7 ) { val |= 0xFF00; }
			len = 2;
			break;
		case 3:
			// Calc MSB, if 1 value is negative so extend 1 into high byte of high word,
			//	if 0 value is positive, high byte of high word is already zero
			if ( val >> 7 ) { val |= 0xFF000000; }
			len = 4;
			break;
		}
		
		bitmaskSize = x86Emu.generateMask(len);
		
		// Decrement by operand size
		ptrStack = (ptrStack - len) & bitmaskSize;
		
		// Update Stack pointer
		this.ESP.set(ptrStack);
		
		// Write data to Stack top (SS:SP)
		//this.accessorWrite.writeBytes(
		//	(this.SS.get() << 4) + ptrStack, val, len);
		
		this.SS.writeSegment(ptrStack, val, len);
	};
	
	// Pop data off the Stack
	x86Emu.x86CPU.prototype.popStack = function ( len ) {
		// Pointer to top of Stack
		var ptrStack = this.ESP.get();
		var bitmaskSize;
		var res;
		
		// Sign-extend byte values to a round 2 or 4 bytes wide
		//	( NB: sizes 2 and 4 are left out as these are already ok. )
		switch ( len ) {
		case 1:
			len = 2;
			break;
		case 3:
			len = 4;
			break;
		}
		
		bitmaskSize = x86Emu.generateMask(len);
		
		// Read data from Stack top ( SS:SP )
		//res = this.accessorRead.readBytes((this.SS.get() << 4) + ptrStack, len);
		res = this.SS.readSegment(ptrStack, len);
		
		// Increment by operand size
		ptrStack = (ptrStack + len) & bitmaskSize;
		
		// Update Stack pointer
		this.ESP.set(ptrStack);
		
		return res;
	};
	
	/* ==== Exports ==== */
	
	/* ==== /Exports ==== */
});
