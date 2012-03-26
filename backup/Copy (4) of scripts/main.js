/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: jemul8 ( x86 ) Main
 */

/* ======= Data from experiments ======= */
/*
	- in Chrome & Firefox, while( 1 ){...} is slower than while( true ){...}
		( probably due to the necessary conversion of 1 -> boolean )
		( in Firefox, the difference is not proportional to test loop length, so FF is probably only converting once )
	- Tracemonkey ( Firefox ) is unable to optimise for( ;; ){...}, but can optimise while(true){...}
	- TM is able to convert ( eg. for if() condition ) an object to a truthy or falsey value faster than using !!obj,
		it is also faster at eg. " if ( obj ) { ... } " than preconverting the object to a boolean ( eg. b = !!obj ) outside the test loop ( :S )
		( Chrome is the opposite - preconversion is ( logically ) faster - but overall slower than TM )
	
*/
/* ======= /Data from experiments ======= */

// Set up the jQuery plugin
new jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("main", function ( $ ) {
	/* ==== Malloc ==== */
	
	// System RAM - 1MB limit for now
	var num16KBanks = 64;
	
	/* ========= Physical machine components & peripherals ========= */
	//	NB: these are provided in the hope of better simulating the operation
	//	of an x86 IBM-PC compatible machine. The physical equipment described
	//	here may be used in realistic simulations, eg. to depict computer data operations
	//	etc. on a picture of the inside of a computer.
	// Emulated IBM-compatible PC
	var machine;
	// Emulated x86 IA_32 CPU
	//	( based on an Intel 80486 / i486 )
	var CPU;
	// BIOS Flash chip, used to house the BIOS firmware
	var flashBIOSChip;
	// Emulated BIOS
	//	( based on Phoenix BIOS )
	var BIOS;
	// DRAM Banks and Controller
	var DRAM;
	// Physical monitor display adapter
	var screen;
	/* ========= /Physical machine components & peripherals ========= */
	/* ==== /Malloc ==== */
	
	// Load sequence
	window.onload = function () {
		/* ==== Malloc ==== */
		var arr_bytMBR;
		/* ==== /Malloc ==== */
		
		// Set up Emulator to initialise Modules, etc.
		jemul8.InitPrimaryModules();
		
		/* ========= Physical machine components & peripherals ========= */
		//	NB: these are provided in the hope of better simulating the operation
		//	of an x86 IBM-PC compatible machine. The physical equipment described
		//	here may be used in realistic simulations, eg. to depict computer data operations
		//	etc. on a picture of the inside of a computer.
		
		// Emulated IBM-compatible PC
		jemul8.machine = machine = new jemul8.x86IBM_PC();
		// Set up the I/O device subsystem as early as possible
		jemul8.IODevice.Init();
		// Emulated x86 IA_32 CPU
		//	( based on an Intel 80486 / i486 )
		machine.CPU = CPU = new jemul8.x86CPU( "486" );
		// DRAM Controller
		machine.DRAM = DRAM = new jemul8.x86DRAM();
		// BIOS Flash chip, used to house the BIOS firmware
		machine.flashBIOSChip = flashBIOSChip = new jemul8.x86IBM_FlashBIOSChip();
		machine.CMOS = new jemul8.IODevice.classes.CMOS();
		machine.PIC = new jemul8.IODevice.classes.PIC();
		// Emulated BIOS
		//	( based on Phoenix BIOS )
		machine.BIOS = BIOS = new jemul8.x86BIOS( "Phoenix / jemul8" );
		// Physical display monitor / adapter ( entire interface for simplicity )
		machine.screen = screen = new jemul8.Screen( document.getElementById("divScreen") );
		
		/* ====== Standard 102-key ( UK ) QWERTY keyboard ====== */
		// NB: most of these Int 16 XT scancodes may be obtained through String.charCodeAt(), however
		//	browsers are inconsistent with their returned values in some cases. For this
		//	emulator, guest systems MUST be sent the correct scan codes, so we use an
		//	explicit list of actual scan codes to ensure this is the case.
		// NB: The 3rd parameter is the JavaScript keyCode reported for each key;
		//	in most cases this will equal the low byte of the Scan Code ( 2nd parameter )
		//	however it is faster to simply store both values separately, rather than apply logic at
		//	runtime to decide whether the key may be interpreted in this way or not
		machine.keyboard = new jemul8.Keyboard();
		machine.keyboard.AddKey(new jemul8.Key( "Esc", 0x011B, 0x1B ));
		
		machine.keyboard.AddKey(new jemul8.Key( "`", 0x2960, 0xDF ));
		machine.keyboard.AddKey(new jemul8.Key( "1", 0x0231, 0x31 ));
		machine.keyboard.AddKey(new jemul8.Key( "2", 0x0332, 0x32 ));
		machine.keyboard.AddKey(new jemul8.Key( "3", 0x0433, 0x33 ));
		machine.keyboard.AddKey(new jemul8.Key( "4", 0x0534, 0x34 ));
		machine.keyboard.AddKey(new jemul8.Key( "5", 0x0635, 0x35 ));
		machine.keyboard.AddKey(new jemul8.Key( "6", 0x0736, 0x36 ));
		machine.keyboard.AddKey(new jemul8.Key( "7", 0x0837, 0x37 ));
		machine.keyboard.AddKey(new jemul8.Key( "8", 0x0938, 0x38 ));
		machine.keyboard.AddKey(new jemul8.Key( "9", 0x0A39, 0x39 ));
		machine.keyboard.AddKey(new jemul8.Key( "0", 0x0B30, 0x30 ));
		machine.keyboard.AddKey(new jemul8.Key( "-", 0x0C2D, 0x6D ));
		machine.keyboard.AddKey(new jemul8.Key( "=", 0x0D3D, 0x6B ));
		machine.keyboard.AddKey(new jemul8.Key( "Backspace", 0x0E08, 0x08 ));
		
		machine.keyboard.AddKey(new jemul8.Key( "Tab", 0x0F09, 0x09 ));
		machine.keyboard.AddKey(new jemul8.Key( "Q", 0x1071, 0x51 ));
		machine.keyboard.AddKey(new jemul8.Key( "W", 0x1177, 0x57 ));
		machine.keyboard.AddKey(new jemul8.Key( "E", 0x1265, 0x45 ));
		machine.keyboard.AddKey(new jemul8.Key( "R", 0x1372, 0x52 ));
		machine.keyboard.AddKey(new jemul8.Key( "T", 0x1474, 0x54 ));
		machine.keyboard.AddKey(new jemul8.Key( "Y", 0x1579, 0x59 ));
		machine.keyboard.AddKey(new jemul8.Key( "U", 0x1675, 0x55 ));
		machine.keyboard.AddKey(new jemul8.Key( "I", 0x1769, 0x49 ));
		machine.keyboard.AddKey(new jemul8.Key( "O", 0x186F, 0x4F ));
		machine.keyboard.AddKey(new jemul8.Key( "P", 0x1970, 0x50 ));
		machine.keyboard.AddKey(new jemul8.Key( "[", 0x1A5B, 0xDB ));
		machine.keyboard.AddKey(new jemul8.Key( "]", 0x1B5D, 0xDD ));
		machine.keyboard.AddKey(new jemul8.Key( "Enter", 0x1C0D, 0x0D ));
		
		//machine.keyboard.AddKey(new jemul8.Key( "CapsLock", 30 ));
		machine.keyboard.AddKey(new jemul8.Key( "A", 0x1E61, 0x41 ));
		machine.keyboard.AddKey(new jemul8.Key( "S", 0x1F73, 0x53 ));
		machine.keyboard.AddKey(new jemul8.Key( "D", 0x2064, 0x44 ));
		machine.keyboard.AddKey(new jemul8.Key( "F", 0x2166, 0x46 ));
		machine.keyboard.AddKey(new jemul8.Key( "G", 0x2267, 0x47 ));
		machine.keyboard.AddKey(new jemul8.Key( "H", 0x2368, 0x48 ));
		machine.keyboard.AddKey(new jemul8.Key( "J", 0x246A, 0x4A ));
		machine.keyboard.AddKey(new jemul8.Key( "K", 0x256B, 0x4B ));
		machine.keyboard.AddKey(new jemul8.Key( "L", 0x266C, 0x4C ));
		machine.keyboard.AddKey(new jemul8.Key( ";", 0x273B, 0x3B ));
		machine.keyboard.AddKey(new jemul8.Key( "'", 0x2837, 0xC0 ));
		machine.keyboard.AddKey(new jemul8.Key( "#", 0x2837, 0xDE ));
		
		machine.keyboard.AddKey(new jemul8.Key( "Left Shift", 0x2A00, 0x10 ));
		machine.keyboard.AddKey(new jemul8.Key( "\\", 0x2B5C, 0xDC ));
		machine.keyboard.AddKey(new jemul8.Key( "Z", 0x2C7A, 0x5A ));
		machine.keyboard.AddKey(new jemul8.Key( "X", 0x2D78, 0x58 ));
		machine.keyboard.AddKey(new jemul8.Key( "C", 0x2E63, 0x43 ));
		machine.keyboard.AddKey(new jemul8.Key( "V", 0x2F76, 0x56 ));
		machine.keyboard.AddKey(new jemul8.Key( "B", 0x3062, 0x42 ));
		machine.keyboard.AddKey(new jemul8.Key( "N", 0x316E, 0x4E ));
		machine.keyboard.AddKey(new jemul8.Key( "M", 0x326D, 0x4D ));
		machine.keyboard.AddKey(new jemul8.Key( ",", 0x332C, 0xBC ));
		machine.keyboard.AddKey(new jemul8.Key( ".", 0x342E, 0xBE ));
		machine.keyboard.AddKey(new jemul8.Key( "/", 0x352F, 0xBF ));
		machine.keyboard.AddKey(new jemul8.Key( "Right Shift", 0x3600, 0x10 ));
		
		machine.keyboard.AddKey(new jemul8.Key( "Left Ctrl", 0x1D00, 0x11 ));
		//machine.keyboard.AddKey(new jemul8.Key( "Left Alt", 60 ));
		machine.keyboard.AddKey(new jemul8.Key( "Space", 0x3920, 0x20 ));
		//machine.keyboard.AddKey(new jemul8.Key( "Right Alt (Gr)", 62 ));
		machine.keyboard.AddKey(new jemul8.Key( "Right Ctrl", 0x1D00, 0x11 ));
		
		machine.keyboard.AddKey(new jemul8.Key( "Ins", 0x5200, 0x2D ));
		machine.keyboard.AddKey(new jemul8.Key( "Home", 0x4700, 0x24 ));
		machine.keyboard.AddKey(new jemul8.Key( "PgUp", 0x4900, 0x21 ));
		machine.keyboard.AddKey(new jemul8.Key( "Delete", 0x5300, 0x2E ));
		machine.keyboard.AddKey(new jemul8.Key( "End", 0x4F00, 0x23 ));
		machine.keyboard.AddKey(new jemul8.Key( "PgDn", 0x5100, 0x22 ));
		
		machine.keyboard.AddKey(new jemul8.Key( "Up Arrow", 0x4800, 0x26 ));
		machine.keyboard.AddKey(new jemul8.Key( "Left Arrow", 0x4B00, 0x25 ));
		machine.keyboard.AddKey(new jemul8.Key( "Down Arrow", 0x5000, 0x28 ));
		machine.keyboard.AddKey(new jemul8.Key( "Right Arrow", 0x4D00, 0x27 ));
		
		machine.keyboard.AddKey(new jemul8.Key( "Keypad /", 0x352F, 0x6F ));
		machine.keyboard.AddKey(new jemul8.Key( "Keypad *", 0x372A, 0x6A ));
		machine.keyboard.AddKey(new jemul8.Key( "Keypad -", 0x4A2D, 0x6D00 ));
		machine.keyboard.AddKey(new jemul8.Key( "Keypad +", 0x4E2B, 0x6B00 ));
		
		//machine.keyboard.AddKey(new jemul8.Key( "PrtScrn", 0x0000 ));
		/* ====== /Standard 102-key ( UK ) QWERTY keyboard ====== */
		
		// Small onboard speaker ( eg. for BIOS POST beep codes )
		jemul8.speakerOnboard = new jemul8.Speaker();
		
		// Create & Install first available Floppy drive, floppy0
		machine.floppy0 = new jemul8.FloppyDrive( 0 );
		// Create Floppy boot disk & insert into drive
		machine.floppy0.InsertDisk(new jemul8.FloppyDisk( "DOS5", "asm/boot.img" )); //
		/* ========= /Physical machine components & peripherals ========= */
		
		jemul8.DeferredModuleLoaders( machine, CPU, DRAM );
		
		/* ==== Call I/O devices' .Init() method ==== */
		machine.CMOS.Init();
		machine.PIC.Init();
		/* ==== /Call I/O devices' .Init() method ==== */
		
		/* ====== Physical machine setup ====== */
		// BIOS firmware is flashed/written onto the Flash BIOS chip
		flashBIOSChip.FlashBIOSFirmware(BIOS);
		// All x86 CPUs use the same basic registers; see this function
		CPU.InstallStandardRegisters();
		// Now, memory can be initialised
		DRAM.InitialiseController();
		
		var numCols = 80;
		var numRows = 25;
		// Colour display video starts at B800h:0000h ( for monochrome,
		//	we would change to B000h:0000h )
		var segmentVideo = 0xB800;
		// Change to absolute offset
		var offsetVideo = segmentVideo << 4;
		// Calculate size ( in bytes ) of a Page
		//	( eg. 80 cols * 25 rows * 2 bytes/char = 4000 bytes/page )
		var sizePage_Bytes = numCols * numRows * 2;
		// 80x25 screen, 8 pages
		for ( var idx_page = 0 ; idx_page < 8 ; ++idx_page ) {
			screen.AddPage(new jemul8.ScreenPage( idx_page, numRows, numCols, offsetVideo + sizePage_Bytes * idx_page ));
		}
		screen.setActivePage(0);
		
		// Initialise Keyboard & its Controller
		machine.keyboard.Init();
		/* ====== /Physical machine setup ====== */
		
		// Set up Emulator to initialise Modules, etc.
		jemul8.InitSecondaryModules( machine, CPU, DRAM );
		
		// Reset CPU to initial power-up state, ready for boot
		CPU.Reset();
		
		top.status = "Started...";
		
		// Run the CPU - start Fetch-Decode-Execute cycles ( will not block )
		CPU.exec();
	};
	
	// Read data from an arbitrary memory array
	function ReadBytes( arr_data, addr, num ) {
		// Use size of operand to determine how many bytes to read
		switch ( num ) {
		case 1:	// Byte ( 8-bit )
			return arr_data[addr];
		case 2:	// Word ( 16-bit )
			return (arr_data[addr + 1] << 8) | (arr_data[addr]);
		case 4:	// Dword ( 32-bit )
			return (arr_data[addr + 3] << 24) | (arr_data[addr + 2] << 16) | (arr_data[addr + 1] << 8) | (arr_data[addr]);
		default:
			throw new Error( "ReadBytes :: Operand size > 32-bit not supported" );
		}
	}
	// Write data to an arbitrary memory array
	function WriteBytes( arr_data, addr, val, num ) {
		/* ==== Guards ==== */
		jemul8.Assert(val == (val & ((1 << num * 8) - 1)), "WriteBytes :: Value is greater in bytes than size");
		/* ==== /Guards ==== */
		
		// Use size of operand to determine how many bytes to write
		switch ( num ) {
		case 1:	// Byte ( 8-bit )
			arr_data[addr	] = val;
			return;
		case 2:	// Word ( 16-bit )
			arr_data[addr	] = val & 0x00FF;
			arr_data[addr + 1] = val & 0xFF00;
			return;
		case 4:	// Dword ( 32-bit )
			arr_data[addr	] = val & 0x000000FF;
			arr_data[addr + 1] = val & 0x0000FF00;
			arr_data[addr + 2] = val & 0x00FF0000;
			arr_data[addr + 3] = val & 0xFF000000;
			return;
		default:
			throw new Error( "WriteBytes :: Operand size > 32-bit not supported" );
		}
	}
	
});
