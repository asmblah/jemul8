/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *
 *	MODULE: CPU Instruction class support
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
