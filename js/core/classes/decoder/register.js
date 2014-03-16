/*
 * jemul8 - JavaScript x86 Emulator
 *
 * MODULE: Register class
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

	function Register(name, size) {
		util.assert(this && (this instanceof Register)
			, "Register ctor :: error - constructor not called properly"
		);

		this.mask = util.generateMask(size);
		this.name = name;
		this.size = size;
	}
	util.extend(Register.prototype, {
		getMask: function () {
			return this.mask;
		},
		getName: function () {
			return this.name;
		},
		getSize: function () {
			return this.size;
		}
	});

	return Register;
});
