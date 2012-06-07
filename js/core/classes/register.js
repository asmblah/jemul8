/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *
 *	MODULE: Register class support
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
	"../util",
	"./decoder/register"
], function (
	util,
	DecoderRegister
) {
    "use strict";

	// Register (eg. CPU registers EAX, EBX) class constructor
	//	(NB: also used by I/O devices eg. CMOS)
	function Register(name, size) {
		util.assert(this && (this instanceof Register), "Register ctor ::"
			+ " error - constructor not called properly");

		DecoderRegister.call(this, name, size);

		if (!size) { size = 0; }

		this.value = 0;
		this.mask = util.generateMask(size);
	}
	util.inherit(Register, DecoderRegister);

	Register.prototype.get = function () {
		return this.value;
	};
	Register.prototype.set = function (val) {
		// Mask out bits of value outside Register's bit-width
		this.value = (val & this.mask) >>> 0;
	};
	Register.prototype.clear = function () {
		this.set(0x00);
	};
	// Returns a nicely formatted hex string, with register value, padded to its size
	Register.prototype.getHexString = function () {
		var val = (this.get() >>> 0).toString(16).toUpperCase(),
			sizeHexChars = this.getSize() * 2,
			textLeadingZeroes = new Array(sizeHexChars - val.length + 1).join("0"),
		// Use spaces to right-align hex characters with the full 32-bit ones (8 chars)
			textLeadingSpaces = new Array(8 - sizeHexChars + 1).join(" ");

		return textLeadingSpaces + textLeadingZeroes + val;
	};

	// Exports
	return Register;
});
