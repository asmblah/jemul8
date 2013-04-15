/*
 * jemul8 - JavaScript x86 Emulator
 *
 * MODULE: Segment Selector class support
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
