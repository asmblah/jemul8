/*
 * jemul8 - JavaScript x86 Emulator
 *
 * MODULE: CMOS chip class support
 *
 *  See http://bochs.sourceforge.net/techspec/CMOS-reference.txt
 *
 * ====
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*jslint bitwise: true, plusplus: true */
/*global define, require */

define([
	"../../util",
	"../iodev",
	"../register",
	"../http"
], function (
	util,
	IODevice,
	Register,
	HTTP
) {
    "use strict";

	/* ====== Private ====== */

	/* ==== Const ==== */
	// Register addresses
	var REG_SEC                     = 0x00;
	var REG_SEC_ALARM               = 0x01;
	var REG_MIN                     = 0x02;
	var REG_MIN_ALARM               = 0x03;
	var REG_HOUR                    = 0x04;
	var REG_HOUR_ALARM              = 0x05;
	var REG_WEEK_DAY                = 0x06;
	var REG_MONTH_DAY               = 0x07;
	var REG_MONTH                   = 0x08;
	var REG_YEAR                    = 0x09;
	var REG_STAT_A                  = 0x0a;
	var REG_STAT_B                  = 0x0b;
	var REG_STAT_C                  = 0x0c;
	var REG_STAT_D                  = 0x0d;
	var REG_DIAGNOSTIC_STATUS       = 0x0e;  // Also has some alternative uses
	var REG_SHUTDOWN_STATUS         = 0x0f;
	var REG_EQUIPMENT_BYTE          = 0x14;
	var REG_CSUM_HIGH               = 0x2e;
	var REG_CSUM_LOW                = 0x2f;
	var REG_IBM_CENTURY_BYTE        = 0x32;  // Also has some alternative uses
	var REG_IBM_PS2_CENTURY_BYTE    = 0x37;  // Also has some alternative uses
	/* ==== /Const ==== */

	// Constructor / pre-init ( ie. from bx_cmos_c::bx_cmos_c(void) )
	function CMOS(machine) {
		util.assert(this && (this instanceof CMOS)
			, "CMOS constructor :: error - not called properly"
		);

		var idx, state, list_reg;

		util.info("CMOS (Intel XXXX?) PreInit");

		this.machine = machine;

		// CMOS's current state information
		state = this.state = {
			timerPeriodic: null
			, intervalPeriodicUsecs: 0

			, timerOneSecond: null
			, timerUIP: null
			, time: 0	// Current time
			, addrMemory: 0
			, modeRTC_12Hour: null
			, modeRTC_Binary: null
			, timeChange: 0

			, list_reg: []
		};
		list_reg = state.list_reg;

		/* ==== Set up registers ==== */
		for (idx = 0 ; idx < 128 ; ++idx) {
			list_reg[ idx ] = new Register("R_" + idx, 1);
		}

		state.regSec = list_reg[ REG_SEC ];
		state.regSecAlarm = list_reg[ REG_SEC_ALARM ];
		state.regMin = list_reg[ REG_MIN ];
		state.regMinAlarm = list_reg[ REG_MIN_ALARM ];
		state.regHour = list_reg[ REG_HOUR ];
		state.regHourAlarm = list_reg[ REG_HOUR_ALARM ];
		state.regWeekDay = list_reg[ REG_WEEK_DAY ];
		state.regMonthDay = list_reg[ REG_MONTH_DAY ];
		state.regMonth = list_reg[ REG_MONTH ];
		state.regYear = list_reg[ REG_YEAR ];
		state.regStatA = list_reg[ REG_STAT_A ];
		state.regStatB = list_reg[ REG_STAT_B ];
		state.regStatC = list_reg[ REG_STAT_C ];
		state.regStatD = list_reg[ REG_STAT_D ];
		state.regDiagnosticStatus = list_reg[ REG_DIAGNOSTIC_STATUS ];	// Also has some alternative uses
		state.regShutdownStatus = list_reg[ REG_SHUTDOWN_STATUS ];
		state.regEquipmentByte = list_reg[ REG_EQUIPMENT_BYTE ];
		state.regCSumHigh = list_reg[ REG_CSUM_HIGH ];
		state.regCSumLow = list_reg[ REG_CSUM_LOW ];
		state.regIBMCenturyByte = list_reg[ REG_IBM_CENTURY_BYTE ];		// Also has some alternative uses
		state.regIBM_PS2CenturyByte = list_reg[ REG_IBM_PS2_CENTURY_BYTE ];	// Also has some alternative uses

		/* Bochs CMOS map
		 *
		 * Idx  Len   Description
		 * 0x10   1   floppy drive types
		 * 0x11   1   configuration bits
		 * 0x12   1   harddisk types
		 * 0x13   1   advanced configuration bits
		 * 0x15   2   base memory in 1k
		 * 0x17   2   memory size above 1M in 1k
		 * 0x19   2   extended harddisk types
		 * 0x1b   9   harddisk configuration (hd0)
		 * 0x24   9   harddisk configuration (hd1)
		 * 0x2d   1   boot sequence (fd/hd)
		 * 0x30   2   memory size above 1M in 1k
		 * 0x34   2   memory size above 16M in 64k
		 * 0x38   1   eltorito boot sequence (#3) + bootsig check
		 * 0x39   2   ata translation policy (ata0...ata3)
		 * 0x3d   1   eltorito boot sequence (#1 + #2)
		 *
		 * Qemu CMOS map
		 *
		 * Idx  Len   Description
		 * 0x5b   3   extra memory above 4GB
		 * 0x5f   1   number of processors
		 */
		/* ==== /Set up registers ==== */
	}
	// Methods based on Bochs' /iodev/cmos.h & cmos.cc
	util.inherit(CMOS, IODevice, "CMOS"); // Inheritance
	/*util.extend(CMOS, {
		// Register addresses
		REG_SEC:						0x00
		, REG_SEC_ALARM:				0x01
		, REG_MIN:						0x02
		, REG_MIN_ALARM:				0x03
		, REG_HOUR:						0x04
		, REG_HOUR_ALARM:				0x05
		, REG_WEEK_DAY:					0x06
		, REG_MONTH_DAY:				0x07
		, REG_MONTH:					0x08
		, REG_YEAR:						0x09
		, REG_STAT_A:					0x0a
		, REG_STAT_B:					0x0b
		, REG_STAT_C:					0x0c
		, REG_STAT_D:					0x0d
		, REG_DIAGNOSTIC_STATUS:		0x0e  // Also has some alternative uses
		, REG_SHUTDOWN_STATUS:			0x0f
		, REG_EQUIPMENT_BYTE:			0x14
		, REG_CSUM_HIGH:				0x2e
		, REG_CSUM_LOW:					0x2f
		, REG_IBM_CENTURY_BYTE:			0x32  // Also has some alternative uses
		, REG_IBM_PS2_CENTURY_BYTE:		0x37  // Also has some alternative uses
	});*/
	CMOS.prototype.init = function (done, fail) {
		var machine = this.machine;
		var state = this.state;

		// Download & store BIOS firmware image
		//this.machine.mem.loadROM(HTTP.get(
		//	"bios/amibios-56i112.bin"
		//), 0xE0000, 0);
		//this.machine.mem.loadROM(HTTP.get(
		//	"bios/seabios-bios.bin-1.6.3"
		//), 0xE0000, 0);
		//this.machine.mem.loadROM(HTTP.get(
		//	"docs/bochs-20100605/bios/BIOS-bochs-latest"
		//), 0xE0000, 0);
		HTTP.get(
			"docs/bochs-20100605/bios/BIOS-bochs-legacy"
			, function (path, buffer) {
				machine.mem.loadROM(buffer, 0xF0000, 0);
				done();
			}, function (path) {
				fail();
			}
		);

		// I/O port addresses used
		this.registerIO_Read(0x0070, "RAM", readHandler, 1);
		this.registerIO_Read(0x0071, "RAM", readHandler, 1);
		this.registerIO_Write(0x0070, "RAM", writeHandler, 1);
		this.registerIO_Write(0x0071, "RAM", writeHandler, 1);

		// Make a note that IRQ #8 is used by the Real-Time Clock
		this.registerIRQ(8, "RTC");

		this.setupTimers();

		// NB: In Bochs, there is support for local time,
		//	UTC time or a specified time: here, we just
		//	support local time for now.
		state.timeval = new Date();

		/* ==== Load CMOS ==== */
		// From image file
		if (0) {
			// Not yet supported.
		// Values generated
		} else {
			state.regStatA.set(0x26);
			state.regStatB.set(0x02);
			state.regStatC.set(0x00);
			state.regStatD.set(0x80);
			// Always support FPU for now (set bit in equipment byte)
			state.regEquipmentByte.set(state.regEquipmentByte.get() | 0x02);
			state.modeRTC_12Hour = 0;
			state.modeRTC_Binary = 0;
			this.updateClock();
		}
		/* ==== /Load CMOS ==== */
		state.timeChange = 0;
	};
    CMOS.prototype.setupTimers = function () {
		var machine = this.machine;
        var state = this.state;

        // Continuous, not active
		if (state.timerPeriodic === null) {
			state.timerPeriodic = machine.registerTimer(
                handlePeriodicTimer, this  // Callback & "this"
                , 1000000                  // Interval in us (1 sec)
                , true                     // Continuous
                , false                    // Not active
                , "CMOS"
            );
		}
        // Continuous, not active
		if (state.timerOneSecond === null) {
			state.timerOneSecond = machine.registerTimer(
                handleOneSecondTimer, this // Callback & "this"
                , 1000000                  // Interval in us (1 sec)
                , true                     // Continuous
                , false                    // Not active
                , "CMOS"
            );
		}
        // One-shot (not continuous), not active
		if (state.timerUIP === null) {
			state.timerUIP = machine.registerTimer(
                handleUIPTimer, this       // Callback & "this"
                , 244                      // Interval in us (244us)
                , false                    // Continuous?
                , false                    // Active?
                , "CMOS"
            );
		}
    };
	CMOS.prototype.reset = function (type) {
		var state = this.state;

		state.addrMemory = 0;

		/* RESET affects the following registers:
		 *  CRA: no effects
		 *  CRB: bits 4,5,6 forced to 0
		 *  CRC: bits 4,5,6,7 forced to 0
		 *  CRD: no effects
		 */
		state.regStatB.set(state.regStatB.get() & 0x8F);
		state.regStatC.set(0x00);

        // TEMP!!
        //util.warning("Temp hack in CMOS.reset()");
        //state.regStatB.set(state.regStatB.get() | (1 << 6));

		// One second timer for updating clock & alarm functions
		state.timerOneSecond.activate(1000000, true);

		this.CRA_Changed();
	};
	CMOS.prototype.saveImage = function () {
		var state = this.state;

		util.info("CMOS.saveImage :: Save not implemented yet.");
	};
	CMOS.prototype.registerState = function () {
		var state = this.state;

		// ?
	};
	CMOS.prototype.afterRestoreState = function () {
		var state = this.state;

		state.modeRTC_12Hour = ((state.regStatB.get() & 0x02) === 0);
		state.modeRTC_Binary = ((state.regStatB.get() & 0x04) !== 0);

		this.updateTimeVal();
		this.CRA_Changed();
	};
	CMOS.prototype.getReg = function (idx) {
		return this.state.list_reg[ idx ].get();
	};
	CMOS.prototype.setReg = function (idx, val) {
		this.state.list_reg[ idx ].set(val);
	};
	CMOS.prototype.installEquipment = function (bit) {
		this.state.regEquipmentByte.set(
			this.state.regEquipmentByte.get() | bit);
	};
	CMOS.prototype.getTimeVal = function () {
		return this.state.timeval;
	};
	CMOS.prototype.updateTimeVal = function () {
		var state = this.state;

		// ...
		//util.warning("CMOS.updateTimeVal() :: Not yet implemented");
		var tm_sec, tm_min, tm_hour, tm_mday, tm_mon, tm_year;
		var val_bin, pm_flag;

		// [Bochs] update seconds
		tm_sec = bcd_to_bin(this.getReg(REG_SEC), state.rtc_mode_binary);

		// [Bochs] update minutes
		tm_min = bcd_to_bin(this.getReg(REG_MIN),
		state.rtc_mode_binary);

		// [Bochs] update hours
		if (state.rtc_mode_12hour) {
			pm_flag = this.getReg(REG_HOUR) & 0x80;
			val_bin = bcd_to_bin(this.getReg(REG_HOUR) & 0x70, state.rtc_mode_binary);
			if ((val_bin < 12) & (pm_flag > 0)) {
				val_bin += 12;
			} else if ((val_bin == 12) & (pm_flag == 0)) {
				val_bin = 0;
			}
			tm_hour = val_bin;
		} else {
			tm_hour = bcd_to_bin(this.getReg(REG_HOUR), state.rtc_mode_binary);
		}

		// [Bochs] update day of the month
		tm_mday = bcd_to_bin(this.getReg(REG_MONTH_DAY), state.rtc_mode_binary);

		// [Bochs] update month
		tm_mon = bcd_to_bin(this.getReg(REG_MONTH),
		state.rtc_mode_binary) - 1;

		// [Bochs] update year
		val_bin = bcd_to_bin(this.getReg(REG_IBM_CENTURY_BYTE), state.rtc_mode_binary);
		val_bin = (val_bin - 19) * 100;
		val_bin += bcd_to_bin(this.getReg(REG_YEAR), state.rtc_mode_binary);
		tm_year = val_bin;

		var timeval = new Date();
		timeval.setFullYear(tm_year + 1900, tm_mon, tm_mday);
		timeval.setHours(tm_hour, tm_min, tm_sec);
		state.timeval = timeval; //mktime(& time_calendar);
		debugger;
	};
	// Calculate CMOS checksum
	CMOS.prototype.checksum = function () {
		var state = this.state;
		var sum = 0, idx;
		for (idx = 0x10 ; idx <= 0x2D ; ++idx) {
			sum += this.list_reg[ idx ].get();
		}
		// High byte of checksum
		this.regCSumHigh.set((sum >> 8) & 0xFF);
		// Low byte of checksum
		this.regCSumLow.set(sum & 0xFF);
	};
	// - See http://phpjs.org/functions/localtime:587
	CMOS.prototype.updateClock = function () {
		// ...
		//util.warning("CMOS.updateClock() :: Not yet implemented");
		var state = this.state;
		//struct tm *time_calendar;
		var year, month, day, century;
		var val_bcd, hour;

		//time_calendar = localtime(& BX_CMOS_THIS s.timeval);

		// ???
		function x(t, m) {
			var a = (new Date( t.getFullYear(), 0, m, 0, 0, 0, 0 )).toUTCString();
			return t - new Date( a.slice(0, a.lastIndexOf(' ') - 1) );
		}

		var time = state.timeval
			, tm_sec = time.getSeconds()
			, tm_min = time.getMinutes()
			, tm_hour = time.getHours()
			, tm_mday = time.getDate()            // Day of the month, 1 -> 31
			, tm_mon = time.getMonth()            // Month of the year, 0 (Jan) -> 11 (Dec)
			, tm_year = time.getFullYear() - 1900 // Years since 1900
			, tm_wday = time.getDay()             // Day of the week, 0 (Sun) -> 6 (Sat)
			, tm_yday = Math.floor(
				(time - new Date( time.getFullYear(), 0, 1 )) / 86400000
			), tm_isdst = +(x(time, 1) != x(time, 6));   // Is daylight savings time in effect

		// [Bochs] update seconds
		this.setReg(REG_SEC, bin_to_bcd(tm_sec, state.rtc_mode_binary));

		// [Bochs] update minutes
		this.setReg(REG_MIN, bin_to_bcd(tm_min, state.rtc_mode_binary));

		// [Bochs] update hours
		if (state.rtc_mode_12hour) {
			hour = tm_hour;
			val_bcd = (hour > 11) ? 0x80 : 0x00;
			if (hour > 11) hour -= 12;
			if (hour == 0) hour = 12;
			val_bcd |= bin_to_bcd(hour, state.rtc_mode_binary);
			this.setReg(REG_HOUR, val_bcd);
		} else {
			this.setReg(REG_HOUR, bin_to_bcd(tm_hour, state.rtc_mode_binary));
		}

		// [Bochs] update day of the week
		day = tm_wday + 1; // 0..6 to 1..7
		this.setReg(REG_WEEK_DAY, bin_to_bcd(day, state.rtc_mode_binary));

		// [Bochs] update day of the month
		day = tm_mday;
		this.setReg(REG_MONTH_DAY, bin_to_bcd(day, state.rtc_mode_binary));

		// [Bochs] update month
		month = tm_mon + 1;
		this.setReg(REG_MONTH, bin_to_bcd(month, state.rtc_mode_binary));

		// [Bochs] update year
		year = tm_year % 100;
		this.setReg(REG_YEAR, bin_to_bcd(year, state.rtc_mode_binary));

		// [Bochs] update century
		century = (tm_year / 100) + 19;
		this.setReg(REG_IBM_CENTURY_BYTE, bin_to_bcd(century, state.rtc_mode_binary));

		// [Bochs] Raul Hudea pointed out that some bioses also use reg 0x37 for the
		// century byte.  Tony Heller says this is critical in getting WinXP to run.
		this.setReg(REG_IBM_PS2_CENTURY_BYTE, this.getReg(REG_IBM_CENTURY_BYTE));
	};
	// Called on change
	CMOS.prototype.CRA_Changed = function () {
		var state = this.state;
        var nibble;
        var dcc;

		// Periodic Interrupt timer
		nibble = state.regStatA.get() & 0x0F; // 1st 4 bits
		// Divider Chain Control
		dcc = (state.regStatA.get() >> 4) & 0x07; // Next 3 bits

		// No Periodic Interrupt Rate when 0, deactivate timer
		if ((nibble === 0) || ((dcc & 0x06) === 0)) {
			state.timerPeriodic.deactivate();
			state.intervalPeriodicUsecs = -1;	// (Effectively) max value
		} else {
			// Values 0001b & 0010b are the same as 1000b & 1001b
			if (nibble <= 2) { nibble += 7; }

			state.intervalPeriodicUsecs = 1000000 / (32768 / (1 << (nibble - 1)));

			// Activate timer if Periodic Interrupt Enable bit set
			if (state.regStatB.get() & 0x40) {
				state.timerPeriodic.activate(state.intervalPeriodicUsecs, true);
			} else {
				state.timerPeriodic.deactivate();
			}
		}
	};

	function handlePeriodicTimer(ticksNow) {
		var machine = this.machine;
        var state = this.state;

		// Periodic interrupts are enabled: trip IRQ 8
		//	and update status register C
		if (state.regStatB.get() & 0x40) {
			state.regStatC.set(state.regStatC.get() | 0xC0); // Interrupt Request, Periodic Int
			machine.pic.raiseIRQ(8);
		}
	}
	function handleOneSecondTimer(ticksNow) {
		var state = this.state;

		// Divider Chain reset - RTC stopped
		if ((state.regStatA.get() & 0x60) === 0x60) { return; }

		// Update internal time/date buffer
		// NB: Bochs only advances the time one second here -
		//     that could cause syncing issues,
		//     this should be more accurate
		state.timeval = new Date();

		// Don't update CMOS user copy of time/date if CRB bit7 is 1
		// - Nothing else to do
		if (state.regStatB.get() & 0x80) { return; }

		state.regStatA.set(state.regStatA.get() | 0x80); // Set UIP bit

		// UIP timer for updating clock & alarm functions
		//bx_pc_system.activate_timer(state.uip_timer_index, 244, 0);
		state.timerUIP.activate(244, false);
	}
	function handleUIPTimer(ticksNow) {
		var machine = this.machine;
		var state = this.state;
		var matchAlarm;

		this.updateClock();

		// If updates interrupts are enabled, trip IRQ 8 & update status reg C
		if (state.regStatB.get() & 0x10) {
			// Interrupt Request, Update Ended
			state.regStatC.set(state.regStatC.get() | 0x90);
			machine.pic.raiseIRQ(8);
		}

		// Compare CMOS user copy of date/time to alarm date/time here
		if (state.regStatB.get() & 0x20) {
			// Alarm interrupts enabled
			matchAlarm = true;
			if ((state.regSecAlarm.get() & 0xC0) != 0xC0) {
				// Seconds alarm is not in "don't care" mode
				if (state.regSec.get() != state.regSecAlarm.get()) {
					matchAlarm = false;
				}
			}
			if ((state.regMinAlarm.get() & 0xC0) != 0xC0) {
				// Minutes alarm is not in "don't care" mode
				if (state.regMin.get() != state.regMinAlarm.get()) {
					matchAlarm = false;
				}
			}
			if ((state.regHourAlarm.get() & 0xC0) != 0xC0) {
				// Hour alarm is not in "don't care" mode
				if (state.regHour.get() != state.regHourAlarm.get()) {
					matchAlarm = false;
				}
			}
			if (matchAlarm) {
				// Interrupt Request, Alarm Int
				state.regStatC.set(state.regStatC.get() | 0xA0);
				machine.pic.raiseIRQ(8);
			}
		}
		state.regStatA.set(state.regStatA.get() & 0x7F); // Clear UIP bit
	}

	function bcd_to_bin(val, isBinary) {
		return isBinary ? val : (((val >> 4) * 10) + (val & 0x0F));
	}
	function bin_to_bcd(val, isBinary) {
		return isBinary ? val : (((val / 10) << 4) | (val % 10));
	}

	// CMOS chip's I/O read operations' handler routine
	function readHandler(device, addr, io_len) {
		var machine = this.machine;
		var state = device.state; // "device" will be CMOS
		var result8; // 8-bit result

		util.info("CMOS readHandler() :: Read of CMOS register " + util.format("hex", state.addrMemory));

		switch (addr) {
		case 0x0070:
			// NB: This register is write-only on most machines.
			util.debug("CMOS readHandler() :: Read of index port 0x70. Returning 0xFF");
			return 0xFF;
		case 0x0071:
			// Read from current CMOS memory/register (set by writing to port 0x60)
			result8 = state.list_reg[ state.addrMemory ].get();
			// All bits of register C are cleared after a read from that particular register
			if (state.addrMemory === REG_STAT_C) {
				state.regStatC.set(0x00);
				machine.pic.lowerIRQ(8);
			}
			return result8;
		default:
			util.panic("CMOS readHandler() :: Unsupported read, address=" + util.format("hex", addr) + "!");
			return 0;
		}
	}
	// CMOS chip's I/O write operations' handler routine
	function writeHandler(device, addr, val, io_len) {
		var state = device.state; // "device" will be CMOS
		var dcc;
		var valCRBPrevious;

		util.info("CMOS writeHandler() :: Write to address: "
			+ util.format("hex", addr) + " = " + util.format("hex", val));

		switch (addr) {
		case 0x0070:	// Assign new current register address
			// This port is written to in order to specify
			//	the register for eg. reading (extracts only 1st 7 bits)
			state.addrMemory = val & 0x7F;

			// [1] http://wiki.osdev.org/CMOS
			// [2] http://forum.osdev.org/viewtopic.php?f=1&t=8829
			// TODO: NMIs may in fact be masked by setting high-order bit
			//	of the byte written to this port - hence why the code ported
			//	from Bochs above restricts the address to only the 1st 7 bits
			// 	(the "& 0x7F")
			break;
		case 0x0071:	// Write to current register
			switch (state.addrMemory) {
			case REG_SEC_ALARM:
			case REG_MIN_ALARM:
			case REG_HOUR_ALARM:
				state.list_reg[ state.addrMemory ].set(val);
				util.debug("CMOS writeHandler() :: Alarm time changed to " + util.format("time", state.regHourAlarm.get(), state.regMinAlarm.get(), state.regSecAlarm.get()));
				break;
			case REG_SEC:
			case REG_MIN:
			case REG_HOUR:
			case REG_WEEK_DAY:
			case REG_MONTH_DAY:
			case REG_MONTH:
			case REG_YEAR:
			case REG_IBM_CENTURY_BYTE:
			case REG_IBM_PS2_CENTURY_BYTE:
				state.list_reg[ state.addrMemory ].set(val);
				// Copy writes to IBM_CENTURY to IBM_PS2_CENTURY
				if (state.addrMemory === REG_IBM_PS2_CENTURY_BYTE) { state.regIBMCenturyByte.set(val); }
				if (state.regStatB.get() & 0x80) {
					state.timeChange = 1;
				} else {
					device.updateTimeVal();
				}
				break;
			case REG_STAT_A: // Control Register A
				// bit 7: Update in Progress (read-only)
				//   1 = signifies time registers will be updated within 244us
				//   0 = time registers will not occur before 244us
				//   note: this bit reads 0 when CRB bit 7 is 1
				// bit 6..4: Divider Chain Control
				//   000 oscillator disabled
				//   001 oscillator disabled
				//   010 Normal operation
				//   011 TEST
				//   100 TEST
				//   101 TEST
				//   110 Divider Chain RESET
				//   111 Divider Chain RESET
				// bit 3..0: Periodic Interrupt Rate Select
				//   0000 None
				//   0001 3.90625  ms
				//   0010 7.8125   ms
				//   0011 122.070  us
				//   0100 244.141  us
				//   0101 488.281  us
				//   0110 976.562  us
				//   0111 1.953125 ms
				//   1000 3.90625  ms
				//   1001 7.8125   ms
				//   1010 15.625   ms
				//   1011 31.25    ms
				//   1100 62.5     ms
				//   1101 125      ms
				//   1110 250      ms
				//   1111 500      ms
				dcc = (val >> 4) & 0x07;
				if ((dcc & 0x06) == 0x06) {
					util.info(("CRA: divider chain RESET"));
				} else if (dcc > 0x02) {
					util.panic("CRA: divider chain control " + util.format("hex", dcc));
				}
				state.regStatA.set(state.regStatA.get() & 0x80);
				state.regStatA.set(state.regStatA.get() | (val & 0x7F));
				device.CRA_Changed();

				break;
			case REG_STAT_B: // Control Register B
				// bit 0: Daylight Savings Enable
				//   1 = enable daylight savings
				//   0 = disable daylight savings
				// bit 1: 24/12 hour mode
				//   1 = 24 hour format
				//   0 = 12 hour format
				// bit 2: Data Mode
				//   1 = binary format
				//   0 = BCD format
				// bit 3: "square wave enable"
				//   Not supported and always read as 0
				// bit 4: Update Ended Interrupt Enable
				//   1 = enable generation of update ended interrupt
				//   0 = disable
				// bit 5: Alarm Interrupt Enable
				//   1 = enable generation of alarm interrupt
				//   0 = disable
				// bit 6: Periodic Interrupt Enable
				//   1 = enable generation of periodic interrupt
				//   0 = disable
				// bit 7: Set mode
				//   1 = user copy of time is "frozen" allowing time registers
				//       to be accessed without regard for an occurance of an update
				//   0 = time updates occur normally
				if (val & 0x01) {
					// Daylight savings unsupported (for now)
					util.problem("CMOS writeHandler() :: Write status reg B, daylight savings unsupported");
				}
				val &= 0xF7; // Bit3 always 0
				// Note: setting bit 7 clears bit 4
				if (val & 0x80) {
					val &= 0xEF;
				}
				valCRBPrevious = state.regStatB.get();
				state.regStatB.set(val);
				if ((valCRBPrevious & 0x02) != (val & 0x02)) {
					state.modeRTC_12Hour = ((val & 0x02) == 0);
					device.updateClock();
				}
				if ((valCRBPrevious & 0x04) != (val & 0x04)) {
					state.modeRTC_Binary = ((val & 0x04) != 0);
					device.updateClock();
				}
				if ((valCRBPrevious & 0x40) != (val & 0x40)) {
					// Periodic Interrupt Enabled changed
					if (valCRBPrevious & 0x40) {
						// Transition from 1 to 0, deactivate timer
						state.timerPeriodic.deactivate();
					} else {
						// Transition from 0 to 1
						//	(if rate select is not 0, activate timer)
						if ((state.regStatA.get() & 0x0F) != 0) {
							state.timerPeriodic.activate(state.intervalPeriodicUsecs, true);
						}
					}
				}
				if ( (valCRBPrevious >= 0x80)
                    && (val < 0x80)
                    && state.timeChange
                ) {
					device.updateTimeVal();
					state.timeChange = 0;
				}
				break;
			case REG_STAT_C: // Control Register C
			case REG_STAT_D: // Control Register D
				util.problem("CMOS writeHandler() :: Write to control register "
					+ util.format("hex", state.addrMemory)
					+ " ignored (read-only)");
				break;
			case REG_DIAGNOSTIC_STATUS:
				util.debug("CMOS writeHandler() :: Write register 0x0e: "
					+ util.format("hex", val));
				state.regDiagnosticStatus.set(val);
				break;
			case REG_SHUTDOWN_STATUS:
				switch (val) {
				case 0x00: // Proceed with normal POST (soft reset)
					util.debug("CMOS writeHandler() :: Reg 0Fh(00): Shutdown action = normal POST");
					break;
				case 0x01: // Shutdown after memory size check
					util.debug("CMOS writeHandler() :: Reg 0Fh(01): Request to change shutdown action"
						+ " to shutdown after memory size check");
					break;
				case 0x02: // Shutdown after successful memory test
					util.debug("CMOS writeHandler() :: Reg 0Fh(02): Request to change shutdown action"
						+ " to shutdown after successful memory test");
					break;
				case 0x03: // Shutdown after failed memory test
					util.debug("CMOS writeHandler() :: Reg 0Fh(03): Request to change shutdown action"
						+ " to shutdown after successful memory test");
					break;
				case 0x04: // Jump to disk bootstrap routine
					util.debug("CMOS writeHandler() :: Reg 0Fh(04): Request to change shutdown action"
						+ " to jump to disk bootstrap routine.");
					break;
				case 0x05: // Flush keyboard (issue EOI) and jump via 40h:0067h
					util.debug("CMOS writeHandler() :: Reg 0Fh(05): Request to change shutdown action"
						+ " to flush keyboard (issue EOI) and jump via 40h:0067h.");
					break;
				case 0x06:
					util.debug("CMOS writeHandler() :: Reg 0Fh(06): Shutdown after memory test !");
					break;
				case 0x07: // Reset (after failed test in virtual mode)
					util.debug("CMOS writeHandler() :: Reg 0Fh(07): Request to change shutdown action"
						+ " to reset (after failed test in virtual mode).");
					break;
				case 0x08: // Used by POST during protected-mode RAM test (return to POST) */
					util.debug("CMOS writeHandler() :: Reg 0Fh(08): Request to change shutdown action"
						+ " to return to POST (used by POST during protected-mode RAM test).");
					break;
				case 0x09: // Return to BIOS extended memory block move
						// (interrupt 15h, func 87h was in progress)
					util.debug("CMOS writeHandler() :: Reg 0Fh(09): Request to change shutdown action"
						+ " to return to BIOS extended memory block move.");
					break;
				case 0x0a: // Jump to DWORD pointer at 40:67
					util.debug("CMOS writeHandler() :: Reg 0Fh(0a): Request to change shutdown action"
						+ " to jump to DWORD at 40:67");
					break;
				case 0x0b: // IRET to DWORD pointer at 40:67
					util.debug("CMOS writeHandler() :: Reg 0Fh(0b): Request to change shutdown action"
						+ " to iret to DWORD at 40:67");
					break;
				case 0x0c: // RETF to DWORD pointer at 40:67
					util.debug("CMOS writeHandler() :: Reg 0Fh(0c): Request to change shutdown action"
						+ " to retf to DWORD at 40:67");
					break;
				default:
					util.problem("CMOS writeHandler() :: Unsupported shutdown status: " + util.format("hex", val) + "!");
				}
				state.regShutdownStatus.set(val);
				break;
			default:
				util.debug("CMOS writeHandler() :: Write reg "
					+ util.format("hex", state.addrMemory)
					+ ": value = " + util.format("hex", val));
				state.list_reg[ state.addrMemory ].set(val);
			}
			break;
		default:
			util.panic("CMOS IO writeHandler() :: Unsupported write, address=" + util.format("hex", addr) + "!");
			return 0;
		}
	}
	/* ====== /Private ====== */

	// Exports
	return CMOS;
});
