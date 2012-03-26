/*
 *	jsEmu - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: HLE ( High-Level Emulation ) CPU Interrupts support
 *		( NB: many of these are BIOS-registered, but kept here for simplicity )
 */
var mod = new jsEmu.SecondaryModule( function ( jsEmu, machine, motherboard, CPU, FlashBIOSChip, BIOS, DRAM ) {
	/* ==== Malloc ==== */
	var seg = 0xFFFF;
	var offset = 0x0000;
	var baseBIOS = (seg << 4) + offset;
	var base;
	/* ==== /Malloc ==== */
	// Internal emulated native JS interrupt handlers for BIOS and CPU
	//	( NB - emulator knows to lookup in this hash because an unmodified Interrupt Vector Table entry
	//	will have a segment:offset address of 0000h:0000h; this is invalid as it points inside the IVT itself. )
	jsEmu.x86CPU.prototype.arr_mapAbsoluteOffset_ToHLEInterruptHandler = hsh = {};
	// ( Hypervisor special ) Guest OS restart
	base = baseBIOS + 0x00;
	DRAM.WriteBytes(base, 0xF4, 1);	// HLT ( Redirected -> Hypervisor call )
	hsh[base] = function () {
		alert("Guest OS would restart now...");
		this.HypervisorReturn();
	};
	// ( CPU ) Divide by Zero
	base = baseBIOS + 0x00 + 1;
	DRAM.WriteBytes(base, 0xF4, 1);	// HLT ( Redirected -> Hypervisor call )
	hsh[base] = function () {
		throw new Error( "CPU interrupt 'Divide by Zero' - unsupported." );
		this.HypervisorReturn();
	};
	// ( CPU ) Single step
	base = baseBIOS + 0x01 + 1;
	DRAM.WriteBytes(base, 0xF4, 1);	// HLT ( Redirected -> Hypervisor call )
	hsh[base] = function () {
		throw new Error( "CPU interrupt 'Single step' - unsupported." );
		this.HypervisorReturn();
	};
	// ( CPU ) Non-maskable Interrupt ( NMI )
	base = baseBIOS + 0x02 + 1;
	DRAM.WriteBytes(base, 0xF4, 1);	// HLT ( Redirected -> Hypervisor call )
	hsh[base] = function () {
		throw new Error( "CPU interrupt 'Non-maskable interrupt/NMI' - unsupported." );
		this.HypervisorReturn();
	};
	// ( CPU ) Breakpoint Instruction
	base = baseBIOS + 0x03 + 1;
	DRAM.WriteBytes(base, 0xF4, 1);	// HLT ( Redirected -> Hypervisor call )
	hsh[base] = function () {
		throw new Error( "CPU interrupt 'Breakpoint instruction' - unsupported." );
		this.HypervisorReturn();
	};
	// ( CPU ) Overflow Instruction
	base = baseBIOS + 0x04 + 1;
	DRAM.WriteBytes(base, 0xF4, 1);	// HLT ( Redirected -> Hypervisor call )
	hsh[base] = function () {
		throw new Error( "CPU interrupt 'Overflow instruction' - unsupported." );
		this.HypervisorReturn();
	};
	// ( BIOS/Software ) Print Screen
	base = baseBIOS + 0x05 + 1;
	DRAM.WriteBytes(base, 0xF4, 1);	// HLT ( Redirected -> Hypervisor call )
	hsh[base] = function () {
		throw new Error( "BIOS interrupt 'Print Screen' - unsupported." );
		this.HypervisorReturn();
	};
	// IRQ1 - Keyboard Data Ready - Data received from keyboard controller
	base = baseBIOS + 0x09 + 1;
	DRAM.WriteBytes(base, 0xF4, 1);	// HLT ( Redirected -> Hypervisor call )
	hsh[base] = function () {
		/* ===== Ctrl-Break ===== */
		if ( 0 ) {
			// Clear keyboard buffer
			// Place word 0000h in buffer
			// Invoke INT 1Bh
			// Set flag at 0040h:0071h
		/* ===== /Ctrl-Break ===== */
		/* ===== SysReq ===== */
		} else if ( 0 ) {
			// Invoke INT 15h/AH=85h
			//	( do nothing - for terminal emulation )
			CPU.AH.Set(0x85);
			CPU.Interrupt(0x15);
		/* ===== /SysReq ===== */
		/* ===== Ctrl-NumLock ===== */
		} else if ( 0 ) {
			// Place system in a tight wait loop until next INT 09
		/* ===== /Ctrl-NumLock ===== */
		/* ===== Ctrl-Alt-Del ===== */
		} else if ( 0 ) {
			// Put 1234h ( warm boot ) in reset flag at 0040h:0072h
			// Jump to BIOS startup code ( F000h:FFF0h )
			DRAM.WriteBytes((0x0040 << 4) + 0x0072, 0x1234, 2);
			CPU.CS.Set(0xF000);
			CPU.EIP.Set(0x0000FFF0);	// Ensure high-word of EIP cleared
			/**** Don't call HypervisorReturn, we just changed CS & EIP ****/
			return;
		/* ===== /Ctrl-Alt-Del ===== */
		/* ===== Shift-PrtScrn ===== */
		} else if ( 0 ) {
			// Invoke INT 05h
			CPU.Interrupt(0x05);
		}
		/* ===== /Shift-PrtScrn ===== */
		this.HypervisorReturn();
	};
	// ( BIOS ) Video support
	base = baseBIOS + 0x10 + 1;
	DRAM.WriteBytes(base, 0xF4, 1);	// HLT ( Redirected -> Hypervisor call )
	hsh[base] = function () {
		/* ==== Malloc ==== */
		var charASCII;
		var pageActive;
		/* ==== /Malloc ==== */
		
		// AH is used to select a function to call for this Interrupt
		switch ( CPU.AH.Get() ) {
		// Teletype output
		case 0x0E:
			/*
			 *	Display a character on the screen, advancing the cursor
			 *	and scrolling the page as necessary; always writes to active page.
			 */
			// TODO: investigate if there is a faster way to convert from ASCII code -> char
			charASCII = CPU.AL.Get();
			pageActive = jsEmu.screen.GetActivePage();
			// Write character & advance cursor
			pageActive.WriteCharAtCursor(charASCII, true);
			break;
		// Unsupported Function of Interrupt
		default:
			
		}
		this.HypervisorReturn();
	};
	// ( BIOS ) Get Equipment List
	base = baseBIOS + 0x11 + 1;
	DRAM.WriteBytes(base, 0xF4, 1);	// HLT ( Redirected -> Hypervisor call )
	hsh[base] = function () {
		// BIOS equipment list word, as defined for emulator
		CPU.EAX.Set(wordEquipmentList);
		this.HypervisorReturn();
	};
	// (BIOS) Get Memory Size
	base = baseBIOS + 0x12 + 1;
	DRAM.WriteBytes(base, 0xF4, 1);	// HLT ( Redirected -> Hypervisor call )
	hsh[base] = function () {
		// The word at 0040h:0013h contains the number of kilobytes
		//	of contiguous memory starting at absolute address 00000h.
		CPU.AX.Set(ReadBytesRAM((0x0040 << 4) + 0x0013, 2));
		this.HypervisorReturn();
	};
	// Low Level Disk Services
	base = baseBIOS + 0x13 + 1;
	DRAM.WriteBytes(base, 0xF4, 1);	// HLT ( Redirected -> Hypervisor call )
	hsh[base] = function () {
		// AH is used to select a function to call for this Interrupt
		switch ( CPU.AH.Get() ) {
		// Reset Disk Drives
		case 0x00:
			/* ===== Input ===== */
			// DL is set to indicate the drive to reset:
			//	00h - 1st floppy disk ( drive A )
			//	01h - 2nd floppy disk ( drive B )
			//	80h - 1st hard disk
			//	81h - 2nd hard disk
			// ( If bit 7 is set, both floppy & hard disks reset )
			var drive = CPU.DL.Get();
			/* ===== /Input ===== */
			
			// Force controller to recalibrate drive heads ( seek to track 0 )
			// ...
			
			/* ==== Return ==== */
			BIOS.statusDiskLast = 0x00;
			// CF set on error, clear if no error
			CPU.CF.Clear();
			// AH return code
			CPU.AH.Set(BIOS.statusDiskLast);
			/* ==== /Return ==== */
			break;
		// Get Status of last operation
		case 0x01:
			/* ==== Return ==== */
			// AH return code - read stored last disk operation status
			CPU.AH.Set(BIOS.statusDiskLast);
			/* ==== /Return ==== */
			break;
		// Read Sectors from Drive into Memory
		case 0x02:
			/* ===== Input ===== */
			// AL - No. sectors to read
			var numSectors = CPU.AL.Get();
			// CH - Track
			var track = CPU.CH.Get();
			// CL - Sector
			var sector = CPU.CL.Get();
			// DH - Head
			var head = CPU.DH.Get();
			// DL - Drive
			var drive = CPU.DL.Get();
			// ES:BX - Buffer Address Pointer
			var addrBuffer = (CPU.ES.Get() << 4) + CPU.BX.Get();
			/* ===== /Input ===== */
			
			/* ==== Return ==== */
			BIOS.statusDiskLast = 0x00;
			// CF set on error, clear if no error
			CPU.CF.Clear();
			// AH return code
			CPU.AH.Set(BIOS.statusDiskLast);
			// AL - actual no. sectors read
			CPU.AL.Set(numSectors);
			/* ==== /Return ==== */
			break;
		// Verify Disk Sector(s)
		case 0x04:
			/* ===== Input ===== */
			// AL - No. sectors to verify
			var numSectors = CPU.AL.Get();
			// CH - Track
			var track = CPU.CH.Get();
			// CL - Sector
			var sector = CPU.CL.Get();
			// DH - Head
			var head = CPU.DH.Get();
			// DL - Drive
			var drive = CPU.DL.Get();
			// ES:BX - Buffer Address Pointer
			var addrBuffer = (CPU.ES.Get() << 4) + CPU.BX.Get();
			/* ===== /Input ===== */
			
			// Normally, this function does not compare the disk with memory, it merely
			//	checks whether the sector's stored CRC matches the data's actual CRC.
			// In the case of this emulator, we can safely assume the emulated memory image, located
			//	in the JavaScript VM's memory, is read from/written to correctly.
			
			/* ==== Return ==== */
			BIOS.statusDiskLast = 0x00;
			// CF set on error, clear if no error
			CPU.CF.Clear();
			// AH return code
			CPU.AH.Set(BIOS.statusDiskLast);
			// AL - actual no. sectors verified
			CPU.AL.Set(numSectors);
			/* ==== /Return ==== */
			break;
		// ( FLOPPY ) Format Track
		case 0x05:
			throw new Error( "Floppy format not supported yet." );
			break;
		// ( FIXED DISK ) Format Track
		//case 0x05:
		//	throw new Error( "Fixed-disk format not supported yet." );
		//	break;
		// ( FIXED DISK ) Format Track & set bad Sector flags
		case 0x06:
			throw new Error( "Fixed-disk format not supported yet." );
			break;
		// ( FIXED DISK ) Format Drive starting at given Track
		case 0x07:
			throw new Error( "Fixed-disk format not supported yet." );
			break;
		// ( FIXED DISK ) Format Drive starting at given Track
		case 0x07:
			throw new Error( "Fixed-disk format not supported yet." );
			break;
		// ( DISK ) Read Drive parameters
		case 0x08:
			/* ==== Return ==== */
			BIOS.statusDiskLast = 0x00;
			// CF set on error, clear if no error
			CPU.CF.Set();
			// AH return code
			CPU.AH.Set(BIOS.statusDiskLast);
			// DL - number of hard disk drives
			CPU.DL.Set(0x00);
			// DH - logical last index of heads ( number of heads minus one,
			//	because indexes start at 0 )
			CPU.DH.Set(0x00);
			// Logical last index of cylinders & sectors ( see func 02h )
			CPU.CX.Set(0x0000);
			/* ==== /Return ==== */
			break;
		// ( DISK ) Get Drive parameters
		case 0x13:
			throw new Error( "Disk not supported yet." );
			break;
		// Check Extensions Present
		case 0x41:
			/* ==== Return ==== */
			BIOS.statusDiskLast = 0x00;
			// CF set on not present, clear if present
			CPU.CF.Set();
			// AH return code
			CPU.AH.Set(BIOS.statusDiskLast);
			// BX - always this value ( why? )
			CPU.BX.Set(0xAA55);
			// Interface support bitmask:
			//	1 - Device Access using the packet structure
			//	2 - Drive Locking and Ejecting
			//	4 - Enhanced Disk Drive Support (EDD)
			CPU.AX.Set(0x0000);
			/* ==== /Return ==== */
			break;
		// Invalid/unsupported function
		default:
			debugger;
			throw new Error( "Unsupported or invalid Low Level Disk services function." );
		}
		this.HypervisorReturn();
	};
	// ( BIOS ) Serial
	base = baseBIOS + 0x14 + 1;
	DRAM.WriteBytes(base, 0xF4, 1);	// HLT ( Redirected -> Hypervisor call )
	hsh[base] = function () {
		this.HypervisorReturn();
	};
	// ( BIOS ) Keyboard
	base = baseBIOS + 0x16 + 1;
	DRAM.WriteBytes(base, 0xF4, 1);	// HLT ( Redirected -> Hypervisor call )
	hsh[base] = function () {
		/* ==== Malloc ==== */
		var codeScan;
		/* ==== /Malloc ==== */
		// AH is used to select a function to call for this Interrupt
		switch ( CPU.AH.Get() ) {
		// Get Keystroke; if none available, pause until one is
		case 0x00:
			// If no keystroke available, hang CPU and pause until a key stroke is available
			if ( !(codeScan = BIOS.KeyboardBuffer_GetKey()) ) {
				CPU.Halt();
				/* ====== When keystroke available, resume ====== */
				window.setTimeout( function () {
					// Still no keystroke
					if ( !(codeScan = BIOS.KeyboardBuffer_GetKey()) ) {
						window.setTimeout(arguments.callee, 100);
					// Keystroke is available now
					} else {
						CPU.Resume();
					}
				}, 100);
				/* ====== /When keystroke available, resume ====== */
				break;
			}
			
			break;
		}
		this.HypervisorReturn();
	};
	// 25 ( BIOS ) System - Bootstrap Loader
	base = baseBIOS + 0x19 + 1;
	DRAM.WriteBytes(base, 0xF4, 1);	// HLT ( Redirected -> Hypervisor call )
	hsh[base] = function () {
		/*
		 *	This interrupt reboots the system _WITHOUT_ clearing memory or restoring
		 *	interrupt vectors.  Because interrupt vectors are preserved, this
		 *	interrupt usually causes a system hang if any TSRs have hooked
		 *	vectors from 00h through 1Ch, particularly INT 08.
		 */
		
		/* ===== Input ===== */
		// For IBM BIOS CS:IP = 0000h:7C00h
		//	DH = access
		//	bits 7-6,4-0: don't care
		//	bit 5: =0 device supported by INT 13
		var access = CPU.DH.Get();
		//	DL = boot drive
		//	00h first floppy
		//	80h first hard disk
		var driveBoot = CPU.DL.Get();
		var lenBytes;
		var arr_bytMBR;
		/* ===== /Input ===== */
		
		// Boot from first Floppy
		if ( driveBoot == 0x00 ) {
			// Load 512 bytes for the Boot Sector from Sector 0 on Floppy Disk into DRAM at 7C00h
			machine.Floppy0.LoadBytesIntoDRAM(0x00000000, 0x00007C00, 512);
		// Boot from first Hard Disk
		} else if ( driveBoot == 0x80 ) {
			throw new Error( "No Hard Disk support yet." );
		}
		
		// Transfer control to loaded Boot Sector program
		CPU.CS.Set(0x0000);
		CPU.EIP.Set(0x00007C00);
		
		/**** Don't call HypervisorReturn, we just changed CS & EIP ****/
	};
	
	// Generate a CPU/software/hardware interrupt
	jsEmu.x86CPU.prototype.Interrupt = function ( num ) {
		/* ==== Malloc ==== */
		var IDTR = CPU.IDTR.Get();
		var addrIDT = IDTR >> 16;
		var sizeIDT = IDTR & 0xFFFF;
		// Calc offset as 4 bytes for every vector before this one
		var offsetVector = num * 4;
		var addrVector;
		/* ==== /Malloc ==== */
		
		// Check whether vector is out of bounds ( vector being read
		//	must be inside IDTR - its size is variable )
		if ( offsetVector > sizeIDT ) {
			throw new Error( "Interrupt vector is out of IDT range" );
		}
		
		/* ====== Save current FLAGS and CS:IP ( CPU state ) on stack ====== */
		CPU.PushStack(CPU.FLAGS.Get(), 2);
		CPU.IF.Clear();	// Disable any maskable interrupts
		CPU.TF.Clear();	// Disable any traps
		CPU.PushStack(CPU.CS.Get(), 2);
		CPU.PushStack(CPU.IP.Get(), 2);
		/* ====== /Save current FLAGS and CS:IP ( CPU state ) on stack ====== */
		
		addrVector = addrIDT + offsetVector;
		// Interrupt Handler code segment
		CPU.CS.Set(DRAM.ReadBytes(addrVector, 2));
		// Interrupt Handler IP offset in segment ( set EIP to quickly
		//	ensure high word of EIP is set to zero, rather than just setting IP )
		CPU.EIP.Set(DRAM.ReadBytes(addrVector + 2, 2));
	};
	
	// Similar to IRET Interrupt Return, except we do not restore (E)FLAGS register
	//	( in ASM this would be retf 2, the Immediate 2 signifying to pop the extra 2 bytes )
	jsEmu.x86CPU.prototype.HypervisorReturn = function () {
		// Perform IRET for internal Hypervisor code to restore CPU state
		//	 back to what it was doing before this Interrupt was generated
		//	NB: IRET not used here by internal Hypervisor Interrupt Service Routines, for speed
		//	as (E)FLAGS register never needs to be restored after their exec ( it is unaffected )
		//	Based on http://pdos.csail.mit.edu/6.828/2005/readings/i386/IRET.htm
		//if ( this.sizeOperand_Bytes === 2 ) {
			CPU.IP.Set(CPU.PopStack(2));
		//} else {
		//	CPU.EIP.Set(CPU.PopStack(4));
		//}
		CPU.CS.Set(CPU.PopStack(2));
		// Discard saved (E)FLAGS
		//if ( this.sizeOperand_Bytes === 2 ) {
			CPU.PopStack(2);
		//} else {
		//	CPU.PopStack(4);
		//}
	};
	
	/* ==== Exports ==== */
	
	/* ==== /Exports ==== */
});

// Add Module to emulator
jsEmu.AddModule(mod);