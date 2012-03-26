/*
 *	jsEmu - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: jsEmu ( x86) Main
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
		jsEmu.CPU = CPU = new jsEmu.x86CPU("486");
		// BIOS Flash chip, used to house the BIOS firmware
		jsEmu.flashBIOSChip = flashBIOSChip = new jsEmu.x86IBM_FlashBIOSChip();
		// Emulated BIOS
		//	( based on Phoenix BIOS )
		jsEmu.BIOS = BIOS = new jsEmu.x86BIOS("Phoenix / jsEmu");
		// DRAM Banks and Controller
		jsEmu.DRAM = DRAM = new jsEmu.x86DRAM();
		/* ========= /Physical machine components & peripherals ========= */
		
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
		/* ====== /Physical machine setup ====== */
		
		// Set up Emulator to initialise Modules, etc.
		jsEmu.InitSecondaryModules( machine, motherboard, CPU, flashBIOSChip, BIOS, DRAM );
		
		// Download disk/volume image to boot
		arr_bytMBR = jsEmu.GetSyncHTTP_Binary("boot.bin");
		
		// Initialise emulated BIOS
		BIOS.Init();
		
		// Load x86 MBR image
		BIOS.LoadMBR(arr_bytMBR);
		
		//console.profile();
		// Run the CPU - start fetch/execute cycle
		CPU.Exec();
		//console.profileEnd();
		
		/*CPU.EAX.Set(0xF000FF16);
		console.log("EAX = " + CPU.EAX.Get().toString(16));
		console.log("AX = " + CPU.AX.Get().toString(16));
		console.log("AH = " + CPU.AH.Get().toString(16));
		console.log("AL = " + CPU.AL.Get().toString(16));
		
		CPU.EAX.Set(0x00000000);
		console.log("EAX = " + CPU.EAX.Get().toString(16));
		console.log("AX = " + CPU.AX.Get().toString(16));
		console.log("AH = " + CPU.AH.Get().toString(16));
		console.log("AL = " + CPU.AL.Get().toString(16));
		
		CPU.AH.Set(0xFF+2);
		console.log("EAX = " + CPU.EAX.Get().toString(16));
		console.log("AX = " + CPU.AX.Get().toString(16));
		console.log("AH = " + CPU.AH.Get().toString(16));
		console.log("AL = " + CPU.AL.Get().toString(16));
		
		CPU.EFLAGS.Set(0);
		console.log("CF = " + CPU.CF.Get().toString(16));
		console.log("PF = " + CPU.PF.Get().toString(16));
		console.log("AF = " + CPU.AF.Get().toString(16));
		console.log("ZF = " + CPU.ZF.Get().toString(16));
		
		CPU.AF.Set();
		CPU.ZF.Set();
		console.log("CF = " + CPU.CF.Get().toString(16));
		console.log("PF = " + CPU.PF.Get().toString(16));
		console.log("AF = " + CPU.AF.Get().toString(16));
		console.log("ZF = " + CPU.ZF.Get().toString(16));
		return;
		*/
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
	
	/*
	function Exec( js ) {
		// Run it, using CPU object as context
		//	to expose register variables etc.
		with ( CPU ) {
			
			eval(js);
		}
	}*/
	
	
	
	
}