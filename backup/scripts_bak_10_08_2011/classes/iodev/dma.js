/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: 8237 DMA (Direct Memory Access) controller class support
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("dma", function ( $ ) {
	var x86Emu = this.data("x86Emu");
	
	// Import system after setup
	var machine, CPU, DRAM;
	this.bind("load", function ( $, machine_, CPU_, DRAM_ ) {
		machine = machine_; CPU = CPU_; DRAM = DRAM_;
	});
	
	/* ====== Private ====== */
	// ( From Bochs ) map from register no. -> channel
	//	( only [0],[1],[2] & [6] used )
	var map_idx_reg_idx_channel = [ 2, 3, 1, 0, 0, 0, 0 ];
	
	/* ==== Const ==== */
	
	/* ==== /Const ==== */
	
	// Constructor / pre-init
	function DMA( emu ) {
		var idx, state;
		var core;
		
		/** 8237 DMA **/
		
		$.info("DMA PreInit");
		
		this.emu = emu;
		
		// Hold Acknowledge
		this.HLDA = new x86Emu.Pin( "HLDA" );
		// Terminal Count
		this.TC = new x86Emu.Pin( "TC" );
		// 16 Extra page registers (unused, as in Bochs)
		this.list_regExtraPage = [];
		for ( idx = 0 ; idx < 16 ; ++idx ) {
			this.list_regExtraPage[ idx ] = new x86Emu.Register( "EXT_" + idx, 1 );
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
		$.debug("DMA constructor() :: Channel 4 in use by cascade");
	}
	// Methods based on Bochs /iodev/dma.h & dma.cc
	DMA.prototype = new x86Emu.IODevice( "DMA", DMA ); // Inheritance
	DMA.prototype.init = function () {
		var addr;
		// I/O port addresses used
		// 0x0000 ... 0x000F
		for ( addr = 0x0000 ; addr <= 0x000F ; ++addr ) {
			this.registerIO_Read(addr, "8237 DMA", readHandler, 1);
			this.registerIO_Write(addr, "8237 DMA", writeHandler, 3);
		}
		// 0x0080 ... 0x008F
		for ( addr = 0x0080 ; addr <= 0x008F ; ++addr ) {
			this.registerIO_Read(addr, "8237 DMA", readHandler, 1);
			this.registerIO_Write(addr, "8237 DMA", writeHandler, 3);
		}
		// 0x00C0 ... 0x00DE
		for ( addr = 0x00C0 ; addr <= 0x00DE ; addr += 2 ) {
			this.registerIO_Read(addr, "8237 DMA", readHandler, 1);
			this.registerIO_Write(addr, "8237 DMA", writeHandler, 3);
		}
	};
	DMA.prototype.reset = function ( type ) {
		this.DMA1.reset();
		this.DMA2.reset();
	};
	
	DMA.prototype.raiseHLDA = function () {
		var idx_channel, channel;
		var addrPhysical;
		var isCountExpired = false;
		var isSlave = false;
		var DMA1 = this.DMA1, DMA2 = this.DMA2;
		var core = DMA1;
		
		this.HLDA.raise();
		
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
			DMA2.list_channel[ 0 ].DACK.raise();
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
		$.debug("DMA.raiseHLDA() :: OK in response to DRQ " + idx_channel);
		// Cache reference
		channel = core.list_channel[ idx_channel ];
		
		// ( NB: isSlave will be converted to int )
		addrPhysical = (channel.regPage.get() << 16) | (channel.addrCurrent << isSlave);
		
		channel.DACK.raise();
		
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
			this.TC.raise();
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
			$.panic("DMA.raiseHLDA() :: DMA write transfer not supported yet");
		// Read: DMA-controlled transfer of byte from memory (RAM) to I/O
		} else if ( channel.mode.typeTransfer === 2 ) {
			// TODO
			$.panic("DMA.raiseHLDA() :: DMA read transfer not supported yet");
		// Verify
		} else if ( channel.mode.typeTransfer === 0 {
			// TODO
			$.panic("DMA.raiseHLDA() :: DMA verify not supported yet");
		} else {
			return $.panic("DMA.raiseHLDA() :: typeTransfer > 2 is undefined");
		}
	};
	DMA.prototype.setDRQ = function ( idx_channel, val ) {
		var baseDMA, roofDMA;
		var isSlave;
		var core, channel;
		
		if ( idx_channel > 7 ) { return $.panic("DMA.setDRQ() :: idx_channel > 7"); }
		isSlave = idx_channel > 3;
		core = isSlave ? this.DMA2 : this.DMA1;
		// Only 1st 2 bits are significant
		channel = core.list_channel[ idx_channel & 0x03 ];
		channel.DRQ.set(val);
		if ( !channel.inUse ) {
			return $.panic("DMA.setDRQ() :: Channel " + idx_channel + " not connected to device");
		}
		// ( See note above )
		idx_channel &= 0x03;
		if ( !val ) {
			$.debug("DMA.setDRQ() :: Val = 0");
			// Clear bit in status reg
			core.regStatus.set(core.regStatus.get() & (~(1 << (idx_channel + 4))));
			
			core.ControlHRQ();
			return;
		}
		
		$.info("DMA.setDRQ() :: Mask[" + idx_channel + "]: " + $.format("hex", channel.mask));
		$.info("DMA.setDRQ() :: flipFlop: " + core.flipFlop);
		$.info("DMA.setDRQ() :: regStatus: " + $.format("hex", core.regStatus.get()));
		$.info("DMA.setDRQ() :: mode.type: " + $.format("hex", channel.mode.type));
		$.info("DMA.setDRQ() :: decrement_addr: " + $.format("hex", channel.mode.decrement_addr));
		$.info("DMA.setDRQ() :: enable/useAutoInit: " + $.format("bool", channel.mode.useAutoInit));
		$.info("DMA.setDRQ() :: typeTransfer: " + $.format("hex", channel.mode.typeTransfer));
		$.info("DMA.setDRQ() :: addrBase: " + $.format("hex", channel.addrBase));
		$.info("DMA.setDRQ() :: addrCurrent: " + $.format("hex", channel.addrCurrent));
		$.info("DMA.setDRQ() :: countBase: " + $.format("hex", channel.countBase));
		$.info("DMA.setDRQ() :: countCurrent: " + $.format("hex", channel.countCurrent));
		$.info("DMA.setDRQ() :: regPage: " + $.format("hex", channel.regPage.get()));
		
		core.regStatus.set(core.regStatus.get() | (1 << (idx_channel + 4)));
		
		// Validate the channel's mode type
		if ( channel.mode.type !== DMA.DMA_MODE_SINGLE
			&& channel.mode.type !== DMA.DMA_MODE_DEMAND
			&& channel.mode.type !== DMA.DMA_MODE_CASCADE ) {
			return $.panic("DMA.setDRQ() :: mode.type " + channel.mode.type + " not handled");
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
			$.info("DMA.setDRQ() :: baseDMA = " + $.format("hex", baseDMA));
			$.info("DMA.setDRQ() :: countBase = " + $.format("hex", channel.countBase));
			$.info("DMA.setDRQ() :: roofDMA = " + $.format("hex", roofDMA));
			// ( NB: isSlave will be converted to int )
			return $.panic("DMA.setDRQ() :: Request outside " + $.format("hex", 64 << isSlave) + "k boundary");
		}
		
		core.ControlHRQ();
	};
	DMA.prototype.getTC = function () {
		return this.TC.isHigh();
	};
	DMA.prototype.registerState = function () {
		// ?
	};
	DMA.prototype.afterRestoreState = function () {
		// ?
	};
	// 8-bit DMA transfers are handled by DMA-1 (master)
	DMA.prototype.registerDMA8Channel = function ( idx_channel, fnRead, fnWrite, name ) {
		if ( idx_channel > 3 ) {
			$.panic("DMA.registerDMA8Channel() :: Invalid channel #" + idx_channel);
			return false; // Fail
		}
		if ( this.DMA1.list_channel[ idx_channel ].inUse ) {
			$.panic("DMA.registerDMA8Channel() :: Channel #" + idx_channel + " already in use");
			return false; // Fail
		}
		$.info("DMA.registerDMA8Channel() :: Channel #" + idx_channel + " now used by " + name);
		this.list_fnRead8[ idx_channel ] = fnRead;
		this.list_fnWrite8[ idx_channel ] = fnWrite;
		this.DMA1.list_channel[ idx_channel ].inUse = true;
		return true; // Success
	};
	// 16-bit DMA transfers are handled by DMA-2 (slave)
	DMA.prototype.registerDMA16Channel = function ( idx_channel, fnRead, fnWrite, name ) {
		if ( idx_channel < 4 || idx_channel > 7 ) {
			$.panic("DMA.registerDMA16Channel() :: Invalid channel #" + idx_channel);
			return false; // Fail
		}
		if ( this.DMA2.list_channel[ idx_channel & 0x03 ].inUse ) {
			$.panic("DMA.registerDMA16Channel() :: Channel #" + idx_channel + " already in use");
			return false; // Fail
		}
		$.info("DMA.registerDMA16Channel() :: Channel #" + idx_channel + " now used by " + name);
		idx_channel &= 0x03;
		this.list_fnRead16[ idx_channel ] = fnRead;
		this.list_fnWrite16[ idx_channel ] = fnWrite;
		this.DMA2.list_channel[ idx_channel ].inUse = true;
		return true; // Success
	};
	DMA.prototype.UnregisterDMAChannel = function ( idx_channel ) {
		// Disable the channel
		(idx_channel > 3 ? this.DMA2 : this.DMA1).list_channel[ idx_channel & 0x03 ].inUse = 0;
		$.info("DMA.UnregisterDMAChannel() :: Channel #" + idx_channel + " no longer used");
		return true;
	};
	
	
	// There are 2 DMA cores: DMA-1 & DMA-2; this is their class
	function DMA_Core( idxCore ) {
		var idx, list, len;
		
		this.idx = idxCore;
		this.flipFlop = 0;
		this.regStatus = new x86Emu.Register( "STAT", 1 );
		this.regCommand = new x86Emu.Register( "CMD", 1 );
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
				machine.HRQ.lower();
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
					machine.HRQ.raise();
				} else {
					// Send DRQ to cascade channel of the master
					machine.DMA.setDRQ(4, 1);
				}
				break; // No need to keep looking
			}
		}
	};
	DMA_Core.prototype.reset = function () {
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
		this.DRQ = new x86Emu.Pin( "DRQ" );
		// DMA Acknowledge
		this.DACK = new x86Emu.Pin( "DACK" );
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
		this.regPage = new x86Emu.Register( "PAGE", 1 );
		this.inUse = false;
	}
	
	// DMA chip's I/O read operations' handler routine
	function readHandler( device, addr, len ) {
		// "device" will be DMA
		var result8; // 8-bit result
		var idx_channel, channel;
		var isSlave;
		var core;
		
		$.info("DMA readHandler() :: Read addr = " + $.format("hex", addr));
		
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
			$.problem("DMA-" + (isSlave + 1) + " readHandler() :: Read of temporary register always returns 0");
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
			$.debug("DMA readHandler() :: Read of extra page register " + $.format("hex", addr) + " (unused)");
			return device.list_regExtraPage[ addr & 0x0F ].get();
		case 0x0F: // DMA-1 undocumented: read all mask bits
		case 0xDE: // DMA-2 undocumented: read all mask bits
			result8 = (core.list_channel[ 0 ].mask)
					| (core.list_channel[ 1 ].mask << 1)
					| (core.list_channel[ 2 ].mask << 2)
					| (core.list_channel[ 3 ].mask << 3);
			return (0xF0 | result8);
		default:
			$.panic("DMA readHandler() :: Unsupported read, address=" + $.format("hex", addr) + "!");
			return 0;
		}
	}
	// DMA chip's I/O write operations' handler routine
	function writeHandler( device, addr, val, len ) {
		var state = device.state; // "device" will be PIC
		var PICmaster = state.PICmaster, PICslave = state.PICslave;
		
		$.info("DMA writeHandler() :: Write to address: " + $.format("hex", addr) + " = " + $.format("hex", val));
		
		/** NB: This is a 8259A PIC **/
		
		switch ( addr ) {
		case 0x20:
			return PICmaster.initCommand(val);
		// Initialization mode operation
		case 0x21:
			return PICmaster.initModeOperation(val);
		case 0xA0:
			return PICslave.initCommand(val);
		// Initialization mode operation
		case 0xA1:
			return PICslave.initModeOperation(val);
		default:
			$.panic("PIC writeHandler() :: Unsupported write, address=" + $.format("hex", addr) + "!");
			return 0;
		}
	}
	/* ====== /Private ====== */
	
	// Exports
	x86Emu.DMA = DMA;
});
