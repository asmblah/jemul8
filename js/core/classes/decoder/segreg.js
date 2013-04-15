/*
 * jemul8 - JavaScript x86 Emulator
 *
 * MODULE: Segment Register class
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
	, "./register"
], function (
	util,
	Register
) {
    "use strict";

	function SegRegister(name) {
		util.assert(this && (this instanceof SegRegister)
			, "SegRegister ctor :: error - constructor not called properly"
		);

		// Segment Registers are 16 bits wide
		Register.call(this, name, 2);
	}
	util.inherit(SegRegister, Register);

	return SegRegister;
});
