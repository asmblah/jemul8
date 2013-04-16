/*
 * jemul8 - JavaScript x86 Emulator
 *
 * MODULE: CPU -> Northbridge -> Device I/O support
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
	"../util"
	, "./iodev"
], function (util, IODevice) {
    "use strict";

	// TODO: Should be a config setting
	var enableDebug = false;

	var debug = enableDebug ? function (msg) {
		util.debug(msg);
	} : function () {};

	// IRQs (hardware (I)nterrupt (R)e(Q)uests)
	var MAX_IRQS = 16;

	// I/O subsystem class constructor
	function IO(machine) {
		util.assert(this && (this instanceof IO)
			, "IO constructor :: error - not called properly"
		);

		this.machine = machine;

		// I/O ports
		this.hsh_portIORead = {};
		this.hsh_portIOWrite = {};

		// Internally, as in Bochs, we keep track of the names of devices
		//	registered against each IRQ: this isn't strictly necessary,
		//	as IRQs are simply handled by the interrupts system
		this.hsh_irq_nameHandler = [];
	}
	// Set up I/O device subsystem
	IO.prototype.init = function (done, fail) {
		var addr_port, irq;
		// 65536 ports (inc. #0 & #FFFF!)
		for (addr_port = 0 ; addr_port <= 0xFFFF ; ++addr_port) {
			this.hsh_portIORead[ addr_port ] = new IOReadPort(
				null, addr_port, "<unclaimed>", null_readHandler, 0x07 );
			this.hsh_portIOWrite[ addr_port ] = new IOWritePort(
				null, addr_port, "<unclaimed>", null_writeHandler, 0x07 );
		}
		// No IRQs assigned to begin with (see note above
		//	for this.hsh_irq_nameHandler)
		for (irq = 0 ; irq < MAX_IRQS ; ++irq) {
			this.hsh_irq_nameHandler[ irq ] = null;
		}

		done();
	};
	// Register an IO read handler for the specified port
	IO.prototype.registerIO_Read
	= function (device, addr, name_portPart, fn, mask) {
		/* ==== Guards ==== */
		util.assert(device && (device instanceof IODevice)
			, "IO.registerIO_Read() :: 'device' must be a valid IODevice");
		util.assert(!isNaN(addr) && addr === parseInt(addr)
			, "IO.registerIO_Read() :: 'addr' must be an integer");
		/* ==== /Guards ==== */

		var machine = this.machine
			, name_port = device.name + "(" + name_portPart + ")"
			, port;

		// IO port has not been assigned a device yet
		if ((port = this.hsh_portIORead[ addr ]).device === null) {
			this.hsh_portIORead[ addr ] = new IOReadPort(
				device, addr, name_port, fn, mask );
		// IO port conflict
		} else {
			util.problem("IO.registerIO_Read() :: IO port conflict - "
				+ util.format("hex", addr) + " already assigned as "
				+ port.name_port);
			return false;
		}

		debug("IO.registerIO_Read() :: I/O read port "
			+ util.format("hex", addr) + " assigned as "
			+ name_port + " to " + device.name);

		return true;
	};
	// Register an IO write handler for the specified port
	IO.prototype.registerIO_Write
	= function (device, addr, name_portPart, fn, mask) {
		/* ==== Guards ==== */
		util.assert(device && (device instanceof IODevice)
			, "IO.registerIO_Read() :: 'device' must be a valid IODevice");
		util.assert(!isNaN(addr) && addr === parseInt(addr)
			, "IO.registerIO_Write() :: 'addr' must be an integer");
		/* ==== /Guards ==== */

		var machine = this.machine
			, name_port = device.name + "(" + name_portPart + ")"
			, port;

		// IO port has not been assigned a device yet
		if ((port = this.hsh_portIOWrite[ addr ]).device === null) {
			this.hsh_portIOWrite[ addr ] = new IOWritePort(
				device, addr, name_port, fn, mask );
		// IO port conflict
		} else {
			util.problem("IO.registerIO_Write() :: I/O port conflict - "
				+ util.format("hex", addr) + " already assigned as "
				+ port.name_port);
			return false;
		}

		debug("IODevice.registerIO_Write() :: I/O write port "
			+ util.format("hex", addr) + " assigned as "
			+ name_port + " to " + device.name);

		return true;
	};
	// "Register" an IRQ for use (see note above
	//	for this.hsh_irq_nameHandler)
	IO.prototype.registerIRQ = function (device, irq, namePart) {
		/* ==== Guards ==== */
		util.assert(device && (device instanceof IODevice)
			, "IO.registerIRQ() :: 'device' must be a valid IODevice");
		util.assert(!isNaN(irq) && irq === parseInt(irq)
			, "IO.registerIO_Write() :: 'irq' must be an integer");
		/* ==== /Guards ==== */

		var name = device.name + "(" + namePart + ")";
		var nameExisting;
		// IRQ index out of bounds
		if (irq < 0) {
			return util.panic("IO.registerIRQ() :: IO device '"
				+ name + "' registered with IRQ #" + irq + " (must be 0-15)");
		}
		if (irq > MAX_IRQS) {
			return util.panic("IO.registerIRQ() :: IO device '"
				+ name + "' registered with IRQ #" + irq
				+ " above MAX_IRQS=" + (MAX_IRQS - 1));
		}
		// IRQ already registered
		if ((nameExisting = this.hsh_irq_nameHandler[ irq ]) !== null) {
			return util.panic("IO.registerIRQ() :: IRQ #" + irq
				+ " conflict: " + nameExisting + " with " + name);
		}
		// Register new IRQ handler's name
		this.hsh_irq_nameHandler[ irq ] = name;

		debug("IO.registerIRQ() :: IRQ #" + irq
			+ " registered for " + name);
		return true;
	};
	// "Unregister" an IRQ from use (see note above
	//	for this.hsh_irq_nameHandler)
	IO.prototype.unregisterIRQ = function (device, irq, namePart) {
		/* ==== Guards ==== */
		util.assert(device && (device instanceof IODevice)
			, "IO.unregisterIRQ() :: 'device' must be a valid IODevice");
		util.assert(!isNaN(irq) && irq === parseInt(irq)
			, "IO.registerIO_Write() :: 'irq' must be an integer");
		/* ==== /Guards ==== */

		var name = device.name + "(" + namePart + ")";
		var nameExisting;
		// IRQ index out of bounds
		if (irq < 0) {
			return util.panic("IO.unregisterIRQ() :: IO device '"
				+ name + "' tried to unregister IRQ #" + irq
				+ " (must be 0-15)");
		}
		if (irq > MAX_IRQS) {
			return util.panic("IO.unregisterIRQ() :: IO device '"
				+ name + "' tried to unregister IRQ #" + irq
				+ " above MAX_IRQS=" + (MAX_IRQS - 1));
		}
		// IRQ not already registered
		if (this.hsh_irq_nameHandler[ irq ] === null) {
			return util.panic("IO.unregisterIRQ() :: IO device '"
				+ name + "' tried to unregister IRQ #" + irq
				+ ", which is not registered");
		}
		// Register new IRQ handler's name
		this.hsh_irq_nameHandler[ irq ] = null;
		delete this.hsh_irq_nameHandler[ irq ];

		debug("IO.unregisterIRQ() :: IRQ #" + irq
			+ " unregistered from " + name);
		return true;
	};
	// Read a byte of data from the IO memory address space
	// Based on [bx_devices_c::inp] in Bochs' /iodev/devices.cc
	IO.prototype.read = function (addr_port, io_len) {
		// All ports are initialised with null handlers,
		//	so there will always be a valid port object available
		var port = this.hsh_portIORead[ addr_port ];
		var result;

		if (port.mask & io_len) {
			result = port.fn(port.device, addr_port, io_len);
		} else {
			if (io_len === 1) { result = 0xFF;
			} else if (io_len === 2) { result = 0xFFFF;
			} else { result = 0xFFFFFFFF; }

			// Don't flood the logs when probing PCI (from Bochs)
			if (addr_port !== 0x0CFC) {
				debugger;
				util.problem("Execute (IN) :: Read from port "
					+ util.format("hex", addr_port)
					+ " with length " + io_len + " ignored");
			}
		}
		return result;
	};
	// Write a byte of data to the IO memory address space
	// Based on [bx_devices_c::outp] in Bochs' /iodev/devices.cc
	IO.prototype.write = function (addr_port, val, io_len) {
		// All ports are initialised with null handlers,
		//	so there will always be a valid port object available
		var port = this.hsh_portIOWrite[ addr_port ];

		if (port.mask & io_len) {
			//if (addr_port === 0x402) { /*debugger; */return; }

			port.fn(port.device, addr_port, val, io_len);
		// Don't flood the logs when probing PCI (from Bochs)
		} else if (addr_port !== 0x0CF8) {
			debugger;
			util.problem("Execute (OUT) :: Write to port "
				+ util.format("hex", addr_port) + " with length "
				+ io_len + " ignored");
		}
	};

	function IOReadPort(device, addr, name_port, fn, mask) {
		this.device = device;
		this.addr = addr;
		this.name_port = name_port;
		this.fn = fn;
		this.mask = mask;
	}
	function IOWritePort(device, addr, name_port, fn, mask) {
		this.device = device;
		this.addr = addr;
		this.name_port = name_port;
		this.fn = fn;
		this.mask = mask;
	}

	function null_readHandler(device, addr, lenIO) {
		// Don't flood the logs when probing PCI (from Bochs)
		if (addr !== 0x0CFC) {
			util.problem(
				"I/O read from null handler (I/O port unassigned) - port "
				+ util.format("hex", addr)
			);
		}
		// As for Bochs.
		//return 0xFFFFFFFF;
		if (lenIO === 1) { return 0xFF;
		} else if (lenIO === 2) { return 0xFFFF;
		} else { return 0xFFFFFFFF; }
	}
	function null_writeHandler(device, addr, val, lenIO) {
		// Don't flood the logs when probing PCI (from Bochs)
		if (addr !== 0x0CF8) {
			//util.problem(
			//	"I/O write to null handler (I/O port unassigned) - port "
			//	+ util.format("hex", addr) + ", val " + util.format("hex", val)
			//);
		}
		//debugger;

		/** Do nothing. **/
	}

	// Exports
	return IO;
});
