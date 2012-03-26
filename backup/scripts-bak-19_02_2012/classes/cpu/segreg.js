/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *	
 *	MODULE: Segment Register class support
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("segreg", function ( $ ) { "use strict";
	var jemul8 = this.data("jemul8");
	
	// Segment Register (eg. CS, DS, ES, FS, GS) class constructor
	function SegRegister( name, len ) {
		/* ==== Guards ==== */
		jemul8.assert(this && (this instanceof SegRegister), "SegRegister ctor ::"
			+ " error - constructor not called properly");
		/* ==== /Guards ==== */
		
		this.name = name;
		this.len = len;
		this.bitmaskSize = jemul8.generateMask(len);
		
		// Physical address of segment (with A20 applied)
		this.addrA20 = 0;
		this.addrMin = 0;
		this.addrMax = 0;
		this.buf = null;			// Memory buffer (if used)
		this.addrStart_buf = 0;		// (see above)
		
		this.handler = null;		// Memory handler functions (if used)
		
		//this.selector = new Selector( this );
	}
	$.inherit(SegRegister, jemul8.Register); // Inheritance
	
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
	jemul8.SegRegister = SegRegister;
});
