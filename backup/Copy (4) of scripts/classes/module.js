/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: Modules support
 */
// Scope encapsulator
new function () {
	// Primary Module class constructor
	//	( does not depend on other Modules )
	jemul8.PrimaryModule = function ( funcScopeWrapper ) {
		this.funcScopeWrapper = funcScopeWrapper;
		this.funcDeferredLoader = null;
	};
	jemul8.PrimaryModule.prototype.RegisterDeferredLoader = function ( func ) {
		this.funcDeferredLoader = func;
	};
	
	// Secondary Module class constructor
	//	( does depend on other Modules )
	jemul8.SecondaryModule = function ( funcScopeWrapper ) {
		this.funcScopeWrapper = funcScopeWrapper;
	};
}