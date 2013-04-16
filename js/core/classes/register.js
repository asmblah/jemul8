/*
 * jemul8 - JavaScript x86 Emulator
 *
 * MODULE: Register class support
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
