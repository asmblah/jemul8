/*
 *	Simple data formatting :: jQuery plugin
 *	
 *	Copyright (c) 2011 http://www.ov-ms.com
 *	
 *	This copyright notice must remain in place for all copies
 *	or substantial portions of this code.
 */

// Installation check(s)
if ( !self.jQuery ) { throw new Error( "jQuery not installed" ); }
if ( !jQuery.plugin ) { throw new Error( "jQuery.plugin not installed" ); }

// Set up the jQuery plugin
new jQuery.plugin("OVMS", "format", "0.0.1")
.module("main", function ( $ ) { "use strict";
	// Format various data prettily
	this.static("format", function ( type, data /* or hour */, minute, sec ) {
		var args = arguments;
		switch ( type ) {
		case "hex":
			return "0x" + data.toString(16).toUpperCase();
		case "time":
			return data/* (hour) */ + ":" + minute + ":" + sec;
		case "bool":
			return data ? "true" : "false";
		default:
			jemul8.problem("jQuery.format() :: Error - invalid 'type'");
		}
	});
});
