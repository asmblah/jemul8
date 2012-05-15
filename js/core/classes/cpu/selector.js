/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *	
 *	MODULE: Segment Selector class support
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
	
	// Segment Selector class constructor
	function Selector() {
		util.assert(this && (this instanceof Selector)
			, "Selector constructor :: error - not called properly"
		);
		
		this.rpl = 0;   // Requestor Privilege Level
		this.table = 0; // Table Indicator (TI) bit
		this.index = 0; // Table Index
	}
	util.extend(Selector, {
		// Parse a raw segment selector
		parse: function (raw) {
			var selector = new Selector();
			return selector.parse(raw);
		}
	});
	util.extend(Selector.prototype, {
		// Reconstruct raw value of selector from components
		getValue: function () {
			return this.rpl
				| (this.table << 2)
				| (this.index << 3);
		// Parse raw selector into components
		}, parse: function (raw) {
			this.rpl = raw & 0x03          // RPL
			this.table = (raw >> 2) & 0x01 // Table Indicator
			this.index = raw >> 3          // Table Index
			
			return this;
		}
	});
	
	// Exports
	return Selector;
});
