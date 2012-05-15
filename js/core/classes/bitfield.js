/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *	
 *	MODULE: Bitfield class support
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

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("bitfield", function ($) { "use strict";
	var jemul8 = this.data("jemul8");
	
	function Bitfield(sizeBits) {
		this.sizeBits = sizeBits;
		this.value = 0;
	}
	Bitfield.prototype.set = function (val) {
		this.value = val;
	};
	Bitfield.prototype.get = function () {
		return this.value;
	};
	Bitfield.prototype.setBit = function (idx) {
		this.value |= 1 << idx;
	};
	Bitfield.prototype.clearBit = function (idx) {
		this.value &= ~(1 << idx);
	};
	Bitfield.prototype.toggleBit = function (idx) {
		this.value ^= 1 << idx;
	};
	Bitfield.prototype.setBits = function (idx, val, numBitsMax) {
		/* ==== Malloc ==== */
		var bitmaskMaxSize = Math.pow(2, numBitsMax);
		/* ==== /Malloc ==== */
		this.value |= (val & bitmaskMaxSize) << idx;
	};
	
	// Exports
	jemul8.Bitfield = Bitfield;
});
