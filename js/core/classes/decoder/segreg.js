/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *	
 *	MODULE: Segment Register class
 */

define([
	"../../util"
	, "./register"
], function ( util, Register ) { "use strict";
	
	function SegRegister( name ) {
		util.assert(this && (this instanceof SegRegister)
			, "SegRegister ctor :: error - constructor not called properly"
		);
		
		// Segment Registers are 16 bits wide
		Register.call(this, name, 2);
	}
	util.inherit(SegRegister, Register);
	
	return SegRegister;
});
