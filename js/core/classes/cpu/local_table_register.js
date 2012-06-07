/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *
 *	MODULE: Local (Descriptor) Table Register (LDTR) class support
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
