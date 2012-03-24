/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: CPU Instruction class support
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("iodev", function ( $ ) {
	var x86Emu = this.data("x86Emu");
	
	// Import system after setup
	var machine, CPU, DRAM;
	this.bind("load", function ( $, machine_, CPU_, DRAM_ ) {
		machine = machine_; CPU = CPU_; DRAM = DRAM_;
	});
	
	// IO device ( eg. CMOS, DMA ) base class constructor
	/* abstract */function IODevice( name, classDevice ) {
		/* ==== Guards ==== */
		$.assert(this != self, "IODevice constructor :: not called as constructor.");
		/* ==== /Guards ==== */
		
		// Mnemonic / name of device
		this.name = name;
	}
	/* static */IODevice.MAX_IRQS = 16;
	// Internally, as in Bochs, we keep track of the names of devices registered against each IRQ:
	//	this isn't strictly necessary, as IRQs are simply handled by the interrupts system
	/* static */IODevice.hsh_irq_nameHandler = [];
	// Set up I/O device subsystem
	/* static */IODevice.init = function () {
		var machine = jemul8.machine;
		var addr_port, irq;
		// 65536 ports (inc. #0 & #FFFF!)
		for ( addr_port = 0 ; addr_port <= 0xFFFF ; ++addr_port ) {
			machine.hsh_portIORead[ addr_port ] = new IOReadPort(
				null, addr_port, "<unclaimed>", null_readHandler, 1 );
			machine.hsh_portIOWrite[ addr_port ] = new IOWritePort(
				null, addr_port, "<unclaimed>", null_writeHandler, 1 );
		}
		// No IRQs assigned to begin with (see note above
		//	for <static>.hsh_irq_nameHandler)
		for ( irq = 0 ; irq < IODevice.MAX_IRQS ; ++irq ) {
			IODevice.hsh_irq_nameHandler[ irq ] = null;
		}
	};
	// Register an IO read handler for the specified port
	IODevice.prototype.registerIO_Read
	= function ( addr, name_portPart, fn, mask ) {
		/* ==== Guards ==== */
		$.assert(!isNaN(addr) && addr === parseInt(addr)
			, "IODevice.registerIO_Read() :: addr must not be numeric.");
		/* ==== /Guards ==== */
		
		var name_port = this.name + "(" + name_portPart + ")";
		var port;
		
		// IO port has not been assigned a device yet
		if ( (port = machine.hsh_portIORead[ addr ]).device === null ) {
			machine.hsh_portIORead[ addr ] = new IOReadPort(
				this, addr, name_port, fn, mask );
		// IO port conflict
		} else {
			$.problem("IODevice.registerIO_Read() :: IO port conflict - "
				+ $.format("hex", addr) + " already assigned as "
				+ port.name_port);
			return false;
		}
		
		$.debug("IODevice.registerIO_Read() :: I/O read port "
			+ $.format("hex", addr) + " assigned as "
			+ name_port + " to " + this.name);
		
		return true;
	};
	// Register an IO write handler for the specified port
	IODevice.prototype.registerIO_Write
	= function ( addr, name_portPart, fn, mask ) {
		/* ==== Guards ==== */
		$.assert(!isNaN(addr) && addr === parseInt(addr)
			, "IODevice.registerIO_Write() :: addr must not be numeric.");
		/* ==== /Guards ==== */
		
		var name_port = this.name + "(" + name_portPart + ")";
		var port;
		
		// IO port has not been assigned a device yet
		if ( (port = machine.hsh_portIOWrite[ addr ]).device === null ) {
			machine.hsh_portIOWrite[ addr ] = new IOWritePort(
				this, addr, name_port, fn, mask );
		// IO port conflict
		} else {
			$.problem("IODevice.registerIO_Write() :: I/O port conflict - "
				+ $.format("hex", addr) + " already assigned as "
				+ port.name_port);
			return false;
		}
		
		$.debug("IODevice.registerIO_Write() :: I/O write port "
			+ $.format("hex", addr) + " assigned as "
			+ name_port + " to " + this.name);
		
		return true;
	};
	// "Register" an IRQ for use (see note above
	//	for <static>.hsh_irq_nameHandler)
	IODevice.prototype.registerIRQ = function ( irq, namePart ) {
		var name = this.name + "(" + namePart + ")";
		var nameExisting;
		// IRQ index out of bounds
		if ( irq < 0 ) {
			return $.panic("IODevice.registerIRQ() :: IO device '"
				+ name + "' registered with IRQ #" + irq + " (must be 0-15)");
		}
		if ( irq > IODevice.MAX_IRQS ) {
			return $.panic("IODevice.registerIRQ() :: IO device '"
				+ name + "' registered with IRQ #" + irq
				+ " above MAX_IRQS=" + (IODevice.MAX_IRQS - 1));
		}
		// IRQ already registered
		if ( (nameExisting = IODevice.hsh_irq_nameHandler[ irq ]) !== null ) {
			return $.panic("IODevice.registerIRQ() :: IRQ #" + irq
				+ " conflict: " + nameExisting + " with " + name);
		}
		// Register new IRQ handler's name
		IODevice.hsh_irq_nameHandler[ irq ] = name;
		
		$.debug("IODevice.registerIRQ() :: IRQ #" + irq
			+ " registered for " + name);
		return true;
	};
	// "Unregister" an IRQ from use (see note above
	//	for <static>.hsh_irq_nameHandler)
	IODevice.prototype.UnregisterIRQ = function ( irq, namePart ) {
		var name = this.name + "(" + namePart + ")";
		var nameExisting;
		// IRQ index out of bounds
		if ( irq < 0 ) {
			return $.panic("IODevice.UnregisterIRQ() :: IO device '"
				+ name + "' tried to unregister IRQ #" + irq
				+ " (must be 0-15)");
		}
		if ( irq > IODevice.MAX_IRQS ) {
			return $.panic("IODevice.UnregisterIRQ() :: IO device '"
				+ name + "' tried to unregister IRQ #" + irq
				+ " above MAX_IRQS=" + (IODevice.MAX_IRQS - 1));
		}
		// IRQ not already registered
		if ( IODevice.hsh_irq_nameHandler[ irq ] === null ) {
			return $.panic("IODevice.UnregisterIRQ() :: IO device '"
				+ name + "' tried to unregister IRQ #" + irq
				+ ", which is not registered");
		}
		// Register new IRQ handler's name
		IODevice.hsh_irq_nameHandler[ irq ] = null;
		delete IODevice.hsh_irq_nameHandler[ irq ];
		
		$.debug("IODevice.UnregisterIRQ() :: IRQ #" + irq
			+ " unregistered from " + name);
		return true;
	};
	
	/* ====== Private ====== */
	function IOReadPort( device, addr, name_port, fn, mask ) {
		this.device = device;
		this.addr = addr;
		this.name_port = name_port;
		this.fn = fn;
		this.mask = mask;
	}
	function IOWritePort( device, addr, name_port, fn, mask ) {
		this.device = device;
		this.addr = addr;
		this.name_port = name_port;
		this.fn = fn;
		this.mask = mask;
	}
	
	function null_readHandler( device, addr, len ) {
		$.problem("I/O read from null handler (I/O port unassigned) - port "
			+ $.format("hex", addr));
		// As for Bochs.
		return 0xFFFFFFFF;
	}
	function null_writeHandler( device, addr, val, len ) {
		$.problem("I/O write to null handler (I/O port unassigned) - port "
			+ $.format("hex", addr) + ", val " + $.format("hex", val));
		/** Do nothing. **/
	}
	/* ====== /Private ====== */
	
	// Exports
	x86Emu.IODevice = IODevice;
});
