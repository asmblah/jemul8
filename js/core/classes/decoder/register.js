/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *	
 *	MODULE: Register class
 */

define([
	"../../util"
], function (util) { "use strict";
	
	function Register(name, size) {
		util.assert(this && (this instanceof Register)
			, "Register ctor :: error - constructor not called properly"
		);
		
		this.name = name;
		this.size = size;
	}
	util.extend(Register.prototype, {
		getName: function () {
			return this.name;
		}, getSize: function () {
			return this.size;
		}
	});
	
	return Register;
});
