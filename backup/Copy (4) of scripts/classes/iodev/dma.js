/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: 8237 DMA (Direct Memory Access) controller class support
 */

// Augment jQuery plugin
new jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("emulator", function ( $ ) {
	var jemul8 = this.data("jemul8");
	
	/* ============ Import system after setup ============ */
	var machine, CPU, DRAM;
	this.RegisterDeferredLoader( function ( machine_, CPU_, DRAM_ ) {
		machine = machine_; CPU = CPU_; DRAM = DRAM_;
	});
	/* ============ /Import system after setup ============ */
	
	/* ====== Private ====== */
	// ( From Bochs ) map from register no. -> channel
	//	( only [0],[1],[2] & [6] used )
	var map_idx_reg_idx_channel = [ 2, 3, 1, 0, 0, 0, 0 ];
	
	/* ==== Const ==== */
	
	/* ==== /Const ==== */
	
	// Constructor / pre-init
	function DMA() {
		var idx, state;
		var core;
		
		/** 8237 DMA **/
		
		jemul8.Info("DMA PreInit");
		
		// Hold Acknowledge
		this.HLDA = new jemul8.Pin( "HLDA" );
		// Terminal Count
		this.TC = new jemul8.Pin( "TC" );
		// 16 Extra page registers (unused, as in Bochs)
		this.list_regExtraPage = [];
		for ( idx = 0 ; idx < 16 ; ++idx ) {
			this.list_regExtraPage[ idx ] = new jemul8.Register( "EXT_" + idx, 1 );
		}
		// Holds DMA-1 & DMA-2, addressable by index (for use with loops)
		this.list_core = [];
		
		this.list_fnRead8 = [];
		this.list_fnWrite8 = [];
		this.list_fnRead16 = [];
		this.list_fnWrite16 = [];
		
		// DMA-1
		core = this.DMA1 = this.list_core[ 0 ] = new DMA_Core( 0 );
		
		// DMA-2
		core = this.DMA2 = this.list_core[ 1 ] = new DMA_Core( 1 );
		core.list_channel[ 0 ].inUse = true; // Cascade channel is in use
		jemul8.Debug("DMA constructor() :: Channel 4 in use by cascade");
	}
	// Methods based on Bochs /iodev/dma.h & dma.cc
	DMA.prototype = new jemul8.IODevice( "DMA", DMA ); // Inheritance
	DMA.prototype.Init = function () {
		var addr;
		// I/O port addresses used
		// 0x0000 ... 0x000F
		for ( addr = 0x0000 ; addr <= 0x000F ; ++addr ) {
			this.RegisterIO_Read(addr, "8237 DMA", ReadHandler, 1);
			this.RegisterIO_Write(addr, "8237 DMA", WriteHandler, 3);
		}
		// 0x0080 ... 0x008F
		for ( addr = 0x0080 ; addr <= 0x008F ; ++addr ) {
			this.RegisterIO_Read(addr, "8237 DMA", ReadHandler, 1);
			this.RegisterIO_Write(addr, "8237 DMA", WriteHandler, 3);
		}
		// 0x00C0 ... 0x00DE
		for ( addr = 0x00C0 ; addr <= 0x00DE ; addr += 2 ) {
			this.RegisterIO_Read(addr, "8237 DMA", ReadHandler, 1);
			this.RegisterIO_Write(addr, "8237 DMA", WriteHandler, 3);
		}
	};
	DMA.prototype.Reset = function ( type ) {
		this.DMA1.Reset();
		this.DMA2.Reset();
	};
	
	DMA.prototype.RaiseHLDA = function () {
		var idx_channel, channel;
		var addrPhysical;
		var isCountExpired = false;
		var isSlave = false;
		var DMA1 = this.DMA1, DMA2 = this.DMA2;
		var core = DMA1;
		
		this.HLDA.Raise();
		
		// Find highest priority channel
		for ( idx_channel = 0 ; idx_channel < 4 ; ++idx_channel ) {
			if ( (DMA2.regStatus.get() & (1 << (idx_channel + 4)))
					&& (DMA2.list_channel[ idx_channel ].mask === 0) ) {
				isSlave = true;
				core = DMA2;
				break; // No need to keep looking
			}
		}
		// Highest priority channel found for slave is the master cascade channel
		if ( idx_channel === 0 ) {
			DMA2.list_channel[ 0 ].DACK.Raise();
			for ( idx_channel = 0 ; idx_channel < 4 ; ++idx_channel ) {
				if ( (DMA1.regStatus.get() & (1 << (idx_channel + 4)))
						&& (DMA1.list_channel[ idx_channel ].mask === 0) ) {
					isSlave = false;
					core = DMA1;
					break; // No need to keep looking
				}
			}
		}
		if ( idx_channel >= 4 ) {
			// Wait until they're unmasked
			return;
		}
		jemul8.Debug("DMA.RaiseHLDA() :: OK in response to DRQ " + idx_channel);
		// Cache reference
		channel = core.list_channel[ idx_channel ];
		
		// ( NB: isSlave will be converted to int )
		addrPhysical = (channel.regPage.get() << 16) | (channel.addrCurrent << isSlave);
		
		channel.DACK.Raise();
		
		// Check for expiration of count, so we can signal TC & <channel>.DACK
		//	at the same time
		if ( channel.mode.decrement_addr === 0 ) {
			++channel.addrCurrent;
		} else {
			--channel.addrCurrent;
		}
		--channel.countCurrent;
		
		if ( channel.countCurrent === 0xFFFF ) {
			// Count expired, done with transfer
			// Assert TC, deassert HRQ & <channel>.DACK lines
			core.regStatus.set(core.regStatus.get() | (1 << idx_channel)); // Hold TC in status reg
			this.TC.Raise();
			isCountExpired = true;
			if ( channel.mode.useAutoInit === false ) {
				// Set mask bit if not in AutoInit mode
				channel.mask = 1;
			} else {
				// Count expired, but in AutoInit mode,
				//	so reload count & base address
				channel.addrCurrent = channel.addrBase;
				channel.countCurrent = channel.countBase;
			}
		}
		
		var bytData, wordData;
		
		// Write: DMA-controlled transfer of byte from I/O to memory (RAM)
		if ( channel.mode.typeTransfer === 1 ) {
			// TODO
			jemul8.Panic("DMA.RaiseHLDA() :: DMA write transfer not supported yet");
		// Read: DMA-controlled transfer of byte from memory (RAM) to I/O
		} else if ( channel.mode.typeTransfer === 2 ) {
			// TODO
			jemul8.Panic("DMA.RaiseHLDA() :: DMA read transfer not supported yet");
		// Verify
		} else if ( channel.mode.typeTransfer === 0 {
			// TODO
			jemul8.Panic("DMA.RaiseHLDA() :: DMA verify not supported yet");
		} else {
			return jemul8.Panic("DMA.RaiseHLDA() :: typeTransfer > 2 is undefined");
		}
	};
	DMA.prototype.setDRQ = function ( idx_channel, val ) {
		var baseDMA, roofDMA;
		var isSlave;
		var core, channel;
		
		if ( idx_channel > 7 ) { return jemul8.Panic("DMA.setDRQ() :: idx_channel > 7"); }
		isSlave = idx_channel > 3;
		core = isSlave ? this.DMA2 : this.DMA1;
		// Only 1st 2 bits are significant
		channel = core.list_channel[ idx_channel & 0x03 ];
		channel.DRQ.set(val);
		if ( !channel.inUse ) {
			return jemul8.Panic("DMA.setDRQ() :: Channel " + idx_channel + " not connected to device");
		}
		// ( See note above )
		idx_channel &= 0x03;
		if ( !val ) {
			jemul8.Debug("DMA.setDRQ() :: Val = 0");
			// Clear bit in status reg
			core.regStatus.set(core.regStatus.get() & (~(1 << (idx_channel + 4))));
			
			core.ControlHRQ();
			return;
		}
		
		jemul8.Info("DMA.setDRQ() :: Mask[" + idx_channel + "]: " + jemul8.HexFormat(channel.mask));
		jemul8.Info("DMA.setDRQ() :: flipFlop: " + core.flipFlop);
		jemul8.Info("DMA.setDRQ() :: regStatus: " + jemul8.HexFormat(core.regStatus.get()));
		jemul8.Info("DMA.setDRQ() :: mode.type: " + jemul8.HexFormat(channel.mode.type));
		jemul8.Info("DMA.setDRQ() :: decrement_addr: " + jemul8.HexFormat(channel.mode.decrement_addr));
		jemul8.Info("DMA.setDRQ() :: enable/useAutoInit: " + jemul8.BoolFormat(channel.mode.useAutoInit));
		jemul8.Info("DMA.setDRQ() :: typeTransfer: " + jemul8.HexFormat(channel.mode.typeTransfer));
		jemul8.Info("DMA.setDRQ() :: addrBase: " + jemul8.HexFormat(channel.addrBase));
		jemul8.Info("DMA.setDRQ() :: addrCurrent: " + jemul8.HexFormat(channel.addrCurrent));
		jemul8.Info("DMA.setDRQ() :: countBase: " + jemul8.HexFormat(channel.countBase));
		jemul8.Info("DMA.setDRQ() :: countCurrent: " + jemul8.HexFormat(channel.countCurrent));
		jemul8.Info("DMA.setDRQ() :: regPage: " + jemul8.HexFormat(channel.regPage.get()));
		
		core.regStatus.set(core.regStatus.get() | (1 << (idx_channel + 4)));
		
		// Validate the channel's mode type
		if ( channel.mode.type !== DMA.DMA_MODE_SINGLE
			&& channel.mode.type !== DMA.DMA_MODE_DEMAND
			&& channel.mode.type !== DMA.DMA_MODE_CASCADE ) {
			return jemul8.Panic("DMA.setDRQ() :: mode.type " + channel.mode.type + " not handled");
		}
		
		// ( NB: isSlave will be converted to int )
		baseDMA = (channel.regPage.get() << 16) | (channel.addrBase << isSlave);
		
		// ( NB: isSlave will be converted to int )
		if ( channel.mode.decrement_addr === 0 ) {
			roofDMA = baseDMA + (channel.countBase << isSlave);
		} else {
			roofDMA = baseDMA - (channel.countBase << isSlave);
		}
		
		// ( NB: isSlave will be converted to int )
		if ( (baseDMA & (0x7FFF0000 << isSlave)) !== (roofDMA & (0x7FFF0000 << isSlave)) ) {
			jemul8.Info("DMA.setDRQ() :: baseDMA = " + jemul8.HexFormat(baseDMA));
			jemul8.Info("DMA.setDRQ() :: countBase = " + jemul8.HexFormat(channel.countBase));
			jemul8.Info("DMA.setDRQ() :: roofDMA = " + jemul8.HexFormat(roofDMA));
			// ( NB: isSlave will be converted to int )
			return jemul8.Panic("DMA.setDRQ() :: Request outside " + jemul8.HexFormat(64 << isSlave) + "k boundary");
		}
		
		core.ControlHRQ();
	};
	DMA.prototype.getTC = function () {
		return this.TC.isHigh();
	};
	DMA.prototype.RegisterState = function () {
		// ?
	};
	DMA.prototype.AfterRestoreState = function () {
		// ?
	};
	// 8-bit DMA transfers are handled by DMA-1 (master)
	DMA.prototype.RegisterDMA8Channel = function ( idx_channel, fnRead, fnWrite, name ) {
		if ( idx_channel > 3 ) {
			jemul8.Panic("DMA.RegisterDMA8Channel() :: Invalid channel #" + idx_channel);
			return false; // Fail
		}
		if ( this.DMA1.list_channel[ idx_channel ].inUse ) {
			jemul8.Panic("DMA.RegisterDMA8Channel() :: Channel #" + idx_channel + " already in use");
			return false; // Fail
		}
		jemul8.Info("DMA.RegisterDMA8Channel() :: Channel #" + idx_channel + " now used by " + name);
		this.list_fnRead8[ idx_channel ] = fnRead;
		this.list_fnWrite8[ idx_channel ] = fnWrite;
		this.DMA1.list_channel[ idx_channel ].inUse = true;
		return true; // Success
	};
	// 16-bit DMA transfers are handled by DMA-2 (slave)
	DMA.prototype.RegisterDMA16Channel = function ( idx_channel, fnRead, fnWrite, name ) {
		if ( idx_channel < 4 || idx_channel > 7 ) {
			jemul8.Panic("DMA.RegisterDMA16Channel() :: Invalid channel #" + idx_channel);
			return false; // Fail
		}
		if ( this.DMA2.list_channel[ idx_channel & 0x03 ].inUse ) {
			jemul8.Panic("DMA.RegisterDMA16Channel() :: Channel #" + idx_channel + " already in use");
			return false; // Fail
		}
		jemul8.Info("DMA.RegisterDMA16Channel() :: Channel #" + idx_channel + " now used by " + name);
		idx_channel &= 0x03;
		this.list_fnRead16[ idx_channel ] = fnRead;
		this.list_fnWrite16[ idx_channel ] = fnWrite;
		this.DMA2.list_channel[ idx_channel ].inUse = true;
		return true; // Success
	};
	DMA.prototype.UnregisterDMAChannel = function ( idx_channel ) {
		// Disable the channel
		(idx_channel > 3 ? this.DMA2 : this.DMA1).list_channel[ idx_channel & 0x03 ].inUse = 0;
		jemul8.Info("DMA.UnregisterDMAChannel() :: Channel #" + idx_channel + " no longer used");
		return true;
	};
	
	
	// There are 2 DMA cores: DMA-1 & DMA-2; this is their class
	function DMA_Core( idxCore ) {
		var idx, list, len;
		
		this.idx = idxCore;
		this.flipFlop = 0;
		this.regStatus = new jemul8.Register( "STAT", 1 );
		this.regCommand = new jemul8.Register( "CMD", 1 );
		this.disabled = false;
		
		// Create 4 DMA channels for this DMA core
		this.list_channel = [];
		for ( idx = 0 ; idx < 4 ; ++idx ) {
			this.list_channel[ idx ] = new DMA_Channel( idx );
		}
	}
	// Handle the (H)old (R)e(Q)uest line to CPU
	DMA_Core.prototype.ControlHRQ = function () {
		var idx_channel;
		
		// Do nothing if controller is disabled
		if ( this.disabled ) { return; }
		
		// Deassert HRQ if no DRQ is pending
		if ( (this.regStatus.get() & 0xF0) === 0 ) {
			if ( this.idx === 0 ) {
				machine.HRQ.Lower();
			} else {
				machine.DMA.setDRQ(4, 0);
			}
			return;
		}
		// Find highest priority channel
		for ( idx_channel = 0 ; idx_channel < 4 ; ++idx_channel ) {
			if ( (this.regStatus.get() & (1 << (idx_channel + 4)))
					&& (this.list_channel[ idx_channel ].mask === 0) ) {
				if ( this.idx === 0 ) {
					// Assert (H)old (R)e(Q)uest line to CPU
					machine.HRQ.Raise();
				} else {
					// Send DRQ to cascade channel of the master
					machine.DMA.setDRQ(4, 1);
				}
				break; // No need to keep looking
			}
		}
	};
	DMA_Core.prototype.Reset = function () {
		var idx, list, len;
		for ( idx = 0 ; idx < 4 ; ++idx ) {
			this.list_channel[ idx ].mask = 1;
		}
		this.disabled = false;
		this.regCommand.set(0x00);
		this.regStatus.set(0x00);
		this.flipFlop = 0;
	};
	
	// There are 4 channels per DMA core; this is their class
	function DMA_Channel( idx_channel ) {
		this.idx = idx_channel;
		// DMA Request
		this.DRQ = new jemul8.Pin( "DRQ" );
		// DMA Acknowledge
		this.DACK = new jemul8.Pin( "DACK" );
		this.mask = 0;
		
		this.mode = {
			type: 0 // Demand mode
			, decrement_addr: 0
			, useAutoInit: false // Auto-init enable
			, typeTransfer: 0 // Verify
		};
		this.addrBase = 0;
		this.addrCurrent = 0;
		this.countBase = 0;
		this.countCurrent = 0;
		this.regPage = new jemul8.Register( "PAGE", 1 );
		this.inUse = false;
	}
	
	// DMA chip's I/O read operations' handler routine
	function ReadHandler( device, addr, len ) {
		// "device" will be DMA
		var result8; // 8-bit result
		var idx_channel, channel;
		var isSlave;
		var core;
		
		jemul8.Info("DMA ReadHandler() :: Read addr = " + jemul8.HexFormat(addr));
		
		/** NB: This is a 8237 DMA **/
		
		isSlave = (addr >= 0xC0);
		core = isSlave ? device.DMA2 : device.DMA1;
		
		switch ( addr ) {
		case 0x0000: // DMA-1 current address, channel 0
		case 0x0002: // DMA-1 current address, channel 1
		case 0x0004: // DMA-1 current address, channel 2
		case 0x0006: // DMA-1 current address, channel 3
		case 0x00C0: // DMA-2 current address, channel 0
		case 0x00C4: // DMA-2 current address, channel 1
		case 0x00C8: // DMA-2 current address, channel 2
		case 0x00CC: // DMA-2 current address, channel 3
			idx_channel = (addr >> (1 + isSlave)) & 0x03;
			core.flipFlop = !core.flipFlop;
			if ( core.flipFlop === 0 ) {
				// Low byte
				return core.list_channel[ idx_channel ].addrCurrent & 0xFF;
			} else {
				// High byte
				return core.list_channel[ idx_channel ].addrCurrent >> 8;
			}
			break;
		case 0x0001: // DMA-1 current count, channel 0
		case 0x0003: // DMA-1 current count, channel 1
		case 0x0005: // DMA-1 current count, channel 2
		case 0x0007: // DMA-1 current count, channel 3
		case 0x00C2: // DMA-2 current count, channel 0
		case 0x00C6: // DMA-2 current count, channel 1
		case 0x00CA: // DMA-2 current count, channel 2
		case 0x00CE: // DMA-2 current count, channel 3
			idx_channel = (addr >> (1 + isSlave)) & 0x03;
			core.flipFlop = !core.flipFlop;
			if ( core.flipFlop === 0 ) {
				// Low byte
				return core.list_channel[ idx_channel ].countCurrent & 0xFF;
			} else {
				// High byte
				return core.list_channel[ idx_channel ].countCurrent >> 8;
			}
			break;
		case 0x0008: // DMA-1 Status Register
		case 0x00D0: // DMA-2 Status Register
			/*
			 *	Bit #7: 1 = channel 3 request
			 *	Bit #6: 1 = channel 2 request
			 *	Bit #5: 1 = channel 1 request
			 *	Bit #4: 1 = channel 0 request
			 *	Bit #3: 1 = channel 3 has reached terminal count
			 *	Bit #2: 1 = channel 2 has reached terminal count
			 *	Bit #1: 1 = channel 1 has reached terminal count
			 *	Bit #0: 1 = channel 0 has reached terminal count
			 *	( NB: Reading this register clears lower 4 bits (hold flags) )
			 */
			result8 = core.regStatus.get();
			core.regStatus.set(core.regStatus.get() & 0xF0);
			return result8;
		case 0x0D: // DMA-1 Temporary register
		case 0xDA: // DMA-2 Temporary register
			jemul8.Error("DMA-" + (isSlave + 1) + " ReadHandler() :: Read of temporary register always returns 0");
			return 0;
		case 0x0081: // DMA-1 page register, channel 2
		case 0x0082: // DMA-1 page register, channel 3
		case 0x0083: // DMA-1 page register, channel 1
		case 0x0087: // DMA-1 page register, channel 0
			idx_channel = map_idx_reg_idx_channel[ addr - 0x81 ];
			return device.DMA1.list_channel[ idx_channel ].regPage.get();
		case 0x0089: // DMA-2 page register, channel 2
		case 0x008A: // DMA-2 page register, channel 3
		case 0x008B: // DMA-2 page register, channel 1
		case 0x008F: // DMA-2 page register, channel 0
			idx_channel = map_idx_reg_idx_channel[ addr - 0x89 ];
			return device.DMA2.list_channel[ idx_channel ].regPage.get();
		case 0x0080:
		case 0x0084:
		case 0x0085:
		case 0x0086:
		case 0x0088:
		case 0x008C:
		case 0x008D:
		case 0x008E:
			jemul8.Debug("DMA ReadHandler() :: Read of extra page register " + jemul8.HexFormat(addr) + " (unused)");
			return device.list_regExtraPage[ addr & 0x0F ].get();
		case 0x0F: // DMA-1 undocumented: read all mask bits
		case 0xDE: // DMA-2 undocumented: read all mask bits
			result8 = (core.list_channel[ 0 ].mask)
					| (core.list_channel[ 1 ].mask << 1)
					| (core.list_channel[ 2 ].mask << 2)
					| (core.list_channel[ 3 ].mask << 3);
			return (0xF0 | result8);
		default:
			jemul8.Panic("DMA ReadHandler() :: Unsupported read, address=" + jemul8.HexFormat(addr) + "!");
			return 0;
		}
	}
	// DMA chip's I/O write operations' handler routine
	function WriteHandler( device, addr, val, len ) {
		var state = device.state; // "device" will be PIC
		var PICmaster = state.PICmaster, PICslave = state.PICslave;
		
		jemul8.Info("DMA WriteHandler() :: Write to address: " + jemul8.HexFormat(addr) + " = " + jemul8.HexFormat(val));
		
		/** NB: This is a 8259A PIC **/
		
		switch ( addr ) {
		case 0x20:
			return PICmaster.InitCommand(val);
		// Initialization mode operation
		case 0x21:
			return PICmaster.InitModeOperation(val);
		case 0xA0:
			return PICslave.InitCommand(val);
		// Initialization mode operation
		case 0xA1:
			return PICslave.InitModeOperation(val);
		default:
			jemul8.Panic("PIC WriteHandler() :: Unsupported write, address=" + jemul8.HexFormat(addr) + "!");
			return 0;
		}
	}
	/* ====== /Private ====== */
	
	/* ==== Exports ==== */
	
	/* ==== /Exports ==== */
});

// Add Module to emulator
jemul8.AddModule(mod);