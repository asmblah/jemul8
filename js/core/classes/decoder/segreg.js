/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *
 *	MODULE: Segment Register class
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
