/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *	
 *	MODULE: Segment Register class support
 */

define([
	"../../util"
	, "../register"
], function ( util, Register ) { "use strict";
	
	// Segment Register (eg. CS, DS, ES, FS, GS) class constructor
	function SegRegister( name, size ) {
		util.assert(this && (this instanceof SegRegister)
			, "SegRegister constructor :: error - not called properly"
		);
		
		Register.call(this, name, size);
		
		this.mask = util.generateMask(size);
		
		// Physical address of segment (with A20 applied)
		this.addrA20 = 0;
		this.addrMin = 0;
		this.addrMax = 0;
		this.buf = null;			// Memory buffer (if used)
		this.addrStart_buf = 0;		// (see above)
		
		this.handler = null;		// Memory handler functions (if used)
		
		// Hidden "cache" for segment descriptors, populated
		//  when segment register's value is updated
		this.cache = {
			/* ==== Segment Descriptor fields ==== */
			// Operand & Address-size defaults:
			// - true = 32-bit operand-size & address-size by default
			// - false = 16-bit operand-size & address-size by default
			// (where "by default" means when not overridden by prefix byte)
			default32BitSize: false
			/* ==== /Segment Descriptor fields ==== */
			
			/* ==== Gate fields ==== */
			// 5 bits (0 ... 31) - no. of words/dwords to copy
			//  from caller's stack to called procedure's stack
			, paramCount: 0
			, destSelector: 0
			, destOffset: 0
			/* ==== /Gate fields ==== */
			
			/* ==== Task Gate fields ==== */
			// TSS segment selector
			, tssSelector: 0
			/* ==== /Task Gate fields ==== */
		};
	}
	util.inherit(SegRegister, Register); // Inheritance
	
	// Segment Register selector
	function Selector( reg ) {
		this.reg = reg;
		this.value = 0;
		this.index = 0;
		this.TI = 0;	// Table Indicator bit
		this.RPL = 0;	// Requested Privilege Level
	}
	// Load the Selector object with data from an x86 selector
	Selector.parse_x86 = function ( raw_selector ) {
		this.value = raw_selector;
		this.index = raw_selector >> 3;
		this.TI = (raw_selector >> 2) & 0x01;	// Bit 2
		this.RPL = raw_selector & 0x03;			// Bits 0 & 1
	};
	
	// Exports
	return SegRegister;
});
