/*
 * jemul8 - JavaScript x86 Emulator
 *
 * MODULE: jemul8 (x86) Main
 *
 * ====
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/* ======= Data from experiments ======= */
/*
	- in Chrome & Firefox, while(1){...} is slower than while(true){...}
		(probably due to the necessary conversion of 1 -> boolean)
		(in Firefox, the difference is not proportional to test loop length, so FF is probably only converting once)
	- Tracemonkey (Firefox) is unable to optimise for(;;){...}, but can optimise while(true){...}
	- TM is able to convert ( eg. for if() condition ) an object to a truthy or falsey value faster than using !!obj,
		it is also faster at eg. " if (obj) { ... } " than preconverting the object to a boolean (eg. b = !!obj) outside the test loop (:S)
		(Chrome is the opposite - preconversion is ( logically) faster - but overall slower than TM )

*/
/* ======= /Data from experiments ======= */

/*jslint bitwise: true, plusplus: true */
/*global define, require */

define([
	"../util"
	, "./settings"
	, "./pc"
	, "./memory"
	, "./io"
	, "./cpu"
	, "./iodev/cmos"
	, "./iodev/dma"
	, "./iodev/fdc"
	, "./iodev/pic"
	, "./iodev/pit"
	, "./iodev/keyboard"
	, "./iodev/speaker"
	, "./iodev/vga"
	, "./iodev/guest2host"
], function (
	util, Settings, PC, Memory, IO, x86CPU, CMOS, DMA, FDC, PIC, PIT
	, KeyboardCntrlr, Speaker, VGA, Guest2Host
) {
    "use strict";
	var defaults = {
		"floppy0.driveType": "FDD_NONE"
		, "floppy0.diskType": "FLOPPY_NONE"
		, "floppy0.path": null
		, "floppy0.status": false

		, "floppy1.driveType": "FDD_NONE"
		, "floppy1.diskType": "FLOPPY_NONE"
		, "floppy1.path": null
		, "floppy1.status": false

		, "dma.maxQuantumsPerYield": 512
	};

	// x86 Emulator class constructor
	function jemul8(options) {
		util.assert(this && (this instanceof jemul8)
			, "jemul8 ctor :: error - constructor not called properly"
		);

		var //Key = jemul8.Key
			// Emulated IBM-compatible PC
			machine
			// Emulated x86 IA_32 CPU (based on an Intel 80486 / i486)
			, cpu
			, keyboard;

		// Load settings with defaults
		this.settings = new Settings(defaults);
		this.settings.load(options);

		/* ========= Physical machine components & peripherals ========= */
		//	NB: these are provided in the hope of better simulating the operation
		//	of an x86 IBM-PC compatible machine. The physical equipment described
		//	here may be used in realistic simulations, eg. to depict computer data operations
		//	etc. on a picture of the inside of a computer.

		// Emulated IBM-compatible PC
		this.machine = machine = new PC(this);
		// The memory subsystem
		machine.mem = new Memory(machine);
		// The I/O subsystem
		machine.io = new IO(machine);
		// Emulated x86 IA_32 CPU
		//	(based on an Intel 80486 / i486)
		machine.cpu = cpu = new x86CPU(machine, "486");

		// Set up the CPU's working parameters
		//	(IPS, yields/sec, ms/yield)
		cpu.configure(100000, 30, 20);

		// IO devices
		machine.cmos = new CMOS(machine);
		machine.dma = new DMA(machine); /*** NB: DMA module not finished yet! ***/
		machine.fdc = new FDC(machine);
		machine.pic = new PIC(machine);
		machine.pit = new PIT(machine);
		machine.keyboard = new KeyboardCntrlr(machine);
		// Small onboard speaker (eg. for BIOS POST beep codes)
		machine.speaker = new Speaker(machine);
		machine.vga = new VGA(machine); // Video card
		// Special Guest<->Host interface for emulation
		machine.guest2host = new Guest2Host(machine);

		/* ====== Standard 102-key (UK) QWERTY keyboard ======
		// NB: most of these Int 16 XT scancodes may be obtained through String.charCodeAt(), however
		//	browsers are inconsistent with their returned values in some cases. For this
		//	emulator, guest systems MUST be sent the correct scan codes, so we use an
		//	explicit list of actual scan codes to ensure this is the case.
		// NB: The 3rd parameter is the JavaScript keyCode reported for each key;
		//	in most cases this will equal the low byte of the Scan Code (2nd parameter)
		//	however it is faster to simply store both values separately, rather than apply logic at
		//	runtime to decide whether the key may be interpreted in this way or not
		machine.keyboard = keyboard = new jemul8.Keyboard(machine);
		keyboard.addKey(new Key("Esc", 0x011B, 0x1B));

		keyboard.addKey(new Key("`", 0x2960, 0xDF));
		keyboard.addKey(new Key("1", 0x0231, 0x31));
		keyboard.addKey(new Key("2", 0x0332, 0x32));
		keyboard.addKey(new Key("3", 0x0433, 0x33));
		keyboard.addKey(new Key("4", 0x0534, 0x34));
		keyboard.addKey(new Key("5", 0x0635, 0x35));
		keyboard.addKey(new Key("6", 0x0736, 0x36));
		keyboard.addKey(new Key("7", 0x0837, 0x37));
		keyboard.addKey(new Key("8", 0x0938, 0x38));
		keyboard.addKey(new Key("9", 0x0A39, 0x39));
		keyboard.addKey(new Key("0", 0x0B30, 0x30));
		keyboard.addKey(new Key("-", 0x0C2D, 0x6D));
		keyboard.addKey(new Key("=", 0x0D3D, 0x6B));
		keyboard.addKey(new Key("Backspace", 0x0E08, 0x08));

		keyboard.addKey(new Key("Tab", 0x0F09, 0x09));
		keyboard.addKey(new Key("Q", 0x1071, 0x51));
		keyboard.addKey(new Key("W", 0x1177, 0x57));
		keyboard.addKey(new Key("E", 0x1265, 0x45));
		keyboard.addKey(new Key("R", 0x1372, 0x52));
		keyboard.addKey(new Key("T", 0x1474, 0x54));
		keyboard.addKey(new Key("Y", 0x1579, 0x59));
		keyboard.addKey(new Key("U", 0x1675, 0x55));
		keyboard.addKey(new Key("I", 0x1769, 0x49));
		keyboard.addKey(new Key("O", 0x186F, 0x4F));
		keyboard.addKey(new Key("P", 0x1970, 0x50));
		keyboard.addKey(new Key("[", 0x1A5B, 0xDB));
		keyboard.addKey(new Key("]", 0x1B5D, 0xDD));
		keyboard.addKey(new Key("Enter", 0x1C0D, 0x0D));

		//keyboard.addKey(new Key("CapsLock", 30));
		keyboard.addKey(new Key("A", 0x1E61, 0x41));
		keyboard.addKey(new Key("S", 0x1F73, 0x53));
		keyboard.addKey(new Key("D", 0x2064, 0x44));
		keyboard.addKey(new Key("F", 0x2166, 0x46));
		keyboard.addKey(new Key("G", 0x2267, 0x47));
		keyboard.addKey(new Key("H", 0x2368, 0x48));
		keyboard.addKey(new Key("J", 0x246A, 0x4A));
		keyboard.addKey(new Key("K", 0x256B, 0x4B));
		keyboard.addKey(new Key("L", 0x266C, 0x4C));
		keyboard.addKey(new Key(";", 0x273B, 0x3B));
		keyboard.addKey(new Key("'", 0x2837, 0xC0));
		keyboard.addKey(new Key("#", 0x2837, 0xDE));

		keyboard.addKey(new Key("Left Shift", 0x2A00, 0x10));
		keyboard.addKey(new Key("\\", 0x2B5C, 0xDC));
		keyboard.addKey(new Key("Z", 0x2C7A, 0x5A));
		keyboard.addKey(new Key("X", 0x2D78, 0x58));
		keyboard.addKey(new Key("C", 0x2E63, 0x43));
		keyboard.addKey(new Key("V", 0x2F76, 0x56));
		keyboard.addKey(new Key("B", 0x3062, 0x42));
		keyboard.addKey(new Key("N", 0x316E, 0x4E));
		keyboard.addKey(new Key("M", 0x326D, 0x4D));
		keyboard.addKey(new Key(",", 0x332C, 0xBC));
		keyboard.addKey(new Key(".", 0x342E, 0xBE));
		keyboard.addKey(new Key("/", 0x352F, 0xBF));
		keyboard.addKey(new Key("Right Shift", 0x3600, 0x10));

		keyboard.addKey(new Key("Left Ctrl", 0x1D00, 0x11));
		//keyboard.addKey(new Key("Left Alt", 60));
		keyboard.addKey(new Key("Space", 0x3920, 0x20));
		//keyboard.addKey(new Key( "Right Alt (Gr)", 62 ));
		keyboard.addKey(new Key("Right Ctrl", 0x1D00, 0x11));

		keyboard.addKey(new Key("Ins", 0x5200, 0x2D));
		keyboard.addKey(new Key("Home", 0x4700, 0x24));
		keyboard.addKey(new Key("PgUp", 0x4900, 0x21));
		keyboard.addKey(new Key("Delete", 0x5300, 0x2E));
		keyboard.addKey(new Key("End", 0x4F00, 0x23));
		keyboard.addKey(new Key("PgDn", 0x5100, 0x22));

		keyboard.addKey(new Key("Up Arrow", 0x4800, 0x26));
		keyboard.addKey(new Key("Left Arrow", 0x4B00, 0x25));
		keyboard.addKey(new Key("Down Arrow", 0x5000, 0x28));
		keyboard.addKey(new Key("Right Arrow", 0x4D00, 0x27));

		keyboard.addKey(new Key("Keypad /", 0x352F, 0x6F));
		keyboard.addKey(new Key("Keypad *", 0x372A, 0x6A));
		keyboard.addKey(new Key("Keypad -", 0x4A2D, 0x6D00));
		keyboard.addKey(new Key("Keypad +", 0x4E2B, 0x6B00));

		//keyboard.addKey(new Key("PrtScrn", 0x0000));*/
		/* ====== /Standard 102-key (UK) QWERTY keyboard ====== */

		// Create & Install first available Floppy drive, floppy0
		//machine.floppy0 = new jemul8.FloppyDrive(machine, 0);
		// Create Floppy boot disk & insert into drive
		//machine.floppy0.insertDisk(new jemul8.FloppyDisk("DOS5", "asm/boot.img")); //
		/* ========= /Physical machine components & peripherals ========= */
	}
	util.extend(jemul8.prototype, {
		init: function (done, fail) {
			var cpu = this.machine.cpu;

			// Wait for hardware to initialise, then set up CPU
			this.initHardware(function () {
				cpu.init();
				done();
			}, fail);
		}, getSetting: function (name) {
			return this.settings.get(name);
		}, setSetting: function (name, val) {
			return this.settings.set(name, val);
		}, initHardware: function (done, fail) {
			var machine = this.machine;
			var pending = 0;
			var waiting = false;

			// Set up the memory subsystem
			machine.mem.init(doneOne(), failOne());

			// Set up the I/O subsystem
			machine.io.init(doneOne(), failOne());
			// Set up all I/O devices
			machine.cmos.init(doneOne(), failOne());
			machine.dma.init(doneOne(), failOne());
			machine.fdc.init(doneOne(), failOne());
			machine.pic.init(doneOne(), failOne());
			machine.pit.init(doneOne(), failOne());
			machine.keyboard.init(doneOne(), failOne());	// Init controller, keyboard & mouse
			machine.vga.init(doneOne(), failOne());			// Sort out VGABIOS, etc.
			machine.guest2host.init(doneOne(), failOne());	// Set up DEBUG_PORT, PANIC_PORT etc.

			// Enable A20 line & reset CPU and devices
			machine.reset(util.RESET_HARDWARE);

			waiting = true;

			function doneOne() {
				++pending;
				return oneDone;
			}
			function failOne() {
				return oneFailed;
			}
			function oneDone() {
				--pending;
				if (waiting && pending === 0) {
					done();
				}
			}
			function oneFailed() {
				--pending;
				if (waiting && pending === 0) {
					fail();
				}
			}
		}
	});
	// Start/resume the emulator
	jemul8.prototype.run = function () {
		// Start Fetch-Decode-Execute cycles (non-blocking)
		this.machine.cpu.run();
	};
	// Pause the emulator
	jemul8.prototype.pause = function () {
		this.machine.cpu.halt();
	};
	// Perform a reset of the system (does not resume automatically)
	jemul8.prototype.reset = function () {
		this.pause();
		this.machine.reset(util.RESET_HARDWARE);
	};
	jemul8.prototype.pressKey = function (scancode) {
		this.machine.keyboard.enqueueKey(scancode);
	};

	// Feature detection
	jemul8.support = (function () {
		// ArrayBuffers are used for efficient memory storage
		var typedArrays = ("ArrayBuffer" in self) && ("Uint8Array" in self);

		return {
			typedArrays: typedArrays
			, typedDataView: typedArrays && ("DataView" in self)
		};
	})();

	// Exports
	return jemul8;
});
