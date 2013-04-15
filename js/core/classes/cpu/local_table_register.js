/*
 * jemul8 - JavaScript x86 Emulator
 *
 * MODULE: Local (Descriptor) Table Register (LDTR) class support
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
	"../../util",
    "./segreg"
], function (
    util,
    SegRegister
) {
    "use strict";

	// Local Table Register class constructor
	function LocalTableRegister(name) {
		util.assert(this && (this instanceof LocalTableRegister)
			, "LocalTableRegister constructor :: error - not called properly"
		);

		SegRegister.call(this, name, 6);
	}
    util.inherit(LocalTableRegister, SegRegister); // Inheritance
	util.extend(LocalTableRegister.prototype, {
		// Sets the register back to its startup state
		reset: function (raw) {
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
