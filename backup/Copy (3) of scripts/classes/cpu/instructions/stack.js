/*
 *	jsEmu - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: Stack support
 */
var mod = new jsEmu.SecondaryModule( function ( jsEmu, machine, motherboard, CPU, FlashBIOSChip, BIOS, DRAM ) {
	
	// Stack Address Size is determined by the address-size attribute of the Stack Segment
	jsEmu.x86CPU.prototype.GetStackAddressSize = function () {
		return 16;
	};
	// Push data onto the Stack
	jsEmu.x86CPU.prototype.PushStack = function ( val, sizeBytes ) {//debugger;
		/* ==== Malloc ==== */
		// Get pointer to top of Stack
		var ptrStack = CPU.ESP.Get();
		var bitmaskSize;
		/* ==== /Malloc ==== */
		
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
		
		// Decrement by operand size
		ptrStack = (ptrStack - sizeBytes) & bitmaskSize;
		
		// Update Stack pointer
		CPU.ESP.Set(ptrStack);
		
		// Write data to Stack top ( SS:SP )
		DRAM.WriteBytes((CPU.SS.Get() << 4) + ptrStack, val, sizeBytes);
	};
	
	// Pop data off the Stack
	//	( defaults to 2 bytes )
	jsEmu.x86CPU.prototype.PopStack = function ( sizeBytes ) {//debugger;
		if ( !sizeBytes ) sizeBytes = 2;
		
		/* ==== Malloc ==== */
		// Get pointer to top of Stack
		var ptrStack = CPU.ESP.Get();
		var bitmaskSize;
		var res;
		/* ==== /Malloc ==== */
		
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
		
		// Read data from Stack top ( SS:SP )
		res = DRAM.ReadBytes((CPU.SS.Get() << 4) + ptrStack, sizeBytes);
		
		// Increment by operand size
		ptrStack = (ptrStack + sizeBytes) & bitmaskSize;
		
		// Update Stack pointer
		CPU.ESP.Set(ptrStack);
		
		return res;
	};
	
	/* ==== Exports ==== */
	
	/* ==== /Exports ==== */
});

// Add Module to emulator
jsEmu.AddModule(mod);