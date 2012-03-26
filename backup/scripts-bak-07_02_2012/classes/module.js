/*
 *	jsEmu - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: Modules support
 */
// Scope encapsulator
new function () {
	// Primary Module class constructor
	//	( does not depend on other Modules )
	jsEmu.PrimaryModule = function ( funcScopeWrapper ) {
		this.funcScopeWrapper = funcScopeWrapper;
	};
	
	// Secondary Module class constructor
	//	( does depend on other Modules )
	jsEmu.SecondaryModule = function ( funcScopeWrapper ) {
		this.funcScopeWrapper = funcScopeWrapper;
	};
}