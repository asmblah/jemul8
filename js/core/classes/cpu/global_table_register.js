/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *
 *	MODULE: Global (Descriptor) Table Register (GDTR, IDTR) class support
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
	"../../util"
], function (
	util
) {
    "use strict";

	// Global Table Register class constructor
	function GlobalTableRegister(name) {
		util.assert(this && (this instanceof GlobalTableRegister)
			, "GlobalTableRegister constructor :: error - not called properly"
		);

        this.name = name;
		this.base = 0;
        this.limit = 0;
	}
	util.extend(GlobalTableRegister.prototype, {
		// Sets the register back to its startup state
		reset: function (raw) {
			this.base = 0x00000000;
            this.limit =    0xFFFF;
		}, get: function () {
			util.panic("GlobalTableRegister.get() :: Not yet implemented");
		}
	});

	// Exports
	return GlobalTableRegister;
});
