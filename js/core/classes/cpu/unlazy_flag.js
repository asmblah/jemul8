/*
 * jemul8 - JavaScript x86 Emulator
 *
 * MODULE: CPU "Unlazy" Flag class support
 *		Notes: Allows a LazyFlagsRegister to also have non-lazy flags
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

	// CPU Unlazy Flag class constructor
	function UnlazyFlag(name, regMaster, bitsInLeft) {
		/* ==== Guards ==== */
		util.assert(this && (this instanceof UnlazyFlag), "UnlazyFlag ctor ::"
			+ " error - constructor not called properly");
		/*util.assert(regMaster && (regMaster instanceof jemul8.LazyFlagRegister)
			, "UnlazyFlag constructor ::"
			+ " no valid master LazyFlagRegister specified.");
		 ==== /Guards ==== */

		this.bitsInLeft = bitsInLeft;

		this.value = 0;

		this.name = name;	// May be null for anonymous / reserved flags
		this.regMaster = regMaster;

		// Add to master LazyFlagsRegister's hash
		regMaster.hsh_flg[ bitsInLeft ] = this;
	}
	UnlazyFlag.prototype.get = function () {
		return this.value;
	};
	UnlazyFlag.prototype.set = function () {
		this.value = 1;
	};
	UnlazyFlag.prototype.clear = function () {
		this.value = 0;
	};
	UnlazyFlag.prototype.setBin = function (val) {
		// Should be faster than eg. val ? 1 : 0
		this.value = val & 0x01;
	};
	UnlazyFlag.prototype.toggle = function () {
		this.set(!this.get());
	};

	/* ====== Private ====== */

	/* ====== /Private ====== */

	// Exports
	return UnlazyFlag;
});
