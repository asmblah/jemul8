/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: ROM / Device BIOS images support
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("memory/rom", function ( $ ) { "use strict";
	var jemul8 = this.data("jemul8")
		, Memory = jemul8.Memory;
	
	// 512K CMOS BIOS ROM @0xfff80000
	//   2M CMOS BIOS ROM @0xffe00000, must be a power of 2
	var BIOSROMSZ = (1 << 21)
		// ROMs @ 0xc0000-0xdffff (area 0xe0000 -> 0xfffff = BIOS-mapped)
		, EXROMSIZE = 0x20000
		, BIOS_MASK = (BIOSROMSZ - 1)
		, EXROM_MASK = (EXROMSIZE - 1);
	
	// Load a ROM into mapped memory for booting
	// Based on [BX_MEM_C::load_ROM]
	Memory.prototype.loadROM = function ( bufROM, addr, type ) {
		var len = jemul8.getBufferLength(bufROM)
			, offset, idx, idxStart, idxEnd;
		
		// Check size is valid
		if ( (type === 0 && len > BIOSROMSZ)	// System (CMOS) BIOS
				|| (type > 0 && len > 0x20000)	// VGABIOS
				) {
			jemul8.panic("Memory.loadROM() :: Error - ROM size "
				+ $.format("hex", len) + " is too large");
			return false;
		}
		
		// System (CMOS) ROM
		if ( type === 0 ) {
			// Address given may be positive to specify an absolute physical
			//	address to load the ROM at, ...
			if ( addr > 0 ) {
				if ( (addr + len) !== 0x100000 && (addr + len) ) {
					jemul8.panic("Memory.loadROM() :: Error - CMOS ROM"
						+ " must end at 0xFFFFF");
				}
			// ... or negative to specify the size of the ROM image to load
			} else {
				addr = -len;
			}
			
			offset = addr & BIOS_MASK;
			// ???
			if ( (addr & 0xf0000) < 0xf0000 ) {
				this.hsh_isROMPresent[ 64 ] = 1;
			}
		// VGABIOS or expansion ROM
		} else {
			if ( (len % 512) !== 0 ) {
				jemul8.panic("Memory.loadROM() :: Error - ROM image size"
					+ " must be a multiple of 512 (size = " + len + ")");
				return;
			}
			if ( (addr % 2048) !== 0 ) {
				jemul8.panic("Memory.loadROM() :: Error - ROM image"
					+ " must start at a 2K boundary");
				return;
			}
			if ( (addr < 0xc0000)
					|| (((addr + len - 1) > 0xdffff) && (addr < 0xe0000))
					) {
				jemul8.panic("Memory.loadROM() :: Error - ROM address space"
					+ " out of range");
				return;
			}
			
			// TODO: Check for overlapping ROM address spaces
			offset = addr;
		}
		// ROM memory buffer begins at 0xC0000 in physical memory
		offset -= 0xC0000;
		
		// Perform the actual copy of ROM image into ROM memory buffer
		jemul8.copyBuffer(bufROM, 0, this.bufROMs, offset, len);
		
		// Checksum non-CMOS ROMs (& CMOS ROM image
		//	if it includes the 0xAA55 header)
		if ( ((addr & 0xfffff) !== 0xe0000)
				|| (this.bufROMs.getUint16(offset, true) === 0xAA55) ) {
			if ( this.checksumROM(offset, len) !== 0 ) {
				if ( type === 0 ) {
					jemul8.problem("Memory.loadROM() :: Checksum error"
						+ " in System (CMOS) BIOS image");
				} else if ( type === 1 ) {
					jemul8.panic("Memory.loadROM() :: Checksum error"
						+ " in VGABIOS image");
				}
			}
		}
		jemul8.info("Memory.loadROM() :: Loaded ROM @ "
			+ $.format("hex", addr) + "/" + len);
	};
	// Calculates the checksum for the loaded ROM image
	//	at the given offset & length
	Memory.prototype.checksumROM = function ( offset, len ) {
		var checksum = 0, buf = this.bufROMs, idx;
		for ( idx = 0 ; idx < len ; ++idx ) {
			checksum = (checksum + buf.getUint8(offset + idx)) & 0xFF;
		}
		return checksum;
	};
});
