/*
 *	jsEmu - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: jsEmu ( x86 ) Main
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

// Scope encapsulator
new function () {
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
	// Emulated Motherboard / Mainboard inside the machine
	var motherboard;
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
		jsEmu.InitPrimaryModules();
		
		/* ========= Physical machine components & peripherals ========= */
		//	NB: these are provided in the hope of better simulating the operation
		//	of an x86 IBM-PC compatible machine. The physical equipment described
		//	here may be used in realistic simulations, eg. to depict computer data operations
		//	etc. on a picture of the inside of a computer.
		
		// Emulated IBM-compatible PC
		jsEmu.machine = machine = new jsEmu.x86IBM_PC();
		// Emulated Motherboard / Mainboard inside the machine
		jsEmu.motherboard = motherboard = new jsEmu.x86IBM_Motherboard();
		// Emulated x86 IA_32 CPU
		//	( based on an Intel 80486 / i486 )
		jsEmu.CPU = CPU = new jsEmu.x86CPU( "486" );
		// DRAM Banks and Controller
		jsEmu.DRAM = DRAM = new jsEmu.x86DRAM();
		// BIOS Flash chip, used to house the BIOS firmware
		jsEmu.flashBIOSChip = flashBIOSChip = new jsEmu.x86IBM_FlashBIOSChip();
		machine.CMOS = new jsEmu.IODevice.classes.CMOS();
		// Emulated BIOS
		//	( based on Phoenix BIOS )
		jsEmu.BIOS = BIOS = new jsEmu.x86BIOS( "Phoenix / jsEmu" );
		// Physical display monitor / adapter ( entire interface for simplicity )
		jsEmu.screen = screen = new jsEmu.Screen( document.getElementById("divScreen") );
		
		/* ====== Standard 102-key ( UK ) QWERTY keyboard ====== */
		// NB: most of these Int 16 XT scancodes may be obtained through String.charCodeAt(), however
		//	browsers are inconsistent with their returned values in some cases. For this
		//	emulator, guest systems MUST be sent the correct scan codes, so we use an
		//	explicit list of actual scan codes to ensure this is the case.
		// NB: The 3rd parameter is the JavaScript keyCode reported for each key;
		//	in most cases this will equal the low byte of the Scan Code ( 2nd parameter )
		//	however it is faster to simply store both values separately, rather than apply logic at
		//	runtime to decide whether the key may be interpreted in this way or not
		jsEmu.keyboard = new jsEmu.Keyboard();
		jsEmu.keyboard.AddKey(new jsEmu.Key( "Esc", 0x011B, 0x1B ));
		
		jsEmu.keyboard.AddKey(new jsEmu.Key( "`", 0x2960, 0xDF ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "1", 0x0231, 0x31 ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "2", 0x0332, 0x32 ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "3", 0x0433, 0x33 ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "4", 0x0534, 0x34 ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "5", 0x0635, 0x35 ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "6", 0x0736, 0x36 ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "7", 0x0837, 0x37 ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "8", 0x0938, 0x38 ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "9", 0x0A39, 0x39 ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "0", 0x0B30, 0x30 ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "-", 0x0C2D, 0x6D ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "=", 0x0D3D, 0x6B ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "Backspace", 0x0E08, 0x08 ));
		
		jsEmu.keyboard.AddKey(new jsEmu.Key( "Tab", 0x0F09, 0x09 ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "Q", 0x1071, 0x51 ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "W", 0x1177, 0x57 ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "E", 0x1265, 0x45 ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "R", 0x1372, 0x52 ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "T", 0x1474, 0x54 ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "Y", 0x1579, 0x59 ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "U", 0x1675, 0x55 ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "I", 0x1769, 0x49 ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "O", 0x186F, 0x4F ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "P", 0x1970, 0x50 ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "[", 0x1A5B, 0xDB ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "]", 0x1B5D, 0xDD ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "Enter", 0x1C0D, 0x0D ));
		
		//jsEmu.keyboard.AddKey(new jsEmu.Key( "CapsLock", 30 ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "A", 0x1E61, 0x41 ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "S", 0x1F73, 0x53 ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "D", 0x2064, 0x44 ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "F", 0x2166, 0x46 ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "G", 0x2267, 0x47 ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "H", 0x2368, 0x48 ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "J", 0x246A, 0x4A ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "K", 0x256B, 0x4B ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "L", 0x266C, 0x4C ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( ";", 0x273B, 0x3B ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "'", 0x2837, 0xC0 ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "#", 0x2837, 0xDE ));
		
		jsEmu.keyboard.AddKey(new jsEmu.Key( "Left Shift", 0x2A00, 0x10 ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "\\", 0x2B5C, 0xDC ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "Z", 0x2C7A, 0x5A ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "X", 0x2D78, 0x58 ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "C", 0x2E63, 0x43 ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "V", 0x2F76, 0x56 ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "B", 0x3062, 0x42 ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "N", 0x316E, 0x4E ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "M", 0x326D, 0x4D ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( ",", 0x332C, 0xBC ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( ".", 0x342E, 0xBE ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "/", 0x352F, 0xBF ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "Right Shift", 0x3600, 0x10 ));
		
		jsEmu.keyboard.AddKey(new jsEmu.Key( "Left Ctrl", 0x1D00, 0x11 ));
		//jsEmu.keyboard.AddKey(new jsEmu.Key( "Left Alt", 60 ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "Space", 0x3920, 0x20 ));
		//jsEmu.keyboard.AddKey(new jsEmu.Key( "Right Alt (Gr)", 62 ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "Right Ctrl", 0x1D00, 0x11 ));
		
		jsEmu.keyboard.AddKey(new jsEmu.Key( "Ins", 0x5200, 0x2D ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "Home", 0x4700, 0x24 ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "PgUp", 0x4900, 0x21 ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "Delete", 0x5300, 0x2E ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "End", 0x4F00, 0x23 ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "PgDn", 0x5100, 0x22 ));
		
		jsEmu.keyboard.AddKey(new jsEmu.Key( "Up Arrow", 0x4800, 0x26 ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "Left Arrow", 0x4B00, 0x25 ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "Down Arrow", 0x5000, 0x28 ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "Right Arrow", 0x4D00, 0x27 ));
		
		jsEmu.keyboard.AddKey(new jsEmu.Key( "Keypad /", 0x352F, 0x6F ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "Keypad *", 0x372A, 0x6A ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "Keypad -", 0x4A2D, 0x6D00 ));
		jsEmu.keyboard.AddKey(new jsEmu.Key( "Keypad +", 0x4E2B, 0x6B00 ));
		
		//jsEmu.keyboard.AddKey(new jsEmu.Key( "PrtScrn", 0x0000 ));
		/* ====== /Standard 102-key ( UK ) QWERTY keyboard ====== */
		
		// Small onboard speaker ( eg. for BIOS POST beep codes )
		jsEmu.speakerOnboard = new jsEmu.Speaker();
		
		// Create & Install first available Floppy drive, floppy0
		machine.floppy0 = new jsEmu.FloppyDrive( 0 );
		// Create Floppy boot disk & insert into drive
		machine.floppy0.InsertDisk(new jsEmu.FloppyDisk( "DOS5", "asm/boot.img" )); //
		/* ========= /Physical machine components & peripherals ========= */
		
		jsEmu.DeferredModuleLoaders( machine, motherboard, CPU, flashBIOSChip, BIOS, DRAM );
		
		/* ====== Physical machine setup ====== */
		// Motherboard is the main board inside the machine
		machine.InstallComponent(motherboard);
		// CPU is installed onto a socket on the motherboard
		motherboard.InstallComponent(CPU);
		// Flash BIOS chip is installed on the motherboard
		motherboard.InstallComponent(flashBIOSChip);
		// BIOS firmware is flashed/written onto the Flash BIOS chip
		flashBIOSChip.FlashBIOSFirmware(BIOS);
		// All x86 CPUs use the same basic registers; see this function
		CPU.InstallStandardRegisters();
		// DRAM Banks & Controller are installed onto the motherboard
		motherboard.InstallComponent(DRAM);
		// DRAM Chips are installed into the DRAM banks
		for ( var idx16KBank = 0 ; idx16KBank < num16KBanks ; ++idx16KBank ) {
			DRAM.InstallComponent(new jsEmu.x86DRAM_16KChip());
		}
		// After installing DRAM chips the memory can be initialised
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
			screen.AddPage(new jsEmu.ScreenPage( idx_page, numRows, numCols, offsetVideo + sizePage_Bytes * idx_page ));
		}
		screen.SetActivePage(0);
		
		// Initialise Keyboard & its Controller
		jsEmu.keyboard.Init();
		/* ====== /Physical machine setup ====== */
		
		// Set up Emulator to initialise Modules, etc.
		jsEmu.InitSecondaryModules( machine, motherboard, CPU, flashBIOSChip, BIOS, DRAM );
		
		// Perform standard BIOS POST
		//BIOS.PerformPOST();
		
		// Reset CPU to initial power-up state, ready for boot
		CPU.Reset();
		//throw "Boot BIOS???";
		
		top.status = "Started...";
		//alert("Start");
		
		//console.profile();
		//var start = new Date().getTime();
		// Run the CPU - start Fetch-Decode-Execute cycles ( will not block )
		CPU.Exec();
		//document.title = new Date().getTime() - start + "ms";
		//console.profileEnd();
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
		jsEmu.Assert(val == (val & ((1 << num * 8) - 1)), "WriteBytes :: Value is greater in bytes than size");
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
	
}