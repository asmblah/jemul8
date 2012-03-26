/*
 *	jsEmu - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: CPU Instruction class support
 */
var mod = new jsEmu.PrimaryModule( function ( jsEmu ) {
	/* ============ Import system after setup ============ */
	var machine, motherboard, CPU, FlashBIOSChip, BIOS, DRAM;
	this.RegisterDeferredLoader( function ( machine_, motherboard_, CPU_, FlashBIOSChip_, BIOS_, DRAM_ ) {
		machine = machine_; motherboard = motherboard_; CPU = CPU_; FlashBIOSChip = FlashBIOSChip_; BIOS = BIOS_; DRAM = DRAM_;
	});
	/* ============ /Import system after setup ============ */
	
	// IO device ( eg. CMOS, DMA ) base class constructor
	/* abstract */function IODevice( name, classDevice ) {
		/* ==== Guards ==== */
		jsEmu.Assert(this != self, "IODevice constructor :: not called as constructor.");
		/* ==== /Guards ==== */
		
		// Mnemonic / name of device
		this.name = name;
		
		// Add to (static) classes
		IODevice.classes[ name ] = classDevice;
	}
	// All IODevice classes (eg. PIC, CMOS)
	/* static */IODevice.classes = {};
	// Register an IO read handler for the specified port
	IODevice.prototype.RegisterIO_Read = function ( addr, name_port, fn, mask ) {
		/* ==== Guards ==== */
		jsEmu.Assert(!isNaN(addr) && addr === parseInt(addr), "IODevice.RegisterIO_Read :: addr must not be numeric.");
		/* ==== /Guards ==== */
		
		var port;
		
		// IO port has not been assigned a device yet
		if ( (port = motherboard.hsh_portIORead[ addr ]).device === null ) {
			motherboard.hsh_portIORead[ addr ] = new IOReadPort( this, addr, name_port, fn, mask );
		// IO port conflict
		} else {
			jsEmu.Error("IODevice.RegisterIO_Read :: IO port conflict - port(" + addr + ") already assigned as " + port.name_port);
			return false;
		}
		
		return true;
	};
	// Register an IO write handler for the specified port
	IODevice.prototype.RegisterIO_Write = function ( addr, name_port, fn, mask ) {
		/* ==== Guards ==== */
		jsEmu.Assert(!isNaN(addr) && addr === parseInt(addr), "IODevice.RegisterIO_Write :: addr must not be numeric.");
		/* ==== /Guards ==== */
		
		var port;
		
		// IO port has not been assigned a device yet
		if ( (port = motherboard.hsh_portIOWrite[ addr ]).device === null ) {
			motherboard.hsh_portIOWrite[ addr ] = new IOWritePort( this, addr, name_port, fn, mask );
		// IO port conflict
		} else {
			jsEmu.Error("IODevice.RegisterIO_Write :: IO port conflict - port(" + addr + ") already assigned as " + port.name_port);
			return false;
		}
		
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
	
	function NullReadHandler( device, addr, len ) {
		// As for Bochs.
		return 0xFFFFFFFF;
	}
	function NullWriteHandler( device, addr, val, len ) {
		/** Do nothing. **/
	}
	
	// 65536 ports (inc. #0 & #FFFF!)
	var addr_port;
	for ( addr_port = 0 ; addr_port <= 0xFFFF ; ++addr_port ) {
		motherboard.hsh_portIORead[ addr_port ] = new IOReadPort( null, addr_port, "<unclaimed>", NullReadHandler, 1 );
		motherboard.hsh_portIOWrite[ addr_port ] = new IOWritePort( null, addr_port, "<unclaimed>", NullWriteHandler, 1 );
	}
	/* ====== /Private ====== */
	
	/* ==== Exports ==== */
	jsEmu.IODevice = IODevice;
	/* ==== /Exports ==== */
});

// Add Module to emulator
jsEmu.AddModule(mod);