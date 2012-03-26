/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: HLE ( High-Level Emulation ) CPU Interrupts support
 *		( NB: many of these are BIOS-registered, but kept here for simplicity )
 */
var mod = new jemul8.SecondaryModule( function ( jemul8, machine, CPU, DRAM ) {
	/* ==== Malloc ==== */
	var seg = 0xFFFF;
	var offset = 0x0000;
	var reserved = 0xFF;	// Allow space for emulator-specific handlers
	var baseReserved = (seg << 4) + reserved;
	var baseBIOS = baseReserved + offset;
	var base;
	/* ==== /Malloc ==== */
	// Internal emulated native JS interrupt handlers for BIOS and CPU
	//	( NB - emulator knows to lookup in this hash because HLT is used as an escape. )
	jemul8.x86CPU.prototype.arr_mapAbsoluteOffset_ToHLEInterruptHandler = hsh = {};
	/* ====== Reserved / Hypervisor special ====== */
	// Guest OS restart
	base = baseReserved + 0x00;
	DRAM.WriteBytes(base, 0xF4, 1);	// HLT ( Redirected -> Hypervisor call )
	hsh[base] = function () {
		alert("Guest OS would restart now...");
		this.HypervisorReturn();
	};
	/* ====== /Reserved / Hypervisor special ====== */
	
	// ( CPU ) Divide by Zero
	base = baseBIOS + 0x00;
	DRAM.WriteBytes(base, 0xF4, 1);	// HLT ( Redirected -> Hypervisor call )
	hsh[base] = function () {
		throw new Error( "CPU interrupt 'Divide by Zero' - unsupported." );
		this.HypervisorReturn();
	};
	// ( CPU ) Single step
	base = baseBIOS + 0x01;
	DRAM.WriteBytes(base, 0xF4, 1);	// HLT ( Redirected -> Hypervisor call )
	hsh[base] = function () {
		throw new Error( "CPU interrupt 'Single step' - unsupported." );
		this.HypervisorReturn();
	};
	// ( CPU ) Non-maskable Interrupt ( NMI )
	base = baseBIOS + 0x02;
	DRAM.WriteBytes(base, 0xF4, 1);	// HLT ( Redirected -> Hypervisor call )
	hsh[base] = function () {
		throw new Error( "CPU interrupt 'Non-maskable interrupt/NMI' - unsupported." );
		this.HypervisorReturn();
	};
	// ( CPU ) Breakpoint Instruction
	base = baseBIOS + 0x03;
	DRAM.WriteBytes(base, 0xF4, 1);	// HLT ( Redirected -> Hypervisor call )
	hsh[base] = function () {
		throw new Error( "CPU interrupt 'Breakpoint instruction' - unsupported." );
		this.HypervisorReturn();
	};
	// ( CPU ) Overflow Instruction
	base = baseBIOS + 0x04;
	DRAM.WriteBytes(base, 0xF4, 1);	// HLT ( Redirected -> Hypervisor call )
	hsh[base] = function () {
		throw new Error( "CPU interrupt 'Overflow instruction' - unsupported." );
		this.HypervisorReturn();
	};
	// ( BIOS/Software ) Print Screen
	base = baseBIOS + 0x05;
	DRAM.WriteBytes(base, 0xF4, 1);	// HLT ( Redirected -> Hypervisor call )
	hsh[base] = function () {
		throw new Error( "BIOS interrupt 'Print Screen' - unsupported." );
		this.HypervisorReturn();
	};
	// IRQ1 - Keyboard Data Ready - Data received from keyboard controller
	base = baseBIOS + 0x09;
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
			CPU.AH.set(0x85);
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
			CPU.CS.set(0xF000);
			CPU.EIP.set(0x0000FFF0);	// Ensure high-word of EIP cleared
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
	base = baseBIOS + 0x10;
	DRAM.WriteBytes(base, 0xF4, 1);	// HLT ( Redirected -> Hypervisor call )
	hsh[base] = function () {
		/* ==== Malloc ==== */
		var charASCII;
		var pageActive;
		var addr;
		/* ==== /Malloc ==== */
		
		// AH is used to select a function to call for this Interrupt
		switch ( CPU.AH.get() ) {
		// Teletype output
		case 0x0E:
			/*
			 *	Display a character on the screen, advancing the cursor
			 *	and scrolling the page as necessary; always writes to active page.
			 */
			// TODO: investigate if there is a faster way to convert from ASCII code -> char
			charASCII = CPU.AL.get();
			pageActive = jemul8.screen.getActivePage();
			// Write character & advance cursor
			pageActive.WriteCharAtCursor(charASCII, true);
			//alert(charASCII);
			break;
		// Video - OAK VGA BIOS v1.02+ - Set Emulation
		case 0xFF:
			/* ====== ES:DI should contain the signature string "Calamity" ====== */
			addr = (CPU.ES.get() << 4) + CPU.DI.get();
			alert(String.fromCharCode(DRAM.Read1Byte(addr)) + String.fromCharCode(DRAM.Read1Byte(addr+1)) + String.fromCharCode(DRAM.Read1Byte(addr + 2)));
			/* ====== /ES:DI should contain the signature string "Calamity" ====== */
			
			// AL dictates the emulation type:
			switch ( CPU.AL.get() ) {
			// CGA emulation
			case 0x43:	// "C"
				break;
			// EGA emulation
			case 0x45:	// "E"
				break;
			// Hercules emulation
			case 0x4D:	// "M"
				break;
			// VGA emulation
			case 0x56:	// "V"
				break;
			}
			break;
		// Unsupported Function of Interrupt
		default:
			debugger;
			throw new Error( "Unsupported or invalid Video services function." );
		}
		this.HypervisorReturn();
	};
	// ( BIOS ) Get Equipment List
	base = baseBIOS + 0x11;
	DRAM.WriteBytes(base, 0xF4, 1);	// HLT ( Redirected -> Hypervisor call )
	hsh[base] = function () {
		// BIOS equipment list word, as defined for emulator
		CPU.EAX.set(BIOS.wordEquipmentList);
		this.HypervisorReturn();
	};
	// (BIOS) Get Memory Size
	base = baseBIOS + 0x12;
	DRAM.WriteBytes(base, 0xF4, 1);	// HLT ( Redirected -> Hypervisor call )
	hsh[base] = function () {
		// The word at 0040h:0013h contains the number of kilobytes
		//	of contiguous memory starting at absolute address 00000h.
		CPU.AX.set(DRAM.ReadBytes((0x0040 << 4) + 0x0013, 2));
		this.HypervisorReturn();
	};
	// Low Level Disk Services
	base = baseBIOS + 0x13;
	DRAM.WriteBytes(base, 0xF4, 1);	// HLT ( Redirected -> Hypervisor call )
	hsh[base] = function () {
		// AH is used to select a function to call for this Interrupt
		switch ( CPU.AH.get() ) {
		// Reset Disk Drives
		case 0x00:
			/* ===== Input ===== */
			// DL is set to indicate the drive to reset:
			//	00h - 1st floppy disk ( drive A )
			//	01h - 2nd floppy disk ( drive B )
			//	80h - 1st hard disk
			//	81h - 2nd hard disk
			// ( If bit 7 is set, both floppy & hard disks reset )
			var drive = CPU.DL.get();
			/* ===== /Input ===== */
			
			// Force controller to recalibrate drive heads ( seek to track 0 )
			// ...
			
			/* ==== Return ==== */
			BIOS.statusDiskLast = 0x00;
			// CF set on error, clear if no error
			CPU.CF.clear();
			// AH return code
			CPU.AH.set(BIOS.statusDiskLast);
			/* ==== /Return ==== */
			break;
		// Get Status of last operation
		case 0x01:
			/* ==== Return ==== */
			// AH return code - read stored last disk operation status
			CPU.AH.set(BIOS.statusDiskLast);
			/* ==== /Return ==== */
			break;
		// Read Sectors from Drive into Memory
		case 0x02:
			/* ===== Input ===== */
			// No. sectors to read
			var num_sector = CPU.AL.get();
			var cylinder = CPU.CH.get() | ((CPU.CL.get() << 2) & 0x300);
			var sector = (CPU.CL.get() & 0x3F);
			var head = CPU.DH.get();
			var drive = CPU.DL.get();
			// ES:BX - Buffer Address Pointer
			var addrBuffer = (CPU.ES.get() << 4) + CPU.BX.get();
			
			// Pull needed BPB data
			var num_head = machine.floppy0.getNumHeads();
			var num_sectorPerTrack = machine.floppy0.getSectorsPerTrack();
			var num_bytesPerSector = machine.floppy0.getBytesPerSector();
			
			// Logical Block Addressing ( absolute sector indexes )
			var addrLBA_Low;
			var addrLBA_High;
			/* ===== /Input ===== */
			
			/* ======= Validate ======= */
			if ( (num_sector > 128) || (num_sector == 0) || (sector == 0) ) {
				throw new Error( "Interrupt 0x13 ( harddisk ) :: function 0x02, parameters out of range" );
			}
			/* ======= /Validate ======= */
			
			// Calculate LBA info
			addrLBA_Low = (((cylinder * num_head) + head) * num_sectorPerTrack) + sector - 1;
			addrLBA_High = 0;
			sector = 0;
			
			machine.floppy0.LoadBytesIntoDRAM(addrLBA_Low * num_bytesPerSector, addrBuffer, num_bytesPerSector * num_sector);
			
			/**** TODO: calc actual num.sectors transferred & store in num_sector ****/
			
			/* ==== Return ==== */
			BIOS.statusDiskLast = 0x00;
			// CF set on error, clear if no error
			CPU.CF.clear();
			// AH return code
			CPU.AH.set(BIOS.statusDiskLast);
			// AL - actual no. sectors read
			CPU.AL.set(num_sector);
			/* ==== /Return ==== */
			break;
		// Verify Disk Sector(s)
		case 0x04:
			/* ===== Input ===== */
			// AL - No. sectors to verify
			var numSectors = CPU.AL.get();
			// CH - Track
			var track = CPU.CH.get();
			// CL - Sector
			var sector = CPU.CL.get();
			// DH - Head
			var head = CPU.DH.get();
			// DL - Drive
			var drive = CPU.DL.get();
			// ES:BX - Buffer Address Pointer
			var addrBuffer = (CPU.ES.get() << 4) + CPU.BX.get();
			/* ===== /Input ===== */
			
			// Normally, this function does not compare the disk with memory, it merely
			//	checks whether the sector's stored CRC matches the data's actual CRC.
			// In the case of this emulator, we can safely assume the emulated memory image, located
			//	in the JavaScript VM's memory, is read from/written to correctly.
			
			/* ==== Return ==== */
			BIOS.statusDiskLast = 0x00;
			// CF set on error, clear if no error
			CPU.CF.clear();
			// AH return code
			CPU.AH.set(BIOS.statusDiskLast);
			// AL - actual no. sectors verified
			CPU.AL.set(numSectors);
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
			CPU.CF.set();
			// AH return code
			CPU.AH.set(BIOS.statusDiskLast);
			// DL - number of hard disk drives
			CPU.DL.set(0x00);
			// DH - logical last index of heads ( number of heads minus one,
			//	because indexes start at 0 )
			CPU.DH.set(0x00);
			// Logical last index of cylinders & sectors ( see func 02h )
			CPU.CX.set(0x0000);
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
			CPU.CF.set();
			// AH return code
			CPU.AH.set(BIOS.statusDiskLast);
			// BX - always this value ( why? )
			CPU.BX.set(0xAA55);
			// Interface support bitmask:
			//	1 - Device Access using the packet structure
			//	2 - Drive Locking and Ejecting
			//	4 - Enhanced Disk Drive Support (EDD)
			CPU.AX.set(0x0000);
			/* ==== /Return ==== */
			break;
		// EZ-Drive - Installation Check
		case 0xFF:
			/*
			 *	EZ-Drive is a driver by Micro House that is loaded from the hard disk MBR,
			 *	replacing the ROM BIOS disk support, eg. adding LBA mode support,
			 *	and read/write multiple.
			 *	NB: Called by the Win95 Master Boot Record
			 */
			/* ===== Input ===== */
			var drive = CPU.DL.get();
			var textVersion = "01";
			/* ===== /Input ===== */
			
			/* ==== Return ==== */
			CPU.AX.set(0xAA55);
			// Standard text, with version number of EZ-Drive driver
			//DRAM.WriteString((CPU.ES.get() << 4) + CPU.BX.get(), "AERMH13V" + textVersion);
			// CF set on error, clear on success
			CPU.CF.clear();
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
	base = baseBIOS + 0x14;
	DRAM.WriteBytes(base, 0xF4, 1);	// HLT ( Redirected -> Hypervisor call )
	hsh[base] = function () {
		// AH is used to select a function to call for this Interrupt
		switch ( CPU.AH.get() ) {
		// Invalid/unsupported function
		default:
			debugger;
			throw new Error( "Unsupported or invalid Serial services function." );
		}
		this.HypervisorReturn();
	};
	// ( BIOS ) Keyboard
	base = baseBIOS + 0x16;
	DRAM.WriteBytes(base, 0xF4, 1);	// HLT ( Redirected -> Hypervisor call )
	hsh[base] = function () {
		/* ==== Malloc ==== */
		var codeScan;
		/* ==== /Malloc ==== */
		// AH is used to select a function to call for this Interrupt
		switch ( CPU.AH.get() ) {
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
						// AH is scan code, AL is ASCII character ( or zero if special function key )
						CPU.AX.set(codeScan);
						CPU.Resume();
					}
				}, 100);
				/* ====== /When keystroke available, resume ====== */
				break;
			}
			
			break;
		// Invalid/unsupported function
		default:
			debugger;
			throw new Error( "Unsupported or invalid Keyboard services function." );
		}
		this.HypervisorReturn();
	};
	// 25 ( BIOS ) System - Bootstrap Loader
	base = baseBIOS + 0x19;
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
		var access = CPU.DH.get();
		//	DL = boot drive
		//	00h first floppy
		//	80h first hard disk
		var driveBoot = CPU.DL.get();
		var lenBytes;
		var arr_bytMBR;
		/* ===== /Input ===== */
		
		// Boot from first Floppy
		if ( driveBoot === 0x00 ) {
			// Load 512 bytes for the Boot Sector from Sector 0 on Floppy Disk into DRAM at 7C00h
			machine.floppy0.LoadBytesIntoDRAM(0x00000000, 0x00007C00, 512);
		// Boot from first Hard Disk
		} else if ( driveBoot === 0x80 ) {
			throw new Error( "No Hard Disk support yet." );
		}
		
		// Transfer control to loaded Boot Sector program
		CPU.CS.set(0x0000);
		CPU.EIP.set(0x00007C00);
		
		/**** Don't call HypervisorReturn, we just changed CS & EIP ****/
	};
	
	// Generate a CPU/software/hardware interrupt
	jemul8.x86CPU.prototype.Interrupt = function ( num ) {
		/* ==== Malloc ==== */
		var IDTR = CPU.IDTR.get();
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
		CPU.PushStack(CPU.FLAGS.get(), 2);
		CPU.IF.clear();	// Disable any maskable interrupts
		CPU.TF.clear();	// Disable any traps
		CPU.PushStack(CPU.CS.get(), 2);
		CPU.PushStack(CPU.IP.get(), 2);
		/* ====== /Save current FLAGS and CS:IP ( CPU state ) on stack ====== */
		
		addrVector = addrIDT + offsetVector;
		// Interrupt Handler code segment
		CPU.CS.set(DRAM.ReadBytes(addrVector, 2));
		// Interrupt Handler IP offset in segment ( set EIP to quickly
		//	ensure high word of EIP is set to zero, rather than just setting IP )
		CPU.EIP.set(DRAM.ReadBytes(addrVector + 2, 2));
	};
	
	// Similar to IRET Interrupt Return, except we do not restore (E)FLAGS register
	//	( in ASM this would be retf 2, the Immediate 2 signifying to pop the extra 2 bytes )
	jemul8.x86CPU.prototype.HypervisorReturn = function () {
		// Perform IRET for internal Hypervisor code to restore CPU state
		//	 back to what it was doing before this Interrupt was generated
		//	NB: IRET not used here by internal Hypervisor Interrupt Service Routines, for speed
		//	as (E)FLAGS register never needs to be restored after their exec ( it is unaffected )
		//	Based on http://pdos.csail.mit.edu/6.828/2005/readings/i386/IRET.htm
		//if ( this.sizeOperand_Bytes === 2 ) {
			CPU.IP.set(CPU.PopStack(2));
		//} else {
		//	CPU.EIP.set(CPU.PopStack(4));
		//}
		CPU.CS.set(CPU.PopStack(2));
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
jemul8.AddModule(mod);