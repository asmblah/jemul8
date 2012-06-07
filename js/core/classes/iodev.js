/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *
 *	MODULE: System I/O devices' class support
 *
 *  ====
 *
 *  This file is part of jemul8.
 *
 *  jemul8 is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  jemul8 is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with jemul8.  If not, see <http://www.gnu.org/licenses/>.
 */

/*jslint bitwise: true, plusplus: true */
/*global define, require */

define([
	"../util"
], function (util) {
    "use strict";

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
