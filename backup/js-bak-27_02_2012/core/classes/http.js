/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *	
 *	MODULE: HTTP I/O class support
 */

define([
	"../util"
	, "./memory/buffer"
], function ( util, Buffer ) { "use strict";
	
	var isIE = self.ActiveXObject && !self.opera;
	var xmlhttp = self.XMLHttpRequest
			? new self.XMLHttpRequest()
			: new self.ActiveXObject("MSXML2.XMLHTTP")
		, useProxy = !xmlhttp.overrideMimeType;
	
	// HTTP static class
	function HTTP() {
		util.problem("HTTP is static-only!");
	}
	
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
	/* static */HTTP.getHTTP = function ( path ) {
		xmlhttp.open("GET", path, false);
		xmlhttp.send("");
		return xmlhttp.responseText;
	};
	
	// Ultra-modern, fast Typed Arrays support (faster)
	if ( util.support.typedArrays ) {
		HTTP.get = function ( path, minSize ) {
			path = getURL(path);
			
			xmlhttp.open("GET", path, false);
			xmlhttp.responseType = "arraybuffer";
			xmlhttp.send("");
			
			if ( !minSize || xmlhttp.response.byteLength >= minSize ) {
				return Buffer.wrapMultibyteBuffer(xmlhttp.response);
			// Make sure result buffer is of minimum size
			} else {
				var bufIn = xmlhttp.response
					, bufOut = Buffer.createByteBuffer(minSize);
				Buffer.copy(bufIn, 0, bufOut, 0, bufIn.byteLength);
				return Buffer.getBuffer(bufOut);
			}
		};
	// Legacy native Arrays support (slower)
	} else {
		HTTP.get = function ( path ) {
			var idx, len, chars, bytes;
			
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
				util.panic("HTTP.get() :: Error -"
					+ " XMLHttpRequest failed");
			}*/
			
			chars = xmlhttp.responseText;
			len = chars.length;
			// Optimize by reserving array length in advance
			bytes = new Array( len );
			
			// Clip charCodes into ASCII range
			//	00h->FFh (from UNICODE F700h->F7FFh)
			for ( idx = 0 ; idx < len ; ++idx ) {
				bytes[ idx ] = chars.charCodeAt(idx) & 0xFF;
			}
			return bytes;
		};
	}
	
	// Exports
	return HTTP;
});
