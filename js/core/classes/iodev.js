/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *	
 *	MODULE: System I/O devices' class support
 */

define([
	"../util"
], function (util) { "use strict";
	
	// IO device (eg. CMOS, DMA) superclass constructor
	/* abstract */function IODevice(name) {
		util.assert(this && (this instanceof IODevice), "IODevice ctor ::"
			+ " error - constructor not called properly");
		
		// Should be set by subclass
		this.machine = null;
		// Mnemonic / name of device
		this.name = name;
	}
	IODevice.prototype.getName = function () {
		return this.name;
	};
	// Register an IO read handler for the specified port
	IODevice.prototype.registerIO_Read
	= function (addr, name_portPart, fn, mask) {
		return this.machine.io.registerIO_Read(
			this, addr, name_portPart, fn, mask 
		);
	};
	// Register an IO write handler for the specified port
	IODevice.prototype.registerIO_Write
	= function (addr, name_portPart, fn, mask) {
		return this.machine.io.registerIO_Write(
			this, addr, name_portPart, fn, mask
		);
	};
	// Register memory read & write handlers
	IODevice.prototype.registerMemoryHandlers
	= function (addrBegin, addrEnd, fnRead, fnWrite) {
		return this.machine.mem.registerMemoryHandlers(
			addrBegin, addrEnd, fnRead, fnWrite, this
		);
	};
	// "Register" an IRQ for use
	IODevice.prototype.registerIRQ = function (irq, namePart) {
		return this.machine.io.registerIRQ(
			this, irq, namePart
		);
	};
	// "Unregister" an IRQ from use
	IODevice.prototype.unregisterIRQ = function (irq, namePart) {
		return this.machine.io.unregisterIRQ(
			this, irq, namePart
		);
	};
	
	// Exports
	return IODevice;
});
