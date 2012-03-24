/*
 *	jsEmu - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: HLE ( High-Level Emulation ) CPU Interrupts support
 *		( NB: many of these are BIOS-registered, but kept here for simplicity )
 */
var mod = new jsEmu.SecondaryModule( function ( jsEmu, machine, motherboard, CPU, FlashBIOSChip, BIOS, DRAM ) {
	
	// Internal emulated native JS interrupt handlers for BIOS and CPU
	//	( NB - emulator knows to lookup in this hash because an unmodified Interrupt Vector Table entry
	//	will have a segment:offset address of 0000h:0000h; this is invalid as it points inside the IVT itself. )
	jsEmu.x86CPU.prototype.hsh_InterruptHandler = {
		// ( CPU ) Divide by Zero
		0x00: function () {
			throw new Error( "CPU interrupt 'Divide by Zero' - unsupported." );
		// ( CPU ) Single step
		}, 0x01: function () {
			throw new Error( "CPU interrupt 'Single step' - unsupported." );
		// ( CPU ) Non-maskable Interrupt ( NMI )
		}, 0x02: function () {
			throw new Error( "CPU interrupt 'Non-maskable interrupt/NMI' - unsupported." );
		// ( CPU ) Breakpoint Instruction
		}, 0x03: function () {
			throw new Error( "CPU interrupt 'Breakpoint instruction' - unsupported." );
		// ( CPU ) Overflow Instruction
		}, 0x04: function () {
			throw new Error( "CPU interrupt 'Overflow instruction' - unsupported." );
		// ( BIOS/Software ) Print Screen
		}, 0x04: function () {
			throw new Error( "BIOS interrupt 'Print Screen' - unsupported." );
		// ( BIOS ) Video support
		}, 0x10: function () {
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
				// Only advance cursor if character was actually written ( eg. not a carriage-return/linefeed )
				if ( pageActive.WriteCharAtCursor(charASCII)) {
					pageActive.AdvanceCursor(1);
				}
				break;
			// Unsupported Function of Interrupt
			default:
				
			}
		// ( BIOS ) Get Equipment List
		}, 0x11: function () {
			// BIOS equipment list word, as defined for emulator
			CPU.EAX.Set(wordEquipmentList);
		// (BIOS) Get Memory Size
		}, 0x12: function () {
			// The word at 0040h:0013h contains the number of kilobytes
			//	of contiguous memory starting at absolute address 00000h.
			CPU.AX.Set(ReadBytesRAM((0x0040 << 4) + 0x0013, 2));
		// Low Level Disk Services
		}, 0x13: function () {
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
				CPU.CF.Set();
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
		// ( BIOS ) SERIAL
		}, 0x14: function () {
			
		// 25 ( BIOS ) SYSTEM - BOOTSTRAP LOADER
		}, 0x19: function () {
			//===================
			// This interrupt reboots the system without clearing memory or restoring
			//	interrupt vectors.  Because interrupt vectors are preserved, this
			//	interrupt usually causes a system hang if any TSRs have hooked
			//	vectors from 00h through 1Ch, particularly INT 08.
			//===================
			
			// For IBM BIOS CS:IP = 0000h:7C00h
			//	DH = access
			//	bits 7-6,4-0: don't care
			//	bit 5: =0 device supported by INT 13
			//	DL = boot drive
			//	00h first floppy
			//	80h first hard disk
			
			CPU.CS.Set(0x0000);
			CPU.EIP.Set(0x7C00);
			
			// If booting from a floppy
			
		}
		
	};
	
	/* ==== Exports ==== */
	
	/* ==== /Exports ==== */
});

// Add Module to emulator
jsEmu.AddModule(mod);