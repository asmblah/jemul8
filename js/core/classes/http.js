/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *	
 *	MODULE: HTTP I/O class support
 *
 *  ====
 *  
 *  This file is part of jemul8.
 *  
 *  jemul8 is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *  
 *  jemul8 is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *  
 *  You should have received a copy of the GNU General Public License
 *  along with jemul8.  If not, see <http://www.gnu.org/licenses/>.
 */

define([
	"../util"
	, "./memory/buffer"
], function (util, Buffer) { "use strict";
	
	var isIE = self.ActiveXObject && !self.opera;
	var useProxy = isIE;
	
	// HTTP static class
	function HTTP() {
		util.problem("HTTP is static-only!");
	}
	
	function getURL(path) {
		if (useProxy) {
			// NB: random parameter added to URL to ensure caching systems
			//	 are defeated - ( we MUST always have the latest copy of data
			//	 to prevent synchronisation problems )
			path = "get.php?path=" + encodeURIComponent(path)
				+ "&rand=" + encodeURIComponent(Math.random());
		}
		return path;
	}

	function createXHR() {
		return self.XMLHttpRequest
			? new self.XMLHttpRequest()
			: new self.ActiveXObject("MSXML2.XMLHTTP");
	}
	
	// Synchronously download a file over HTTP
	/* static */HTTP.getHTTP = function (path) {
		var xhr = createXHR();

		xhr.open("GET", path, false);
		xhr.send("");

		return xhr.responseText;
	};
	
	// Ultra-modern, fast Typed Arrays support (faster)
	if (util.support.typedArrays) {
		HTTP.get = function (path, done, fail, minSize) {
			var xhr = createXHR();

			path = getURL(path);
			
			xhr.open("GET", path, true);
			xhr.responseType = "arraybuffer";
			xhr.onreadystatechange = function () {
				var buffer, bufIn, bufOut;
				
				if (this.readyState === 4) {
					if (this.status === 200) {
						if (!minSize || this.response.byteLength >= minSize) {
							buffer = Buffer.wrapMultibyteBuffer(this.response);
						// Make sure result buffer is of minimum size
						} else {
							bufIn = this.response;
							bufOut = Buffer.createByteBuffer(minSize);
							Buffer.copy(bufIn, 0, bufOut, 0, bufIn.byteLength);
							buffer = Buffer.getBuffer(bufOut);
						}
						
						done(path, buffer);
					} else {
						fail(path);
					}
				}
			};
			xhr.send("");
		};
	// Legacy native Arrays support (slower)
	} else {
		HTTP.get = function (path, done, fail) {
			var idx, len, chars, bytes;
			
			path = getURL(path);

			xmlhttp.open("GET", path, true);
			// Force to x-user-defined encoding (Latin-1 ASCII, UTF-8 fail
			//	in reserved 128-160 range - force to UNICODE Private Area
			//	(0xF700-0xF7FF) range)
			//	(NB: fix from http://mgran.blogspot.com/2006/08/downloading-binary-streams-with.html)
			if (!useProxy) {
				xmlhttp.overrideMimeType("text/plain; charset=x-user-defined");
			}
			xmlhttp.send("");
			
			chars = xmlhttp.responseText;
			len = chars.length;
			// Optimize by reserving array length in advance
			bytes = new Array(len);
			
			// Clip charCodes into ASCII range
			//	00h->FFh (from UNICODE F700h->F7FFh)
			for (idx = 0 ; idx < len ; ++idx) {
				bytes[ idx ] = chars.charCodeAt(idx) & 0xFF;
			}
			return bytes;
		};
	}
	
	// Exports
	return HTTP;
});
