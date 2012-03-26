/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *	
 *	MODULE: Local (Descriptor) Table Register (LDTR) class support
 */

define([
	"../../util"
    , "./segreg"
], function (
    util
    , SegRegister
) { "use strict";
	
	// Local Table Register class constructor
	function LocalTableRegister( name ) {
		util.assert(this && (this instanceof LocalTableRegister)
			, "LocalTableRegister constructor :: error - not called properly"
		);
		
		SegRegister.call(this, name, 6);
	}
    util.inherit(LocalTableRegister, SegRegister); // Inheritance
	util.extend(LocalTableRegister.prototype, {
		// Sets the register back to its startup state
		reset: function ( raw ) {
            var selector = this.selector;
            var cache = this.cache;
            
            selector.parse(0x0000);
            
            cache.accessType = util.ACCESS_VALID_CACHE;
            cache.present = true;
            cache.dpl = 0;     // (Field not used)
            cache.segment = 0; // System segment
            cache.type = util.DESC_SYS_SEGMENT_LDT;
			
			cache.base = 0;
			// No scaling applied (x1) as byte-granular
			cache.limitScaled = 0xFFFF;
			cache.available = 0;
			cache.use4KPages = false; // Byte-granular
		}
	});
	
	// Exports
	return LocalTableRegister;
});
