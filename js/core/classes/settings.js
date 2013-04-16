/*
 * jemul8 - JavaScript x86 Emulator
 *
 * MODULE: Settings class support
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
], function (
	util
) {
    "use strict";

	// Emulator settings system class
	function Settings(defaults) {
		/* ==== Guards ==== */
		util.assert(this && (this instanceof Settings), "Settings ctor ::"
			+ " error - constructor not called properly");
		/* ==== /Guards ==== */

		this.defaults = defaults;
		this.settings = $.extend({}, defaults);
	}
	$.extend(Settings.prototype, {
		load: function (options) {
			$.extend(this.settings, options);
		}, get: function (name) {
			return this.settings[ name ];
		}, set: function (name, val) {
			this.settings[ name ] = val;
		}
	});

	// Exports
	return Settings;
});
