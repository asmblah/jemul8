/*
 * jemul8 - JavaScript x86 Emulator
 *
 * MODULE: Global (Descriptor) Table Register (GDTR, IDTR) class support
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
