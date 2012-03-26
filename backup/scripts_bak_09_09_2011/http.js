/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: HTTP I/O class support
 */
var isIE = window.ActiveXObject && !window.opera;

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("http", function ( $ ) { "use strict";
	var jemul8 = this.data("jemul8")
		, xmlhttp = window.XMLHttpRequest
			? new window.XMLHttpRequest()
			: new window.ActiveXObject("MSXML2.XMLHTTP")
		, useProxy = !xmlhttp.overrideMimeType;
	
	function getURL( path ) {
		if ( useProxy ) {
			// NB: random parameter added to URL to ensure caching systems
			//	 are defeated - ( we MUST always have the latest copy of data
			//	 to prevent synchronisation problems )
			return "get.php?path=" + encodeURIComponent(path)
				+ "&rand=" + encodeURIComponent(Math.random());
		}
		return path;
	}
	
	// Synchronously download a file over HTTP
	/* static */jemul8.getHTTP = function ( path ) {
		xmlhttp.open("GET", path, false);
		xmlhttp.send("");
		return xmlhttp.responseText;
	};
	
	// Ultra-modern, fast Typed Arrays support (faster)
	if ( jemul8.support.typedArrays ) {
		jemul8.getFile = function ( path ) {
			path = getURL(path);
			
			xmlhttp.open("GET", path, false);
			xmlhttp.responseType = "arraybuffer";
			xmlhttp.send("");
			
			return this.wrapMultibyteBuffer(xmlhttp.response);
		};
	// Legacy native Arrays support (slower)
	} else {
		jemul8.getFile = function ( path ) {
			var idx, len
				, chars, byts;
			
			path = getURL(path);
			
			xmlhttp.open("GET", path, false);
			// Force to x-user-defined encoding (Latin-1 ASCII, UTF-8 fail
			//	in reserved 128-160 range - force to UNICODE Private Area
			//	(0xF700-0xF7FF) range)
			//	( NB: fix from http://mgran.blogspot.com/2006/08/downloading-binary-streams-with.html )
			if ( !useProxy ) {
				xmlhttp.overrideMimeType("text/plain; charset=x-user-defined");
			}
			xmlhttp.send("");
			
			// Basic checking
			//	(TODO: We need to use async ajax!!!)
			//	- fails in Opera?!?
			/*if ( xmlhttp.status !== 200 ) {
				jemul8.panic("jemul8.getFile() :: Error -"
					+ " XMLHttpRequest failed");
			}*/
			
			// Modern browsers
			if ( !isIE ) {
				chars = xmlhttp.responseText;
				len = chars.length;
				// Optimize by reserving array length in advance
				byts = new Array( len );
				
				// Clip charCodes into ASCII range
				//	00h->FFh (from UNICODE F700h->F7FFh)
				for ( idx = 0 ; idx < len ; ++idx ) {
					byts[ idx ] = chars.charCodeAt(idx) & 0xFF;
				}
				return byts;
			// Old IE
			} else {
				// Use VBScript to interpret the binary array
				//	& convert to a safe array of integer ASCII values
				//	(because the raw .responseBody is used, no clipping
				//	is necessary)
				return new VBArray( xmlhttp.responseBody ).toArray();
			}
		};
	}
});
