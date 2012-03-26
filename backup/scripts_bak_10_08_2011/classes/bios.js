/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: IBM-PC compatible BIOS firmware support
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("bios", function ( $ ) {
	var x86Emu = this.data("x86Emu");
	
	// Import system after setup
	var machine, CPU, DRAM;
	this.bind("load", function ( $, machine_, CPU_, DRAM_ ) {
		machine = machine_; CPU = CPU_; DRAM = DRAM_;
	});
	/* ============ /Import system after setup ============ */
	
	// IBM-compatible x86 BIOS firmware
	function x86BIOS( emu, name ) {
		this.emu = emu;
		
		this.name = name;
		// Status of last BIOS disk operation
		//	 ( 00h being success )
		this.statusDiskLast = 0x00;
		// Define BIOS' machine Equipment List word ( 16 bits wide )
		this.wordEquipmentList = new x86Emu.Bitfield( 16 );
		
		// Download & store BIOS firmware image
		this.memData = x86Emu.getSyncHTTP_Binary("docs/bochs-20100605/bios/BIOS-bochs-legacy");
	}
	// Prepare BIOS to be loaded ( no Northbridge emulation used so must be copied to DRAM )
	x86BIOS.prototype.prepare = function () {
		var cpu = this.machine.cpu
			, dram = this.machine.dram
		// Copy BIOS code into DRAM
		/*
		 *	( This removes the need to install addl. hooks
		 *	into the IO read logic for redirection -
		 *	normally the Northbridge would handle sending
		 *	requests to the flash BIOS instead of DRAM )
		 */
			, cache_segment = 0 //0xFFF00000;
			, segment = cpu.CS.get() // Should be 0xF000;
		// FIX 05/09: ROM loaded in this segment, but at offset zero!
		//	(First command in POST is at offset EIP though)
			, offset = 0
		// Bitshift reqd. to force integer interpretation
			, addrFlat = (cache_segment | (segment << 4) + offset) >>> 0
			, memData = this.memData, memData_DRAM = dram.memData
			, idx, len = memData.length;
		
		for ( idx = 0 ; idx < len ; ++idx ) {
			memData_DRAM[ addrFlat + idx ] = memData[ idx ];
		}
	};
	// Perform a Power-On Self Test ( POST ) for the emulated BIOS
	//	(eg. read values from motherboard switches / get memory size etc.)
	x86BIOS.prototype.PerformPOST = function () {
		/* ==== Malloc ==== */
		var seg, offset, base
			, cpu = this.machine.cpu
			, dram = this.machine.dram;
		/* ==== /Malloc ==== */
		
		/* ==== Malloc ==== */
		var numFloppies = 1;
		var is80x87CoprocessorInstalled = 0;
		// Legacy - only for original IBM-PC, leave at zero should be safe
		var num16K_RAMBanks_Onboard = 0;
		// 00h - EGA, VGA or PGA
		// 01h - 40x25 colour
		// 10h - 80x25 colour
		// 11h - 80x25 monochrome
		var modeVideoInitial = 0x10;
		// DMA support ( only for PCjr, Tandy 1400LT )
		var isDMASupportInstalled = 0;
		// Number of serial/COM ports installed
		var numSerialPortsInstalled = 0;
		// Game port installed ?
		var isGamePortInstalled = 0;
		// Internal modem installed ?
		var isInternalModemInstalled = 0;
		// Number of parallel/LPT ports installed
		var numParallelPortsInstalled = 0;
		/* ==== /Malloc ==== */
		
		/* ==== Set up Equipment List Word ==== */
		// TODO: support the 2nd byte's info
		// Floppy disks installed ( number specified by bits 7 - 6 )
		this.wordEquipmentList.setBits(0, numFloppies > 0 ? 1 : 0, 1);
		// 80x87 Math Coprocessor installed
		this.wordEquipmentList.setBits(1, is80x87CoprocessorInstalled ? 1 : 0, 1);
		// Number of 16K banks of RAM on motherboard
		this.wordEquipmentList.setBits(2, num16K_RAMBanks_Onboard, 2);
		// Initial Video mode
		this.wordEquipmentList.setBits(4, modeVideoInitial, 2);
		// Number of floppies installed less 1 ( if bit 0 set )
		this.wordEquipmentList.setBits(6, numFloppies > 1 ? numFloppies - 1 : 0, 2);
		// DMA support installed
		this.wordEquipmentList.setBits(8, isDMASupportInstalled, 1);
		// Number of serial ports installed - 0 is no ports, 1 is one port, etc.
		this.wordEquipmentList.setBits(9, numSerialPortsInstalled, 3);
		// Game port installed ?
		this.wordEquipmentList.setBits(12, isGamePortInstalled, 1);
		// Internal modem installed ?
		this.wordEquipmentList.setBits(13, isInternalModemInstalled, 1);
		// Number of parallel ports installed - 0 is 1 port, 1 is 2 ports, etc. ( always at least 1 port installed )
		this.wordEquipmentList.setBits(14, numParallelPortsInstalled, 2);
		/* ==== /Set up Equipment List Word ==== */
		
		/* ===== Load BIOS Data Area ===== */
		seg		= 0x0040;
		offset	= 0x0000;
		base = (seg << 4) + offset;
		// Base I/O address for Serial Port 1 ( COM 1 )
		dram.WriteBytes(base + 0x00, 0x0000, 2);
		// Base I/O address for Serial Port 2 ( COM 2 )
		dram.WriteBytes(base + 0x02, 0x0000, 2);
		// Base I/O address for Serial Port 3 ( COM 3 )
		dram.WriteBytes(base + 0x04, 0x0000, 2);
		// Base I/O address for Serial Port 4 ( COM 4 )
		dram.WriteBytes(base + 0x06, 0x0000, 2);
		// Base I/O address for Parallel Port 1 ( LPT 1 )
		dram.WriteBytes(base + 0x08, 0x0000, 2);
		// Base I/O address for Parallel Port 2 ( LPT 2 )
		dram.WriteBytes(base + 0x0A, 0x0000, 2);
		// Base I/O address for Parallel Port 3 ( LPT 3 )
		dram.WriteBytes(base + 0x0C, 0x0000, 2);
		// Base I/O address for Parallel Port 4 ( LPT 4 )
		dram.WriteBytes(base + 0x0E, 0x0000, 2);
		// Equipment List Word
		dram.WriteBytes(base + 0x10, this.wordEquipmentList.get(), 2);
		// Interrupt Flag - Manufacturing test ( function of this is unknown... )
		dram.WriteBytes(base + 0x12, 0x00, 1);
		// Word at 0040h:0013h contains no. of kilobytes of contiguous memory available
		dram.WriteBytes(base + 0x13, dram.getAvailableRAMKilobytes(), 2);
		// Adapter memory size ( function of this is unknown... video adapter? )
		dram.WriteBytes(base + 0x15, 0x0000, 2);
		// Keyboard shift flags 1:
		/*
		 *	Bit 7 - Insert is on(1) or off(0)
		 *	Bit 6 - CapsLock is on(1) or off(0)
		 *	Bit 5 - NumLock is on(1) or off(0)
		 *	Bit 4 - ScrollLock is on(1) or off(0)
		 *	Bit 3 - Alt key is down(1) or up(0)
		 *	Bit 2 - Ctrl key is down(1) or up(0)
		 *	Bit 1 - Left Shift key is down(1) or up(0)
		 *	Bit 0 - Right Shift is down(1) or up(0)
		 */
		dram.WriteBytes(base + 0x17, 0x00, 1);
		// Keyboard shift flags 2:
		/*
		 *	Bit 7 - Insert key is down(1) or up(0)
		 *	Bit 6 - CapsLock key is down(1) or up(0)
		 *	Bit 5 - NumLock key is down(1) or up(0)
		 *	Bit 4 - ScrollLock key is down(1) or up(0)
		 *	Bit 3 - Pause key is active(1) or inactive(0)
		 *	Bit 2 - SysReq key is down(1) or up(0)
		 *	Bit 1 - Left Alt key is down(1) or up(0)
		 *	Bit 0 - Right Alt is down(1) or up(0)
		 */
		dram.WriteBytes(base + 0x18, 0x00, 1);
		// Alt Numpad work area
		dram.WriteBytes(base + 0x19, 0x00, 1);
		// Pointer ( segment 0000h ) to the address of the next character in the keyboard buffer ( default: start of buffer )
		dram.WriteBytes(base + 0x1A, 0x041E, 2);
		// Pointer ( segment 0000h ) to the address of the last character in the keyboard buffer ( default: start of buffer )
		dram.WriteBytes(base + 0x1C, 0x041E, 2);
		// Default position of Keyboard buffer ( 32 bytes, 2 bytes per entry = max. 16 keys )
		/**** Keyboard buffer ****/
		// Floppy disk drive calibration status
		/*
		 *	Bit 7-4 - Reserved
		 *	Bit 3 - Floppy Drive 3 is calibrated(1) or not calibrated(0)
		 *	Bit 2 - Floppy Drive 2 is calibrated(1) or not calibrated(0)
		 *	Bit 1 - Floppy Drive 1 is calibrated(1) or not calibrated(0)
		 *	Bit 0 - Floppy Drive 0 is calibrated(1) or not calibrated(0)
		 */
		dram.WriteBytes(base + 0x3E, 0x00, 1);
		// Floppy disk drive motor status
		/*
		 *	Bit 7 - Current operation, read/verify(0) or write/format(1)
		 *	Bit 6 - Not used
		 *	Bit 5-4 - Drive select, 0(0) or Drive 1(1) or 2(2) or 4(3)
		 *	Bit 3 - Drive 3 motor, off(0) or on(1)
		 *	Bit 2 - Drive 2 motor, off(0) or on(1)
		 *	Bit 1 - Drive 1 motor, off(0) or on(1)
		 *	Bit 0 - Drive 0 motor, off(0) or on(1)
		 */
		dram.WriteBytes(base + 0x3F, 0x00, 1);
		// Floppy disk drive motor time-out
		dram.WriteBytes(base + 0x40, 0x00, 1);
		// Floppy disk drive status
		/*
		 *	Bit 7 - Drive ready status, ready(0) or not ready(1)
		 *	Bit 6 - Seek status, no seek error detected(0) or seek error detected(1)
		 *	Bit 5 - Floppy disk controller test, passed(0) or failed(1)
		 *	Bit 4-0 - Error codes:
		 *		0 - No errors
		 *		1 - Illegal function requested
		 *		2 - Address mark not found
		 *		3 - Write protect error
		 *		4 - Sector not found
		 *		6 - Diskette change line active
		 *		8 - DMA overrun
		 *		9 - DMA boundary error ( is this different from above? )
		 *		12 - Unknown media type
		 *		16 - CRC error during read
		 */
		dram.WriteBytes(base + 0x41, 0x00, 1);
		// Pointer ( segment 0000h ) to the start address of the keyboard buffer area ( default: start of buffer )
		dram.WriteBytes(base + 0x80, 0x041E, 2);
		// Pointer ( segment 0000h ) to the "end address of" / "last 2-byte word inside" the keyboard buffer ( default: end of buffer, = start + 32 bytes - 2 )
		dram.WriteBytes(base + 0x82, 0x043C, 2);
		/* ===== /Load BIOS Data Area ===== */
		
		/* ======= Set up Interrupt Descriptor Table ======= */
		// The Interrupt Vector Table for x86 processors is called the IDT;
		//	entries / "vectors" are stored in a segment:offset format,
		//	each of the 2 fields being 2 bytes in size, therefore each vector
		//	is 4 bytes wide. Calculating the offset of an address into the table,
		//	from an Interrupt number, is as simple as multiplying by 4.
		var segmentInterrupt = 0xFFFF;
		var offsetInterrupts = 0x0000;
		var reservedInterrupts = 0xFF;	// Allow space for emulator-specific interrupt handlers' code
		var baseIDT = 0x00000000;
		for ( var idx_vector = 0x00 ; idx_vector < 0xFF ; ++idx_vector ) {
			// Write Interrupt handler's segment to vector entry
			dram.WriteBytes(baseIDT + idx_vector * 4, segmentInterrupt, 2);
			// Write Interrupt handler's offset in segment to vector entry
			dram.WriteBytes(baseIDT + idx_vector * 4 + 2, idx_vector + reservedInterrupts + offsetInterrupts, 2);
		}
		/* ======= /Set up Interrupt Descriptor Table ======= */
		
		// Set Segments to align with code ( is this correct? )
		cpu.DS.set(0x7C0);
		cpu.ES.set(0x7C0);
		cpu.SS.set(0x7C0);
		
		// Last command of BIOS POST is to call INT 0x19
		//	to boot first available boot sector
		cpu.interrupt(0x19);
	};
	// Add a keystroke to the buffer, as stored in the BIOS data area
	//	( Although it may have been moved, see addrAreaStart & End below )
	x86BIOS.prototype.KeyboardBuffer_AddKey = function ( codeScan ) {
		var dram = this.machine.dram
		// Read pointer to head of keyboard buffer from BIOS data area
			, addrHead = dram.ReadBytes(0x041A, 2)
		// Read pointer to tail of keyboard buffer from BIOS data area
			, addrTail = dram.ReadBytes(0x041C, 2)
		// Read pointer to start of keyboard buffer AREA from BIOS data area
			, addrAreaStart = dram.ReadBytes(0x0480, 2)
		// Read pointer to end of keyboard buffer AREA from BIOS data area
			, addrAreaEnd = dram.ReadBytes(0x0482, 2)
		// Calculate size of area in bytes
			, sizeArea = addrAreaEnd - addrAreaStart
			, addrWriteTail;
		
		/* ===== Check there is space in buffer for key press ===== */
		// Move past inserted data
		addrAfterTail = addrTail + 2;
		
		// Head is before tail ( if they are equal, buffer is empty )
		if ( addrHead <= addrTail ) {
			// No space in buffer
			if ( addrAfterTail > addrAreaEnd ) {
				addrAfterTail -= sizeArea;
				// No space in buffer
				if ( addrAfterTail > addrHead ) {
					// Alert user with beep
					jemul8.speakerOnboard.Beep();
					return;
				}
			}
		// Head is after tail ( loop appears "reversed" )
		} else {
			// No space in buffer
			if ( addrAfterTail >= addrHead ) {
				// Alert user with beep
				jemul8.speakerOnboard.Beep();
				return;
			}
		}
		/* ===== /Check there is space in buffer for key press ===== */
		
		// Write/insert Scan Code word into keyboard buffer
		dram.WriteBytes(addrTail, codeScan, 2);
		
		// Write new tail pointer back to BIOS data area
		dram.WriteBytes(0x041C, addrAfterTail, 2);
	};
	// Get a keystroke from the buffer, as stored in the BIOS data area
	//	( Although it may have been moved, see addrAreaStart & End below )
	x86BIOS.prototype.KeyboardBuffer_GetKey = function () {
		/* ==== Malloc ==== */
		// Read pointer to head of keyboard buffer from BIOS data area
		var addrHead = dram.ReadBytes(0x041A, 2);
		// Read pointer to tail of keyboard buffer from BIOS data area
		var addrTail = dram.ReadBytes(0x041C, 2);
		// Read pointer to start of keyboard buffer AREA from BIOS data area
		var addrAreaStart = dram.ReadBytes(0x0480, 2);
		// Read pointer to end of keyboard buffer AREA from BIOS data area
		var addrAreaEnd = dram.ReadBytes(0x0482, 2);
		// Calculate size of area in bytes
		var sizeArea = addrAreaEnd - addrAreaStart;
		var addrWriteTail;
		var codeScan;
		/* ==== /Malloc ==== */
		
		/* ===== Check buffer is not empty ===== */
		if ( addrHead == addrTail ) {
			return 0x0000;
		}
		/* ===== /Check buffer is not empty ===== */
		
		// Read Scan Code word from keyboard buffer ( read from Head pointer )
		codeScan = dram.ReadBytes(addrHead, 2);
		
		// Write new head pointer back to BIOS data area
		dram.WriteBytes(0x041A, addrHead+2, 2);
		
		// 2-byte word Scan Code sent back
		return codeScan;
	};
	
	// Exports
	x86Emu.x86BIOS = x86BIOS;
});
