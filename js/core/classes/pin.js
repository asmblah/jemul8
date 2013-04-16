/*
 * jemul8 - JavaScript x86 Emulator
 *
 * MODULE: CPU Instruction class support
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
	"../util"
	, "./bit"
], function (
	util,
	Bit
) {
    "use strict";

	function Pin(name) {
		this.name = name;
		this.val = 0;
	}
	util.inherit(Pin, Bit);
	Pin.prototype.raise = function () {
		this.set(1);
	};
	Pin.prototype.lower = function () {
		this.set(0);
	};
	Pin.prototype.get = function () {
		return this.val;
	};
	Pin.prototype.set = function (val) {
		this.val = val;
	};
	Pin.prototype.isHigh = function () {
		return !!this.val;
	};
	// To enable actions to be triggered when Pin is raised or lowered
	Pin.prototype.hook = function (get, set) {
		if (get) { this.get = get; }
		if (set) { this.set = set; }
	};

	// Exports
	return Pin;
});
