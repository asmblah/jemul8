/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: IBM-PC compatible machine support
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("pc", function ( $ ) { "use strict";
	var x86Emu = this.data("x86Emu")
	
	// Constants
		, MASK_ENABLE_A20 = 0xFFFFFFFF
		, MASK_DISABLE_A20 = 0xFFeFFFFF;
	
	// IBM-compatible PC class constructor
	function PC( emu ) {
		this.emu = emu;
		
		this.list_tmr = [];
		
		// (H)old (R)e(Q)uest
		this.HRQ = new x86Emu.Pin( "HRQ" );
		
		this.enableA20 = false;
		this.maskA20 = MASK_DISABLE_A20;
	}
	PC.prototype.install = function ( component ) {
		switch ( component.constructor ) {
		default:
			$.problem("PC.install :: Provided component"
				+ " cannot be installed inside the PC.");
		}
	};
	// (Timer concept from Bochs)
	PC.prototype.MAX_TIMERS = 64; // Same as Bochs
	PC.prototype.registerTimer = function ( fn, obj_this, intervalUsecs
											, isContinuous, isActive, name ) {
		if ( this.list_tmr.length > this.MAX_TIMERS ) {
			return $.problem("PC.registerTimer() ::"
				+ " MAX_TIMERS already registered");
		}
		var tmr = new Timer( this, fn, obj_this, intervalUsecs, isContinuous
			, isActive, name, this.list_tmr.length );
		this.list_tmr.push(tmr);
		return tmr;
	};
	PC.prototype.getEnableA20 = function () {
		return this.enableA20;
	};
	PC.prototype.setEnableA20 = function ( enable ) {
		if ( enable ) {
			this.maskA20 = MASK_ENABLE_A20;
		} else {
			// Mask off the a20 address line
			this.maskA20 = MASK_DISABLE_A20;
		}
		$.debug("PC.setEnableA20() :: A20 address line "
			+ (enable ? "en" : "dis") + "abled");
		
		/*
		 * [Bochs] If there has been a transition, we need to notify the CPUs
		 *	so they can potentially invalidate certain cache info based on
		 *	A20-line-applied physical addresses.
		 */
		if ( this.enableA20 !== enable ) MemoryMappingChanged();
		
		this.enableA20 = enable;
	};
	if ( Date.now ) {
		PC.prototype.getTimeMsecs = function () {
			return Date.now();
		};
	} else {
		PC.prototype.getTimeMsecs = function () {
			return new Date().getTime();
		};
	}
	PC.prototype.getTimeUsecs = function () {
		// We can only go down to milliseconds in JavaScript,
		//	rather than the microsecond granularity used in eg. Bochs.
		return this.getTimeMsecs() * 1000;
	};
	
	/*
	 *	Memory map inside the 1st megabyte:
	 *	
	 *	0x00000 - 0x7ffff    DOS area (512K)
	 *	0x80000 - 0x9ffff    Optional fixed memory hole (128K)
	 *	0xa0000 - 0xbffff    Standard PCI/ISA Video Mem / SMMRAM (128K)
	 *	0xc0000 - 0xdffff    Expansion Card BIOS and Buffer Area (128K)
	 *	0xe0000 - 0xeffff    Lower BIOS Area (64K)
	 *	0xf0000 - 0xfffff    Upper BIOS Area (64K)
	 */
	// Writes data to physical memory (DRAM)
	// Based on [BX_MEM_C::writePhysicalPage] in Bochs' /memory/memory.cc
	/*PC.prototype.writePhysical = function ( addr, len, data ) {
		//Bit8u *data_ptr;
		var a20addr = (addr & this.maskA20);
		struct memory_handler_struct *memory_handler = NULL;
		
		// Accesses should always be contained within a single page
		if ( (addr>>12) != ((addr+len-1)>>12) ) {
		BX_PANIC(("writePhysicalPage: cross page access at address 0x" FMT_PHY_ADDRX ", len=%d", addr, len));
		}
		
		bx_bool is_bios = (a20addr >= (bx_phy_address)~BIOS_MASK);
		
		if (cpu != NULL) {
			if ( (a20addr >= 0x000a0000 && a20addr < 0x000c0000) && BX_MEM_THIS smram_available )
			{
			// SMRAM memory space
			if (BX_MEM_THIS smram_enable || (cpu->smm_mode() && !BX_MEM_THIS smram_restricted))
			goto mem_write;
			}
		}

		memory_handler = BX_MEM_THIS memory_handlers[a20addr >> 20];
		while (memory_handler) {
		if (memory_handler->begin <= a20addr &&
		memory_handler->end >= a20addr &&
		memory_handler->write_handler(a20addr, len, data, memory_handler->param))
		{
		return;
		}
		memory_handler = memory_handler->next;
		}

		mem_write:

		// all memory access fits in single 4K page
		if (a20addr < BX_MEM_THIS len && ! is_bios) {
		pageWriteStampTable.decWriteStamp(a20addr);
		// all of data is within limits of physical memory
		if (a20addr < 0x000a0000 || a20addr >= 0x00100000)
		{
		if (len == 8) {
		WriteHostQWordToLittleEndian(BX_MEM_THIS get_vector(a20addr), *(Bit64u*)data);
		return;
		}
		if (len == 4) {
		WriteHostDWordToLittleEndian(BX_MEM_THIS get_vector(a20addr), *(Bit32u*)data);
		return;
		}
		if (len == 2) {
		WriteHostWordToLittleEndian(BX_MEM_THIS get_vector(a20addr), *(Bit16u*)data);
		return;
		}
		if (len == 1) {
		* (BX_MEM_THIS get_vector(a20addr)) = * (Bit8u *) data;
		return;
		}
		// len == other, just fall thru to special cases handling
		}

		#ifdef BX_LITTLE_ENDIAN
		data_ptr = (Bit8u *) data;
		#else // BX_BIG_ENDIAN
		data_ptr = (Bit8u *) data + (len - 1);
		#endif

		if (a20addr < 0x000a0000 || a20addr >= 0x00100000)
		{
		// addr *not* in range 000A0000 .. 000FFFFF
		while(1) {
		*(BX_MEM_THIS get_vector(a20addr)) = *data_ptr;
		if (len == 1) return;
		len--;
		a20addr++;
		#ifdef BX_LITTLE_ENDIAN
		data_ptr++;
		#else // BX_BIG_ENDIAN
		data_ptr--;
		#endif
		}
		}

		// addr must be in range 000A0000 .. 000FFFFF

		for(unsigned i=0; i<len; i++) {

		// SMMRAM
		if (a20addr < 0x000c0000) {
		// devices are not allowed to access SMMRAM under VGA memory
		if (cpu) {
		*(BX_MEM_THIS get_vector(a20addr)) = *data_ptr;
		}
		goto inc_one;
		}

		// adapter ROM     C0000 .. DFFFF
		// ROM BIOS memory E0000 .. FFFFF
		#if BX_SUPPORT_PCI == 0
		// ignore write to ROM
		#else
		// Write Based on 440fx Programming
		if (BX_MEM_THIS pci_enabled && ((a20addr & 0xfffc0000) == 0x000c0000))
		{
		switch (DEV_pci_wr_memtype(a20addr)) {
		case 0x1:   // Writes to ShadowRAM
		BX_DEBUG(("Writing to ShadowRAM: address 0x" FMT_PHY_ADDRX ", data %02x", a20addr, *data_ptr));
		*(BX_MEM_THIS get_vector(a20addr)) = *data_ptr;
		break;

		case 0x0:   // Writes to ROM, Inhibit
		BX_DEBUG(("Write to ROM ignored: address 0x" FMT_PHY_ADDRX ", data %02x", a20addr, *data_ptr));
		break;

		default:
		BX_PANIC(("writePhysicalPage: default case"));
		}
		}
		#endif

		inc_one:
		a20addr++;
		#ifdef BX_LITTLE_ENDIAN
		data_ptr++;
		#else // BX_BIG_ENDIAN
		data_ptr--;
		#endif

		}
		}
		else {
		// access outside limits of physical memory, ignore
		BX_DEBUG(("Write outside the limits of physical memory (0x"FMT_PHY_ADDRX") (ignore)", a20addr));
		}
		}*/
	
	
	// Internal timers
	//	( could use setTimeout/setInterval,
	//	but these would run unchecked between yields:
	//	this should offer more control )
	function Timer( machine, fn, obj_this, intervalUsecs, isContinuous
				, isActive, name, idx ) {
		this.machine = machine;
		
		this.fn = fn;
		this.obj_this = obj_this; // Scope "this" object for callback function
		this.ticksNextFire;
		this.intervalUsecs = 0;
		this.isActive = isActive;
		this.name = name;
		this.idx = idx;
		this.activate(intervalUsecs, isContinuous);
	}
	Timer.prototype.unregister = function () {
		this.machine.list_tmr[ this.idx ] = null;
	};
	Timer.prototype.activate = function ( intervalUsecs, isContinuous ) {
		// Useconds is not 0, so set & use new period/interval
		if ( intervalUsecs !== 0 ) {
			this.intervalUsecs = intervalUsecs;
		}
		// Calculate & store the next expiry time for this timer
		this.ticksNextFire = new Date().getTime() + this.intervalUsecs / 1000;
		this.isContinuous = isContinuous; // Update flag
	};
	Timer.prototype.deactivate = function () {
		this.ticksNextFire = 0;
		this.isActive = false;
	};
	
	// Exports
	x86Emu.PC = PC;
});
