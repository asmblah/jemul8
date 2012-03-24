/*
 *	jsEmu - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: CMOS chip class support
 */
var mod = new jsEmu.SecondaryModule( function ( jsEmu, machine, motherboard, CPU, FlashBIOSChip, BIOS, DRAM ) {
	
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
	
	// Constructor / pre-init (ie. from bx_cmos_c::bx_cmos_c(void) )
	function CMOS() {
		var idx, state, list_reg;
		
		jsEmu.Info("CMOS PreInit");
		
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
			list_reg[ idx ] = new Register( "R_" + idx, 1 );
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
	CMOS.prototype = new jsEmu.IODevice( "CMOS", CMOS ); // Inheritance
	CMOS.prototype.Init = function () {
		var state = this.state;
		
		this.RegisterIO_Read(0x0070, "CMOS RAM", ReadHandler, 1);
		this.RegisterIO_Read(0x0071, "CMOS RAM", ReadHandler, 1);
		this.RegisterIO_Write(0x0070, "CMOS RAM", WriteHandler, 1);
		this.RegisterIO_Write(0x0071, "CMOS RAM", WriteHandler, 1);
		
		this.RegisterIRQ(8, "CMOS RTC");
		
		/* ==== Setup timers ==== */
		// -- If not already done
		if ( state.timerPeriodic === null ) {	// Continuous, not active
			state.timerPeriodic = machine.RegisterTimer(this.PeriodicTimerHandler, 1000000, true, false, "CMOS");
		}
		if ( state.timerOneSecond === null ) {	// Continuous, not active
			state.timerOneSecond = machine.RegisterTimer(this.OneSecondTimerHandler, 1000000, true, false, "CMOS");
		}
		if ( state.timerUIP === null ) {	// One-shot (not continuous), not active
			state.timerUIP = machine.RegisterTimer(this.UIPTimerHandler, 244, false, false, "CMOS");
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
			state.regStatA.Set(0x26);
			state.regStatB.Set(0x02);
			state.regStatC.Set(0x00);
			state.regStatD.Set(0x80);
			// Always support FPU for now (set bit in equipment byte)
			state.regEquipmentByte.Set(state.regEquipmentByte.Get() | 0x02);
			state.modeRTC_12Hour = 0;
			state.modeRTC_Binary = 0;
			UpdateClock();
		}
		/* ==== /Load CMOS ==== */
		state.timeChange = 0;
	};
	CMOS.prototype.Reset = function ( type ) {
		var state = this.state;
		
		state.addrMemory = 0;
		
		/* RESET affects the following registers:
		 *  CRA: no effects
		 *  CRB: bits 4,5,6 forced to 0
		 *  CRC: bits 4,5,6,7 forced to 0
		 *  CRD: no effects
		 */
		state.regStatB.Set(state.regStatB.Get() & 0x8F);
		state.regStatC.Set(0x00);
		
		// One second timer for updating clock & alarm functions
		state.timerOneSecond.Activate(1000000, true);
		
		CRA_Changed();
	};
	CMOS.prototype.SaveImage = function () {
		var state = this.state;
		
		jsEmu.Info("CMOS.SaveImage :: Save not implemented yet.");
	};
	CMOS.prototype.RegisterState = function () {
		var state = this.state;
		
		// ?
	};
	CMOS.prototype.AfterRestoreState = function () {
		var state = this.state;
		
		state.modeRTC_12Hour = ((state.regStatB.Get() & 0x02) === 0);
		state.modeRTC_Binary = ((state.regStatB.Get() & 0x04) !== 0);
		UpdateTime();
		CRA_Changed();
	};
	CMOS.prototype.GetTimeVal = function () {
		var state = this.state;
		
		// ...
	};
	CMOS.prototype.UpdateTimeVal = function () {
		var state = this.state;
		
		// ...
	};
	// Calculate CMOS checksum
	CMOS.prototype.ChecksumCMOS = function () {
		var state = this.state;
		var sum = 0, idx;
		for ( idx = 0x10 ; idx <= 0x2D ; ++idx ) {
			sum += this.list_reg[ idx ].Get();
		}
		// High byte of checksum
		this.regCSumHigh.Set((sum >> 8) & 0xFF);
		// Low byte of checksum
		this.regCSumLow.Set(sum & 0xFF);
	};
	CMOS.prototype.PeriodicTimerHandler = function ( ticksNow ) {
		var state = this.state;
		
		// Periodic interrupts are enabled: trip IRQ 8
		//	and update status register C
		if ( state.regStatB.Get() & 0x40 ) {
			state.regStatC.Set(state.regStatC.Get() | 0xC0); // Interrupt Request, Periodic Int
			machine.PIC.RaiseIRQ(8);
		}
	};
	CMOS.prototype.OneSecondTimerHandler = function ( ticksNow ) {
		var state = this.state;
		
		// Divider Chain reset - RTC stopped
		if ( (state.regStatA.Get() & 0x60) == 0x60 ) { return; }
		
		// Update internal time/date buffer
		state.time = ticksNow;
		
		// Don't update CMOS user copy of time/date if CRB bit7 is 1
		// - Nothing else to do
		if ( state.regStatB.Get() & 0x80 ) { return; }
		
		state.regStatA.Set(state.regStatA.Get() | 0x80); // Set UIP bit
		
		// UIP timer for updating clock & alarm functions
		//bx_pc_system.activate_timer(BX_CMOS_THIS s.uip_timer_index, 244, 0);
		state.timerUIP.Activate(244, false);
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
		nibble = state.regStatA.Get() & 0x0F; // 1st 4 bits
		// Divider Chain Control
		dcc = (state.regStatA.Get() >> 4) & 0x07; // Next 3 bits
		
		// No Periodic Interrupt Rate when 0, deactivate timer
		if ( (nibble === 0) || ((dcc & 0x06) === 0) ) {
			state.timerPeriodic.Deactivate();
			state.intervalPeriodicUsecs = -1;	// (Effectively) max value
		} else {
			// Values 0001b & 0010b are the same as 1000b & 1001b
			if ( nibble <= 2 ) { nibble += 7; }
			
			state.intervalPeriodicUsecs = 1000000 / (32768 / (1 << (nibble - 1)));
			
			// Activate timer if Periodic Interrupt Enable bit set
			if ( state.regStatB.Get() & 0x40 ) {
				state.timerPeriodic.Activate(state.intervalPeriodicUsecs, true);
			} else {
				state.timerPeriodic.Deactivate();
			}
		}
	}
	
	// CMOS chip's I/O read operations' handler routine
	function ReadHandler( device, addr, len ) {
		var state = device.state; // "device" will be CMOS
		var result8; // 8-bit result
		
		jsEmu.Info("CMOS :: Read of CMOS register " + jsEmu.HexFormat(state.addrMemory));
		
		switch ( addr ) {
		case 0x0070:
			// NB: This register is write-only on most machines.
			jsEmu.Debug("CMOS :: Read of index port 0x70. Returning 0xFF");
			return 0xFF;
		case 0x0071:
			// Read from current CMOS memory/register (set by writing to port 0x60)
			result8 = state.list_reg[ state.addrMemory ].Get();
			// All bits of register C are cleared after a read from that particular register
			if ( state.addrMemory === REG_STAT_C ) {
				state.regStatC.Set(0x00);
				machine.PIC.LowerIRQ(8);
			}
			return result8;
		default:
			jsEmu.Panic("CMOS :: Unsupported read, address=" + jsEmu.HexFormat(addr) + "!");
			return 0;
		}
	}
	// CMOS chip's I/O write operations' handler routine
	function WriteHandler( device, addr, val, len ) {
		var state = device.state; // "device" will be CMOS
		
		var dcc;
		var valCRBPrevious;
		jsEmu.Info("CMOS :: Write to address: 0x" + jsEmu.HexFormat(addr) + " = " + jsEmu.HexFormat(val));
		
		switch ( addr ) {
		case 0x0070:	// Assign new current register address
			// This port is written to in order to specify the register for eg. reading
			state.addrMemory = val & 0x7F;
		case 0x0071:	// Write to current register
			switch ( state.addrMemory ) {
			case REG_SEC_ALARM:
			case REG_MIN_ALARM:
			case REG_HOUR_ALARM:
				state.list_reg[ state.addrMemory ].Set(val);
				jsEmu.Debug("CMOS :: Alarm time changed to " + jsEmu.TimeFormat(state.regHourAlarm.Get(), state.regMinAlarm.Get(), state.regSecAlarm.Get()));
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
				state.list_reg[ state.addrMemory ].Set(val);
				// Copy writes to IBM_CENTURY to IBM_PS2_CENTURY
				if ( state.addrMemory === REG_IBM_PS2_CENTURY_BYTE ) { state.regIBMCenturyByte.Set(val); }
				if ( state.regStatB.Get() & 0x80 ) {
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
					jsEmu.Info(("CRA: divider chain RESET"));
				} else if ( dcc > 0x02 ) {
					jsEmu.Panic("CRA: divider chain control 0x" + jsEmu.HexFormat(dcc));
				}
				state.regStatA.Set(state.regStatA.Get() & 0x80);
				state.regStatA.Set(state.regStatA.Get() | (val & 0x7F));
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
					jsEmu.Error("CMOS :: Write status reg B, daylight savings unsupported");
				}
				val &= 0xF7; // Bit3 always 0
				// Note: setting bit 7 clears bit 4
				if ( val & 0x80 ) {
					val &= 0xEF;
				}
				valCRBPrevious = state.regStatB.Get();
				state.regStatB.Set(val);
				if ( (valCRBPrevious & 0x02) != (val & 0x02) ) {
					state.modeRTC_12Hour = ((val & 0x02) == 0);
					UpdateClock();
				}
				if ( (valCRBPrevious & 0x04) != (val & 0x04) ) {
					state.modeRTC_Binary = ((val & 0x04) != 0);
					UpdateClock();
				}
				if ( (valCRBPrevious & 0x40) != (val & 0x40) ) {
					// Periodic Interrupt Enabled changed
					if ( valCRBPrevious & 0x40 ) {
						// Transition from 1 to 0, deactivate timer
						state.timerPeriodic.Deactivate();
					} else {
						// Transition from 0 to 1
						//	( if rate select is not 0, activate timer )
						if ( (state.regStatA.Get() & 0x0F) != 0 ) {
							state.timerPeriodic.Activate(state.intervalPeriodicUsecs, true);
						}
					}
				}
				if ( (valCRBPrevious >= 0x80) && (val < 0x80) && state.timeChange ) {
					device.UpdateTimeVal();
					state.timeChange = 0;
				}
				break;
			case REG_STAT_C: // Control Register C
			case REG_STAT_D: // Control Register D
				jsEmu.Error("Write to control register 0x" + jsEmu.HexFormat(state.addrMemory) + " ignored (read-only)");
				break;
			case REG_DIAGNOSTIC_STATUS:
				jsEmu.Debug("Write register 0x0e: 0x" + jsEmu.HexFormat(val));
				state.regDiagnosticStatus.Set(val);
				break;
			case REG_SHUTDOWN_STATUS:
				switch ( val ) {
				case 0x00: // Proceed with normal POST (soft reset)
					jsEmu.Debug("Reg 0Fh(00): Shutdown action = normal POST");
					break;
				case 0x01: // Shutdown after memory size check
					jsEmu.Debug("Reg 0Fh(01): Request to change shutdown action"
						+ " to shutdown after memory size check");
					break;
				case 0x02: // Shutdown after successful memory test
					jsEmu.Debug("Reg 0Fh(02): Request to change shutdown action"
						+ " to shutdown after successful memory test");
					break;
				case 0x03: // Shutdown after failed memory test
					jsEmu.Debug("Reg 0Fh(03): Request to change shutdown action"
						+ " to shutdown after successful memory test");
					break;
				case 0x04: // Jump to disk bootstrap routine
					jsEmu.Debug("Reg 0Fh(04): Request to change shutdown action"
						+ " to jump to disk bootstrap routine.");
					break;
				case 0x05: // Flush keyboard (issue EOI) and jump via 40h:0067h
					jsEmu.Debug("Reg 0Fh(05): Request to change shutdown action"
						+ " to flush keyboard (issue EOI) and jump via 40h:0067h.");
					break;
				case 0x06:
					jsEmu.Debug("Reg 0Fh(06): Shutdown after memory test !");
					break;
				case 0x07: // Reset (after failed test in virtual mode)
					jsEmu.Debug("Reg 0Fh(07): Request to change shutdown action"
						+ " to reset (after failed test in virtual mode).");
					break;
				case 0x08: // Used by POST during protected-mode RAM test (return to POST) */
					jsEmu.Debug("Reg 0Fh(08): Request to change shutdown action"
						+ " to return to POST (used by POST during protected-mode RAM test).");
					break;
				case 0x09: // Return to BIOS extended memory block move
						// ( interrupt 15h, func 87h was in progress )
					jsEmu.Debug("Reg 0Fh(09): Request to change shutdown action"
						+ " to return to BIOS extended memory block move.");
					break;
				case 0x0a: // Jump to DWORD pointer at 40:67
					jsEmu.Debug("Reg 0Fh(0a): Request to change shutdown action"
						+ " to jump to DWORD at 40:67");
					break;
				case 0x0b: // IRET to DWORD pointer at 40:67
					jsEmu.Debug("Reg 0Fh(0b): Request to change shutdown action"
						+ " to iret to DWORD at 40:67");
					break;
				case 0x0c: // RETF to DWORD pointer at 40:67
					jsEmu.Debug("Reg 0Fh(0c): Request to change shutdown action"
						+ " to retf to DWORD at 40:67");
					break;
				default:
					jsEmu.Error("Unsupported shutdown status: 0x" + jsEmu.HexFormat(val) + "!");
				}
				state.regShutdownStatus.Set(val);
				break;
			default:
				jsEmu.Debug("Write reg 0x%02x: value = 0x" + jsEmu.HexFormat(val));
				state.list_reg[ state.addrMemory ].Set(val);
			}
			break;
		default:
			jsEmu.Panic("CMOS IO ReadHandler :: Unsupported read, address=" + jsEmu.HexFormat(addr) + "!");
			return 0;
		}
	}
	/* ====== /Private ====== */
	
	/* ==== Exports ==== */
	
	/* ==== /Exports ==== */
});

// Add Module to emulator
jsEmu.AddModule(mod);