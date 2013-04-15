/*
 * jemul8 - JavaScript x86 Emulator
 *
 * MODULE: 8237 DMA (Direct Memory Access) controller class support
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
	"../pin",
	"../register"
], function (
	util,
	IODevice,
	Pin,
	Register
) {
    "use strict";

	// TODO: Should be a config setting
	var enableDebug = false;

	var debug = enableDebug ? function (msg) {
		util.debug(msg);
	} : function () {};

	/* ====== Private ====== */
	// (From Bochs) map from register no. -> channel
	//	(only [0],[1],[2] & [6] used)
	// [Bit8u channelindex[7]] in Bochs' /iodev/dma.cc
	var map_idx_reg_idx_channel = [ 2, 3, 1, 0, 0, 0, 0 ];

	var DMA_MODE_DEMAND    = 0;
	var DMA_MODE_SINGLE    = 1;
	var DMA_MODE_BLOCK     = 2;
	var DMA_MODE_CASCADE   = 3;

	// Constructor / pre-init
	function DMA(machine) {
		util.assert(this && (this instanceof DMA), "DMA ctor ::"
			+ " error - constructor not called properly");

		var idx;
        var core;

		/** 8237 DMA **/

		util.info("DMA (Intel 8237) PreInit");

		this.machine = machine;

		// Hold Acknowledge
		this.HLDA = new Pin("HLDA");
		// Terminal Count
		this.TC = new Pin("TC");
		// 16 Extra page registers (unused, as in Bochs)
		this.list_regExtraPage = [];
		for (idx = 0 ; idx < 16 ; ++idx) {
			this.list_regExtraPage[ idx ] = new Register("EXT_" + idx, 1);
		}
		// Holds DMA-1 & DMA-2, addressable by index (for use with loops)
		this.list_core = [];

		this.list_thisObj8 = [];
		this.list_fnRead8 = [];
		this.list_fnWrite8 = [];

		this.list_thisObj16 = [];
		this.list_fnRead16 = [];
		this.list_fnWrite16 = [];

		// DMA-1
		core = this.DMA1 = this.list_core[ 0 ] = new DMA_Core(this, 0);

		// DMA-2 (Master)
		core = this.DMA2 = this.list_core[ 1 ] = new DMA_Core(this, 1);
		core.list_channel[ 0 ].inUse = true; // Cascade channel is in use
		debug("DMA constructor() :: Channel 4 in use by cascade");
	}
	// Methods based on Bochs /iodev/dma.h & dma.cc
	util.inherit(DMA, IODevice, "DMA"); // Inheritance
	util.extend(DMA, {
		DMA_MODE_DEMAND:    DMA_MODE_DEMAND
		, DMA_MODE_SINGLE:  DMA_MODE_SINGLE
		, DMA_MODE_BLOCK:   DMA_MODE_BLOCK
		, DMA_MODE_CASCADE: DMA_MODE_CASCADE
	});
	DMA.prototype.init = function (done, fail) {
		var addr;
		// I/O port addresses used
		// 0x0000 ... 0x000F
		for (addr = 0x0000 ; addr <= 0x000F ; ++addr) {
			this.registerIO_Read(addr, "8237 DMA", readHandler, 1);
			this.registerIO_Write(addr, "8237 DMA", writeHandler, 3);
		}
		// 0x0080 ... 0x008F
		for (addr = 0x0080 ; addr <= 0x008F ; ++addr) {
			this.registerIO_Read(addr, "8237 DMA", readHandler, 1);
			this.registerIO_Write(addr, "8237 DMA", writeHandler, 3);
		}
		// 0x00C0 ... 0x00DE
		for (addr = 0x00C0 ; addr <= 0x00DE ; addr += 2) {
			this.registerIO_Read(addr, "8237 DMA", readHandler, 1);
			this.registerIO_Write(addr, "8237 DMA", writeHandler, 3);
		}

		done();
	};
	// Based on [bx_dma_c::reset]
	DMA.prototype.reset = function (type) {
		this.DMA1.reset();
		this.DMA2.reset();
	};
	// Based on [bx_dma_c::raise_HLDA]
	DMA.prototype.raiseHLDA = function () {
		var machine = this.machine;
        var mem = machine.mem;
		var idx_channel;
        var channel;
		var addrPhysical;
		var countExpired = false;
		var isMaster = false;
		var DMA1 = this.DMA1;
        var DMA2 = this.DMA2;
		var core = DMA1;

		this.HLDA.raise();

		// Find highest priority channel
		for (idx_channel = 0 ; idx_channel < 4 ; ++idx_channel) {
			if ( (DMA2.regStatus.get() & (1 << (idx_channel + 4)))
					&& (DMA2.list_channel[ idx_channel ].mask === 0) ) {
				isMaster = true;
				core = DMA2;
				break; // No need to keep looking
			}
		}
		// Highest priority channel found for slave is the master cascade channel
		if (idx_channel === 0) {
			DMA2.list_channel[ 0 ].DACK.raise();
			for (idx_channel = 0 ; idx_channel < 4 ; ++idx_channel) {
				if ( (DMA1.regStatus.get() & (1 << (idx_channel + 4)))
						&& (DMA1.list_channel[ idx_channel ].mask === 0) ) {
					isMaster = false;
					core = DMA1;
					break; // No need to keep looking
				}
			}
		}
		if (idx_channel >= 4) {
			// Wait until they're unmasked
			return;
		}
		//debug("DMA.raiseHLDA() :: OK in response to DRQ " + idx_channel);
		// Cache reference
		channel = core.list_channel[ idx_channel ];

		// (NB: isMaster will be converted to int)
		addrPhysical = (channel.regPage.get() << 16) | (channel.addrCurrent << isMaster);

		channel.DACK.raise();

		// Check for expiration of count, so we can signal TC & <channel>.DACK
		//	at the same time
		if (channel.mode.decrement_addr === 0) {
			channel.addrCurrent = (channel.addrCurrent + 1) & 0xFFFF;
		} else {
			channel.addrCurrent = (channel.addrCurrent - 1) & 0xFFFF;
		}
		channel.countCurrent = (channel.countCurrent - 1) & 0xFFFF;

		if (channel.countCurrent === 0xFFFF) {
			// Count expired, done with transfer
			// Assert TC, deassert HRQ & <channel>.DACK lines
			core.regStatus.set(core.regStatus.get() | (1 << idx_channel)); // Hold TC in status reg
			this.TC.raise();
			countExpired = true;
			if (channel.mode.useAutoInit === false) {
				// Set mask bit if not in AutoInit mode
				channel.mask = 1;
			} else {
				// Count expired, but in AutoInit mode,
				//	so reload count & base address
				channel.addrCurrent = channel.addrBase;
				channel.countCurrent = channel.countBase;
			}
		}

		var thisObj, fn, val;

		// Write: DMA-controlled transfer of byte from I/O to memory (RAM)
		if (channel.mode.typeTransfer === 1) {
			// TODO
			//util.panic("DMA.raiseHLDA() :: DMA write transfer not supported yet");
			//debugger;
			if (!isMaster) {
				thisObj = this.list_thisObj8[ idx_channel ];
				fn = this.list_fnWrite8[ idx_channel ];
				if (!fn) {
					util.panic(util.sprintf(
						"DMA.raiseHLDA() :: No DMA write handler for channel %u."
						, idx_channel
					));
				}
				val = fn.call(thisObj);
				mem.writePhysical(addrPhysical, val, 1);
			} else {
				thisObj = this.list_thisObj16[ idx_channel ];
				fn = this.list_fnWrite16[ idx_channel ];
				if (!fn) {
					util.panic(util.sprintf(
						"DMA.raiseHLDA() :: No DMA write handler for channel %u."
						, idx_channel
					));
				}
				val = fn.call(thisObj);
				mem.writePhysical(addrPhysical, val, 2);
			}
		// Read: DMA-controlled transfer of byte from memory (RAM) to I/O
		} else if (channel.mode.typeTransfer === 2) {
			// TODO
			//util.panic("DMA.raiseHLDA() :: DMA read transfer not supported yet");
			//return;
			if (!isMaster) {
				thisObj = this.list_thisObj8[ idx_channel ];
				fn = this.list_fnRead8[ idx_channel ];
				if (!fn) {
					util.panic(util.sprintf(
						"DMA.raiseHLDA() :: No DMA read handler for channel %u."
						, idx_channel
					));
				}
				val = mem.readPhysical(addrPhysical, 1);
				fn.call(thisObj, val);
			} else {
				thisObj = this.list_thisObj16[ idx_channel ];
				fn = this.list_fnRead16[ idx_channel ];
				if (!fn) {
					util.panic(util.sprintf(
						"DMA.raiseHLDA() :: No DMA read handler for channel %u."
						, idx_channel
					));
				}
				val = mem.readPhysical(addrPhysical, 2);
				fn.call(thisObj, val);
			}
		// Verify
		} else if (channel.mode.typeTransfer === 0) {
			// TODO
			util.panic("DMA.raiseHLDA() :: DMA verify not supported yet");
			return;
		} else {
			util.panic("DMA.raiseHLDA() :: typeTransfer > 2 is undefined");
			return;
		}

		if (countExpired) {
			this.TC.lower(); // clear TC, adapter card already notified
			this.HLDA.lower();
			machine.HRQ.lower(); // clear HRQ to CPU
			channel.DACK.lower(); // clear DACK to adapter card
			if (!isMaster) {
				this.setDRQ(4, 0); // clear DRQ to cascade
				this.DMA2.list_channel[ 0 ].DACK.lower(); // clear DACK to cascade
			}
		}
	};
	// Based on [bx_dma_c::set_DRQ]
	DMA.prototype.setDRQ = function (idx_channel, val) {
		var baseDMA, roofDMA;
		var isMaster;
		var core, channel;

		if (idx_channel > 7) {
			util.panic("DMA.setDRQ() :: idx_channel > 7");
			return;
		}
		isMaster = idx_channel > 3;
		core = isMaster ? this.DMA2 : this.DMA1;
		// Only 1st 2 bits are significant
		channel = core.list_channel[ idx_channel & 0x03 ];
		channel.DRQ.set(val);
		if (!channel.inUse) {
			util.panic("DMA.setDRQ() :: Channel " + idx_channel + " not connected to device");
			return;
		}
		// (See note above)
		idx_channel &= 0x03;
		if (!val) {
			debug("DMA.setDRQ() :: Val = 0");
			// Clear bit in status reg
			//debugger;
			core.regStatus.set(core.regStatus.get() & (~(1 << (idx_channel + 4))/*>>>0*/));

			core.controlHRQ();
			return;
		}

		debug("DMA.setDRQ() :: Mask[" + idx_channel + "]: " + util.format("hex", channel.mask));
		debug("DMA.setDRQ() :: flipFlop: " + core.flipFlop);
		debug("DMA.setDRQ() :: regStatus: " + util.format("hex", core.regStatus.get()));
		debug("DMA.setDRQ() :: mode.type: " + util.format("hex", channel.mode.type));
		debug("DMA.setDRQ() :: decrement_addr: " + util.format("hex", channel.mode.decrement_addr));
		debug("DMA.setDRQ() :: enable/useAutoInit: " + util.format("bool", channel.mode.useAutoInit));
		debug("DMA.setDRQ() :: typeTransfer: " + util.format("hex", channel.mode.typeTransfer));
		debug("DMA.setDRQ() :: addrBase: " + util.format("hex", channel.addrBase));
		debug("DMA.setDRQ() :: addrCurrent: " + util.format("hex", channel.addrCurrent));
		debug("DMA.setDRQ() :: countBase: " + util.format("hex", channel.countBase));
		debug("DMA.setDRQ() :: countCurrent: " + util.format("hex", channel.countCurrent));
		debug("DMA.setDRQ() :: regPage: " + util.format("hex", channel.regPage.get()));

		core.regStatus.set(core.regStatus.get() | (1 << (idx_channel + 4)));

		// Validate the channel's mode type
		if ( channel.mode.type !== DMA_MODE_SINGLE
				&& channel.mode.type !== DMA_MODE_DEMAND
				&& channel.mode.type !== DMA_MODE_CASCADE ) {
			util.panic("DMA.setDRQ() :: mode.type "
				+ channel.mode.type + " not handled");
			return 0;
		}

		// (NB: isMaster will be converted to int)
		baseDMA = (channel.regPage.get() << 16)
			| (channel.addrBase << isMaster);

		// (NB: isMaster will be converted to int)
		if (channel.mode.decrement_addr === 0) {
			roofDMA = baseDMA + (channel.countBase << isMaster);
		} else {
			roofDMA = baseDMA - (channel.countBase << isMaster);
		}

		// (NB: isMaster will be converted to int)
		if ( (baseDMA & (0x7FFF0000 << isMaster))
				!== (roofDMA & (0x7FFF0000 << isMaster)) ) {
			util.info("DMA.setDRQ() :: baseDMA = " + util.format("hex", baseDMA));
			util.info("DMA.setDRQ() :: countBase = " + util.format("hex", channel.countBase));
			util.info("DMA.setDRQ() :: roofDMA = " + util.format("hex", roofDMA));
			// (NB: isMaster will be converted to int)
			util.panic("DMA.setDRQ() :: Request outside "
				+ util.format("hex", 64 << isMaster) + "k boundary");
			return 0;
		}

		core.controlHRQ();
	};
	// Based on [bx_dma_c::get_TC]
	DMA.prototype.getTC = function () {
		return this.TC.isHigh();
	};
	DMA.prototype.registerState = function () {
		// ?
	};
	DMA.prototype.afterRestoreState = function () {
		// ?
	};
	// 8-bit DMA transfers are handled by DMA-1 (slave)
	DMA.prototype.registerDMA8Channel = function (idx_channel, thisObj, fnRead, fnWrite, name) {
		if (idx_channel > 3) {
			util.panic("DMA.registerDMA8Channel() :: Invalid channel #" + idx_channel);
			return false; // Fail
		}
		if (this.DMA1.list_channel[ idx_channel ].inUse) {
			util.panic("DMA.registerDMA8Channel() :: Channel #" + idx_channel + " already in use");
			return false; // Fail
		}
		util.info("DMA.registerDMA8Channel() :: Channel #" + idx_channel + " now used by " + name);
		this.list_thisObj8[ idx_channel ] = thisObj;
		this.list_fnRead8[ idx_channel ] = fnRead;
		this.list_fnWrite8[ idx_channel ] = fnWrite;
		this.DMA1.list_channel[ idx_channel ].inUse = true;
		return true; // Success
	};
	// 16-bit DMA transfers are handled by DMA-2 (master)
	DMA.prototype.registerDMA16Channel = function (idx_channel, thisObj, fnRead, fnWrite, name) {
		if (idx_channel < 4 || idx_channel > 7) {
			util.panic("DMA.registerDMA16Channel() ::"
				+ " Invalid channel #" + idx_channel);
			return false; // Fail
		}
		if (this.DMA2.list_channel[ idx_channel & 0x03 ].inUse) {
			util.panic("DMA.registerDMA16Channel() :: Channel #"
				+ idx_channel + " already in use");
			return false; // Fail
		}
		util.info("DMA.registerDMA16Channel() :: Channel #"
			+ idx_channel + " now used by " + name);
		idx_channel &= 0x03;
		this.list_thisObj16[ idx_channel ] = thisObj;
		this.list_fnRead16[ idx_channel ] = fnRead;
		this.list_fnWrite16[ idx_channel ] = fnWrite;
		this.DMA2.list_channel[ idx_channel ].inUse = true;
		return true; // Success
	};
	DMA.prototype.unregisterDMAChannel = function (idx_channel) {
		// Disable the channel
		(idx_channel > 3 ? this.DMA2 : this.DMA1)
			.list_channel[ idx_channel & 0x03 ].inUse = false;
		util.info("DMA.unregisterDMAChannel() :: Channel #"
			+ idx_channel + " no longer used");
		return true;
	};


	// There are 2 DMA cores: DMA-1 & DMA-2; this is their class
	function DMA_Core(cntrlr, idxCore) {
		var idx, list, len;

		this.cntrlr = cntrlr;

		this.idx = idxCore;
		this.flipFlop = false;
		this.regStatus = new Register("STAT", 1);
		this.regCommand = new Register("CMD", 1);
		this.disabled = false;

		// Create 4 DMA channels for this DMA core
		this.list_channel = [];
		for (idx = 0 ; idx < 4 ; ++idx) {
			this.list_channel[ idx ] = new DMA_Channel(idx);
		}
	}
	// Handle the (H)old (R)e(Q)uest line to CPU
	// Based on [bx_dma_c::control_HRQ]
	DMA_Core.prototype.controlHRQ = function () {
		var cntrlr = this.cntrlr
			, machine = cntrlr.machine
			, idx_channel;
		//debugger;
		// Do nothing if controller is disabled
		if (this.disabled) { return; }

		// Deassert HRQ if no DRQ is pending
		if ((this.regStatus.get() & 0xF0) === 0) {
			if (this.idx === 1) {
				machine.HRQ.lower();
			} else {
				cntrlr.setDRQ(4, 0);
			}
			return;
		}
		// Find highest priority channel
		for (idx_channel = 0 ; idx_channel < 4 ; ++idx_channel) {
			if ( (this.regStatus.get() & (1 << (idx_channel + 4)))
					&& (this.list_channel[ idx_channel ].mask === 0) ) {
				if (this.idx === 1) {
					// Assert (H)old (R)e(Q)uest line to CPU
					machine.HRQ.raise();
				} else {
					// Send DRQ to cascade channel of the master
					cntrlr.setDRQ(4, 1);
				}
				break; // No need to keep looking
			}
		}
	};
	DMA_Core.prototype.reset = function () {
		var idx, list, len;
		for (idx = 0 ; idx < 4 ; ++idx) {
			this.list_channel[ idx ].mask = 1;
		}
		this.disabled = false;
		this.regCommand.set(0x00);
		this.regStatus.set(0x00);
		this.flipFlop = false;
	};

	// There are 4 channels per DMA core; this is their class
	function DMA_Channel(idx_channel) {
		this.idx = idx_channel;
		// DMA Request
		this.DRQ = new Pin("DRQ");
		// DMA Acknowledge
		this.DACK = new Pin("DACK");
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
		this.regPage = new Register("PAGE", 1);
		this.inUse = false;
	}

	// DMA chip's I/O read operations' handler routine
	function readHandler(device, addr, io_len) {
		// "device" will be DMA
		var result8; // 8-bit result
		var idx_channel, channel;
		var isMaster;
		var core;

		util.info("DMA readHandler() :: Read addr = " + util.format("hex", addr));

		/** NB: This is a 8237 DMA **/

		isMaster = (addr >= 0xC0);
		core = isMaster ? device.DMA2 : device.DMA1;

		switch (addr) {
		case 0x0000: // DMA-1 current address, channel 0
		case 0x0002: // DMA-1 current address, channel 1
		case 0x0004: // DMA-1 current address, channel 2
		case 0x0006: // DMA-1 current address, channel 3
		case 0x00C0: // DMA-2 current address, channel 0
		case 0x00C4: // DMA-2 current address, channel 1
		case 0x00C8: // DMA-2 current address, channel 2
		case 0x00CC: // DMA-2 current address, channel 3
			idx_channel = (addr >> (1 + isMaster)) & 0x03;
			core.flipFlop = !core.flipFlop;
			if (core.flipFlop === false) {
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
			idx_channel = (addr >> (1 + isMaster)) & 0x03;
			core.flipFlop = !core.flipFlop;
			if (core.flipFlop === false) {
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
			util.problem("DMA-" + (isMaster + 1) + " readHandler() :: Read of temporary register always returns 0");
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
			debug("DMA readHandler() :: Read of extra page register "
				+ util.format("hex", addr) + " (unused)");
			return device.list_regExtraPage[ addr & 0x0F ].get();
		case 0x0F: // DMA-1 undocumented: read all mask bits
		case 0xDE: // DMA-2 undocumented: read all mask bits
			result8 = (core.list_channel[ 0 ].mask)
					| (core.list_channel[ 1 ].mask << 1)
					| (core.list_channel[ 2 ].mask << 2)
					| (core.list_channel[ 3 ].mask << 3);
			return (0xF0 | result8);
		default:
			util.problem("DMA readHandler() :: Unsupported read, address="
				+ util.format("hex", addr) + "!");
			return 0;
		}
	}
	// DMA chip's I/O write operations' handler routine
	function writeHandler(device, addr, val, io_len) {
		// "device" will be DMA
		var idx_channel, channel, set_mask_bit
			, isMaster, DMA1, DMA2, core;

		if (io_len > 1) {
			if (io_len === 2 && addr === 0x0B) {
				writeHandler(device, addr, val & 0xFF, 1);
				writeHandler(device, addr, val >> 8, 1);
				return;
			}

            debugger;

			util.problem(util.sprintf(
				"DMA writeHandler() :: Write to address: 0x%04X = 0x%04X, len=%u"
				, addr, val, io_len
			));
			return;
		}

		//util.info("DMA writeHandler() :: Write to address: "
		//	+ util.format("hex", addr) + " = " + util.format("hex", val));

		/** NB: This is a 8237 DMA **/

		isMaster = (addr >= 0xC0);
		DMA1 = device.DMA1; DMA2 = device.DMA2;
		core = isMaster ? DMA2 : DMA1;

		switch (addr) {
		case 0x00:
		case 0x02:
		case 0x04:
		case 0x06:
		case 0xc0:
		case 0xc4:
		case 0xc8:
		case 0xcc:
			idx_channel = (addr >> (1 + isMaster)) & 0x03;
			channel = core.list_channel[ idx_channel ];
			debug(util.sprintf(
				"  DMA-%d base and current address, channel %d"
				, isMaster + 1, idx_channel
			));
			if (core.flipFlop == false) { /* 1st byte */
				channel.addrBase = val;
				channel.addrCurrent = val;
			} else { /* 2nd byte */
				channel.addrBase |= (val << 8);
				channel.addrCurrent |= (val << 8);
				debug(util.sprintf(
					"    base = %04x"
					, channel.addrBase
				));
				debug(util.sprintf(
					"    curr = %04x"
					, channel.addrCurrent
				));
			}
			core.flipFlop = !core.flipFlop;
			break;

		case 0x01:
		case 0x03:
		case 0x05:
		case 0x07:
		case 0xc2:
		case 0xc6:
		case 0xca:
		case 0xce:
			idx_channel = (addr >> (1 + isMaster)) & 0x03;
			channel = core.list_channel[ idx_channel ];
			debug(util.sprintf(
				"  DMA-%d base and current count, channel %d"
				, isMaster + 1, idx_channel
			));
			if (core.flipFlop == false) { /* 1st byte */
				channel.countBase = val;
				channel.countCurrent = val;
			} else { /* 2nd byte */
				channel.countBase |= (val << 8);
				channel.countCurrent |= (val << 8);
				debug(util.sprintf(
					"    base = %04x"
					, channel.countBase
				));
				debug(util.sprintf(
					"    curr = %04x"
					, channel.countCurrent
				));
			}
			core.flipFlop = !core.flipFlop;
			break;

		case 0x08: /* DMA-1: command register */
		case 0xd0: /* DMA-2: command register */
			if ((val & 0xfb) != 0x00) {
				util.problem(util.sprintf(
					"write to command register: value 0x%02x not supported"
					, val
				));
			}
			core.regCommand.set(val);
			core.disabled = !!((val >> 2) & 0x01);
			core.controlHRQ();
			break;

		case 0x09: // DMA-1: request register
		case 0xd2: // DMA-2: request register
			channel = val & 0x03;
			// note: write to 0x0d / 0xda clears this register
			if (val & 0x04) {
				// set request bit
				core.regStatus.set(core.regStatus.get() | (1 << (channel+4)));
				debug(util.sprintf(
					"DMA-%d: set request bit for channel %u"
					, isMaster + 1, channel
				));
			} else {
				// clear request bit
				core.regStatus.set(core.regStatus.get() & ~(1 << (channel+4))/*>>>0*/);
				debug(util.sprintf(
					"DMA-%d: cleared request bit for channel %u"
					, isMaster + 1, channel
				));
			}
			core.controlHRQ();
			break;

		case 0x0a:
		case 0xd4:
			set_mask_bit = val & 0x04;
			idx_channel = val & 0x03;
			channel = core.list_channel[ idx_channel ];
			channel.mask = (set_mask_bit > 0) & 1;
			debug(util.sprintf(
				"DMA-%d: set_mask_bit=%u, channel=%u, mask now=%02xh"
				, isMaster + 1, set_mask_bit, idx_channel, channel.mask
			));
			//debugger;
			core.controlHRQ();
			break;

		case 0x0b: /* DMA-1 mode register */
		case 0xd6: /* DMA-2 mode register */
			idx_channel = val & 0x03;
			channel = core.list_channel[ idx_channel ];
			channel.mode.type = (val >> 6) & 0x03;
			channel.mode.decrement_addr = (val >> 5) & 0x01;
			channel.mode.useAutoInit = !!((val >> 4) & 0x01);
			channel.mode.typeTransfer = (val >> 2) & 0x03;
			debug(util.sprintf(
				"DMA-%d: mode register[%u] = %02x"
				, isMaster + 1, idx_channel, val
			));
			break;

		case 0x0c: /* DMA-1 clear byte flip/flop */
		case 0xd8: /* DMA-2 clear byte flip/flop */
			debug(util.sprintf(
				"DMA-%d: clear flip/flop"
				, isMaster + 1
			));
			core.flipFlop = false;
			break;

		case 0x0d: // DMA-1: master clear
		case 0xda: // DMA-2: master clear
			debug(util.sprintf(
				"DMA-%d: master clear"
				, isMaster + 1
			));
			// writing any value to this port resets DMA controller 1 / 2
			// same action as a hardware reset
			// mask register is set (chan 0..3 disabled)
			// command, status, request, temporary, and byte flip-flop are all cleared
			core.reset();
			break;

		case 0x0e: // DMA-1: clear mask register
		case 0xdc: // DMA-2: clear mask register
			debug(util.sprintf(
				"DMA-%d: clear mask register"
				, isMaster + 1
			));
			core.list_channel[ 0 ].mask = 0;
			core.list_channel[ 1 ].mask = 0;
			core.list_channel[ 2 ].mask = 0;
			core.list_channel[ 3 ].mask = 0;
			core.controlHRQ();
			break;

		case 0x0f: // DMA-1: write all mask bits
		case 0xde: // DMA-2: write all mask bits
			debug(util.sprintf(
				"DMA-%d: write all mask bits"
				, isMaster + 1
			));
			core.list_channel[ 0 ].mask = val & 0x01; val >>= 1;
			core.list_channel[ 1 ].mask = val & 0x01; val >>= 1;
			core.list_channel[ 2 ].mask = val & 0x01; val >>= 1;
			core.list_channel[ 3 ] = val & 0x01;
			core.controlHRQ();
			break;

		case 0x81: /* DMA-1 page register, channel 2 */
		case 0x82: /* DMA-1 page register, channel 3 */
		case 0x83: /* DMA-1 page register, channel 1 */
		case 0x87: /* DMA-1 page register, channel 0 */
			/* address bits A16-A23 for DMA channel */
			idx_channel = map_idx_reg_idx_channel[ addr - 0x81 ];
			channel = DMA1.list_channel[ idx_channel ];
			channel.regPage.set(val);
			debug(util.sprintf(
				"DMA-1: page register %d = %02x"
				, idx_channel, val
			));
			break;

		case 0x89: /* DMA-2 page register, channel 2 */
		case 0x8a: /* DMA-2 page register, channel 3 */
		case 0x8b: /* DMA-2 page register, channel 1 */
		case 0x8f: /* DMA-2 page register, channel 0 */
			/* address bits A16-A23 for DMA channel */
			idx_channel = map_idx_reg_idx_channel[ addr - 0x89 ];
			channel = DMA2.list_channel[ idx_channel ];
			channel.regPage.set(val);
			debug(util.sprintf(
				"DMA-2: page register %d = %02x"
				, idx_channel + 4, val
			));
			break;

		case 0x0080:
		case 0x0084:
		case 0x0085:
		case 0x0086:
		case 0x0088:
		case 0x008c:
		case 0x008d:
		case 0x008e:
			debug(util.sprintf(
				"DMA writeHandler() :: Extra page register 0x%04x (unused)"
				, addr
			));
			device.list_regExtraPage[ addr & 0x0f ].set(val);
			break;

		default:
			util.problem("DMA writeHandler() :: Unsupported write, address=" + util.format("hex", addr) + "!");
		}
	}
	/* ====== /Private ====== */

	// Exports
	return DMA;
});
