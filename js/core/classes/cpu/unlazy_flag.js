/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *	
 *	MODULE: CPU "Unlazy" Flag class support
 *		Notes: Allows a LazyFlagsRegister to also have non-lazy flags
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

define([
	"../../util"
], function (util) { "use strict";
	
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
