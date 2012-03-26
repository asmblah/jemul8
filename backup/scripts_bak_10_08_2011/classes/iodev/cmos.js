/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: CMOS chip class support
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("cmos", function ( $ ) {
	var x86Emu = this.data("x86Emu");
	
	// Import system after setup
	var machine, CPU, DRAM;
	this.bind("load", function ( $, machine_, CPU_, DRAM_ ) {
		machine = machine_; CPU = CPU_; DRAM = DRAM_;
	});
	
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
	function CMOS( emu ) {
		var idx, state, list_reg;
		
		$.info("CMOS PreInit");
		
		this.emu = emu;
		
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
		
		/* ==== Setup registers ==== */
		for ( idx = 0 ; idx < 128 ; ++idx ) {
			list_reg[ idx ] = new x86Emu.Register( "R_" + idx, 1 );
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
		/* ==== /Setup registers ==== */
	}
	// Methods based on Bochs /iodev/cmos.h & cmos.cc
	CMOS.prototype = new x86Emu.IODevice( "CMOS", CMOS ); // Inheritance
	CMOS.prototype.init = function () {
		var state = this.state;
		
		// I/O port addresses used
		this.registerIO_Read(0x0070, "RAM", readHandler, 1);
		this.registerIO_Read(0x0071, "RAM", readHandler, 1);
		this.registerIO_Write(0x0070, "RAM", writeHandler, 1);
		this.registerIO_Write(0x0071, "RAM", writeHandler, 1);
		
		// Make a note that IRQ #8 is used by the Real-Time Clock
		this.registerIRQ(8, "RTC");
		
		/* ==== Setup timers ==== */
		// -- If not already done
		if ( state.timerPeriodic === null ) {	// Continuous, not active
			state.timerPeriodic = machine.registerTimer(this.PeriodicTimerHandler, this, 1000000, true, false, "CMOS");
		}
		if ( state.timerOneSecond === null ) {	// Continuous, not active
			state.timerOneSecond = machine.registerTimer(this.OneSecondTimerHandler, this, 1000000, true, false, "CMOS");
		}
		if ( state.timerUIP === null ) {	// One-shot (not continuous), not active
			state.timerUIP = machine.registerTimer(this.UIPTimerHandler, this, 244, false, false, "CMOS");
		}
		/* ==== /Setup timers ==== */
		
		// NB: In Bochs, there is support for local time,
		//	UTC time or a specified time: here, we just
		//	support local time for now.
		state.time = new Date().getTime();
		
		/* ==== Load CMOS ==== */
		// From image file
		if ( 0 ) {
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
	CMOS.prototype.reset = function ( type ) {
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
		
		// One second timer for updating clock & alarm functions
		state.timerOneSecond.Activate(1000000, true);
		
		CRA_Changed();
	};
	CMOS.prototype.SaveImage = function () {
		var state = this.state;
		
		$.info("CMOS.SaveImage :: Save not implemented yet.");
	};
	CMOS.prototype.registerState = function () {
		var state = this.state;
		
		// ?
	};
	CMOS.prototype.afterRestoreState = function () {
		var state = this.state;
		
		state.modeRTC_12Hour = ((state.regStatB.get() & 0x02) === 0);
		state.modeRTC_Binary = ((state.regStatB.get() & 0x04) !== 0);
		UpdateTime();
		CRA_Changed();
	};
	CMOS.prototype.getTimeVal = function () {
		var state = this.state;
		
		// ...
	};
	CMOS.prototype.updateTimeVal = function () {
		var state = this.state;
		
		// ...
	};
	// Calculate CMOS checksum
	CMOS.prototype.ChecksumCMOS = function () {
		var state = this.state;
		var sum = 0, idx;
		for ( idx = 0x10 ; idx <= 0x2D ; ++idx ) {
			sum += this.list_reg[ idx ].get();
		}
		// High byte of checksum
		this.regCSumHigh.set((sum >> 8) & 0xFF);
		// Low byte of checksum
		this.regCSumLow.set(sum & 0xFF);
	};
	CMOS.prototype.updateClock = function () {
		
	};
	CMOS.prototype.PeriodicTimerHandler = function ( ticksNow ) {
		var state = this.state;
		
		// Periodic interrupts are enabled: trip IRQ 8
		//	and update status register C
		if ( state.regStatB.get() & 0x40 ) {
			state.regStatC.set(state.regStatC.get() | 0xC0); // Interrupt Request, Periodic Int
			machine.PIC.raiseIRQ(8);
		}
	};
	CMOS.prototype.OneSecondTimerHandler = function ( ticksNow ) {
		var state = this.state;
		
		// Divider Chain reset - RTC stopped
		if ( (state.regStatA.get() & 0x60) == 0x60 ) { return; }
		
		// Update internal time/date buffer
		state.time = ticksNow;
		
		// Don't update CMOS user copy of time/date if CRB bit7 is 1
		// - Nothing else to do
		if ( state.regStatB.get() & 0x80 ) { return; }
		
		state.regStatA.set(state.regStatA.get() | 0x80); // Set UIP bit
		
		// UIP timer for updating clock & alarm functions
		//bx_pc_system.activate_timer(BX_CMOS_THIS s.uip_timer_index, 244, 0);
		state.timerUIP.Activate(244, false);
	};
	CMOS.prototype.UIPTimerHandler = function ( ticksNow ) {
		var state = this.state;
		var matchAlarm;
		
		this.updateClock();
		
		// If updates interrupts are enabled, trip IRQ 8 & update status reg C
		if ( state.regStatB.get() & 0x10 ) {
			// Interrupt Request, Update Ended
			state.regStatC.set(state.regStatC.get() | 0x90);
			machine.PIC.raiseIRQ(8);
		}
		
		// Compare CMOS user copy of date/time to alarm date/time here
		if ( state.regStatB.get() & 0x20 ) {
			// Alarm interrupts enabled
			matchAlarm = true;
			if ( (state.regSecAlarm.get() & 0xC0) != 0xC0 ) {
				// Seconds alarm is not in "don't care" mode
				if ( state.regSec.get() != state.regSecAlarm.get() ) {
					matchAlarm = false;
				}
			}
			if ( (state.regMinAlarm.get() & 0xC0) != 0xC0 ) {
				// Minutes alarm is not in "don't care" mode
				if ( state.regMin.get() != state.regMinAlarm.get() ) {
					matchAlarm = false;
				}
			}
			if ( (state.regHourAlarm.get() & 0xC0) != 0xC0 ) {
				// Hour alarm is not in "don't care" mode
				if ( state.regHour.get() != state.regHourAlarm.get() ) {
					matchAlarm = false;
				}
			}
			if ( matchAlarm ) {
				// Interrupt Request, Alarm Int
				state.regStatC.set(state.regStatC.get() | 0xA0);
				machine.PIC.raiseIRQ(8);
			}
		}
		state.regStatA.set(state.regStatA.get() & 0x7F); // Clear UIP bit
	};
	
	function BCDToBin( val, isBinary ) {
		return isBinary ? val : (((val >> 4) * 10) + (val & 0x0F));
	}
	function BinToBCD( val, isBinary ) {
		return isBinary ? val : (((val / 10) << 4) | (val % 10));
	}
	
	// Called on change
	function CRA_Changed() {
		var nibble, dcc;
		
		// Periodic Interrupt timer
		nibble = state.regStatA.get() & 0x0F; // 1st 4 bits
		// Divider Chain Control
		dcc = (state.regStatA.get() >> 4) & 0x07; // Next 3 bits
		
		// No Periodic Interrupt Rate when 0, deactivate timer
		if ( (nibble === 0) || ((dcc & 0x06) === 0) ) {
			state.timerPeriodic.Deactivate();
			state.intervalPeriodicUsecs = -1;	// (Effectively) max value
		} else {
			// Values 0001b & 0010b are the same as 1000b & 1001b
			if ( nibble <= 2 ) { nibble += 7; }
			
			state.intervalPeriodicUsecs = 1000000 / (32768 / (1 << (nibble - 1)));
			
			// Activate timer if Periodic Interrupt Enable bit set
			if ( state.regStatB.get() & 0x40 ) {
				state.timerPeriodic.Activate(state.intervalPeriodicUsecs, true);
			} else {
				state.timerPeriodic.Deactivate();
			}
		}
	}
	
	// CMOS chip's I/O read operations' handler routine
	function readHandler( device, addr, len ) {
		var state = device.state; // "device" will be CMOS
		var result8; // 8-bit result
		
		$.info("CMOS readHandler() :: Read of CMOS register " + $.format("hex", state.addrMemory));
		//debugger;
		switch ( addr ) {
		case 0x0070:
			// NB: This register is write-only on most machines.
			$.debug("CMOS readHandler() :: Read of index port 0x70. Returning 0xFF");
			return 0xFF;
		case 0x0071:
			// Read from current CMOS memory/register (set by writing to port 0x60)
			result8 = state.list_reg[ state.addrMemory ].get();
			// All bits of register C are cleared after a read from that particular register
			if ( state.addrMemory === REG_STAT_C ) {
				state.regStatC.set(0x00);
				machine.PIC.lowerIRQ(8);
			}
			return result8;
		default:
			$.panic("CMOS readHandler() :: Unsupported read, address=" + $.format("hex", addr) + "!");
			return 0;
		}
	}
	// CMOS chip's I/O write operations' handler routine
	function writeHandler( device, addr, val, len ) {
		var state = device.state; // "device" will be CMOS
		
		var dcc;
		var valCRBPrevious;
		$.info("CMOS writeHandler() :: Write to address: " + $.format("hex", addr) + " = " + $.format("hex", val));
		//debugger;
		switch ( addr ) {
		case 0x0070:	// Assign new current register address
			// This port is written to in order to specify the register for eg. reading
			state.addrMemory = val & 0x7F;
			break;
		case 0x0071:	// Write to current register
			switch ( state.addrMemory ) {
			case REG_SEC_ALARM:
			case REG_MIN_ALARM:
			case REG_HOUR_ALARM:
				state.list_reg[ state.addrMemory ].set(val);
				$.debug("CMOS writeHandler() :: Alarm time changed to " + $.format("time", state.regHourAlarm.get(), state.regMinAlarm.get(), state.regSecAlarm.get()));
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
				if ( state.addrMemory === REG_IBM_PS2_CENTURY_BYTE ) { state.regIBMCenturyByte.set(val); }
				if ( state.regStatB.get() & 0x80 ) {
					state.timeChange = 1;
				} else {
					UpdateTime();
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
				if ( (dcc & 0x06) == 0x06 ) {
					$.info(("CRA: divider chain RESET"));
				} else if ( dcc > 0x02 ) {
					$.panic("CRA: divider chain control " + $.format("hex", dcc));
				}
				state.regStatA.set(state.regStatA.get() & 0x80);
				state.regStatA.set(state.regStatA.get() | (val & 0x7F));
				CRA_Changed();
				
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
				if ( val & 0x01 ) {
					// Daylight savings unsupported (for now)
					$.problem("CMOS writeHandler() :: Write status reg B, daylight savings unsupported");
				}
				val &= 0xF7; // Bit3 always 0
				// Note: setting bit 7 clears bit 4
				if ( val & 0x80 ) {
					val &= 0xEF;
				}
				valCRBPrevious = state.regStatB.get();
				state.regStatB.set(val);
				if ( (valCRBPrevious & 0x02) != (val & 0x02) ) {
					state.modeRTC_12Hour = ((val & 0x02) == 0);
					device.updateClock();
				}
				if ( (valCRBPrevious & 0x04) != (val & 0x04) ) {
					state.modeRTC_Binary = ((val & 0x04) != 0);
					device.updateClock();
				}
				if ( (valCRBPrevious & 0x40) != (val & 0x40) ) {
					// Periodic Interrupt Enabled changed
					if ( valCRBPrevious & 0x40 ) {
						// Transition from 1 to 0, deactivate timer
						state.timerPeriodic.Deactivate();
					} else {
						// Transition from 0 to 1
						//	( if rate select is not 0, activate timer )
						if ( (state.regStatA.get() & 0x0F) != 0 ) {
							state.timerPeriodic.Activate(state.intervalPeriodicUsecs, true);
						}
					}
				}
				if ( (valCRBPrevious >= 0x80) && (val < 0x80)
				&& state.timeChange ) {
					device.updateTimeVal();
					state.timeChange = 0;
				}
				break;
			case REG_STAT_C: // Control Register C
			case REG_STAT_D: // Control Register D
				$.problem("CMOS writeHandler() :: Write to control register "
					+ $.format("hex", state.addrMemory)
					+ " ignored (read-only)");
				break;
			case REG_DIAGNOSTIC_STATUS:
				$.debug("CMOS writeHandler() :: Write register 0x0e: "
					+ $.format("hex", val));
				state.regDiagnosticStatus.set(val);
				break;
			case REG_SHUTDOWN_STATUS:
				switch ( val ) {
				case 0x00: // Proceed with normal POST (soft reset)
					$.debug("CMOS writeHandler() :: Reg 0Fh(00): Shutdown action = normal POST");
					break;
				case 0x01: // Shutdown after memory size check
					$.debug("CMOS writeHandler() :: Reg 0Fh(01): Request to change shutdown action"
						+ " to shutdown after memory size check");
					break;
				case 0x02: // Shutdown after successful memory test
					$.debug("CMOS writeHandler() :: Reg 0Fh(02): Request to change shutdown action"
						+ " to shutdown after successful memory test");
					break;
				case 0x03: // Shutdown after failed memory test
					$.debug("CMOS writeHandler() :: Reg 0Fh(03): Request to change shutdown action"
						+ " to shutdown after successful memory test");
					break;
				case 0x04: // Jump to disk bootstrap routine
					$.debug("CMOS writeHandler() :: Reg 0Fh(04): Request to change shutdown action"
						+ " to jump to disk bootstrap routine.");
					break;
				case 0x05: // Flush keyboard (issue EOI) and jump via 40h:0067h
					$.debug("CMOS writeHandler() :: Reg 0Fh(05): Request to change shutdown action"
						+ " to flush keyboard (issue EOI) and jump via 40h:0067h.");
					break;
				case 0x06:
					$.debug("CMOS writeHandler() :: Reg 0Fh(06): Shutdown after memory test !");
					break;
				case 0x07: // Reset (after failed test in virtual mode)
					$.debug("CMOS writeHandler() :: Reg 0Fh(07): Request to change shutdown action"
						+ " to reset (after failed test in virtual mode).");
					break;
				case 0x08: // Used by POST during protected-mode RAM test (return to POST) */
					$.debug("CMOS writeHandler() :: Reg 0Fh(08): Request to change shutdown action"
						+ " to return to POST (used by POST during protected-mode RAM test).");
					break;
				case 0x09: // Return to BIOS extended memory block move
						// ( interrupt 15h, func 87h was in progress )
					$.debug("CMOS writeHandler() :: Reg 0Fh(09): Request to change shutdown action"
						+ " to return to BIOS extended memory block move.");
					break;
				case 0x0a: // Jump to DWORD pointer at 40:67
					$.debug("CMOS writeHandler() :: Reg 0Fh(0a): Request to change shutdown action"
						+ " to jump to DWORD at 40:67");
					break;
				case 0x0b: // IRET to DWORD pointer at 40:67
					$.debug("CMOS writeHandler() :: Reg 0Fh(0b): Request to change shutdown action"
						+ " to iret to DWORD at 40:67");
					break;
				case 0x0c: // RETF to DWORD pointer at 40:67
					$.debug("CMOS writeHandler() :: Reg 0Fh(0c): Request to change shutdown action"
						+ " to retf to DWORD at 40:67");
					break;
				default:
					$.problem("CMOS writeHandler() :: Unsupported shutdown status: " + $.format("hex", val) + "!");
				}
				state.regShutdownStatus.set(val);
				break;
			default:
				$.debug("CMOS writeHandler() :: Write reg 0x%02x: value = " + $.format("hex", val));
				state.list_reg[ state.addrMemory ].set(val);
			}
			break;
		default:
			$.panic("CMOS IO writeHandler() :: Unsupported write, address=" + $.format("hex", addr) + "!");
			return 0;
		}
	}
	/* ====== /Private ====== */
	
	// Exports
	x86Emu.CMOS = CMOS;
});
