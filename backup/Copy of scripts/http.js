/*
 *	jsEmu - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: HTTP I/O class support
 */
var mod = new jsEmu.SecondaryModule( function ( jsEmu, machine, motherboard, CPU, FlashBIOSChip, BIOS, DRAM ) {
	
	/* ==== Malloc ==== */
	var xmlhttp = window.XMLHttpRequest ? new window.XMLHttpRequest() : null;
	/* ==== /Malloc ==== */
	
	// Synchronously download a file over HTTP
	jsEmu.GetSyncHTTP = function ( path ) {
		xmlhttp.open("GET", path, false);
		xmlhttp.send("");
		return xmlhttp.responseText;
	}
	
	jsEmu.GetSyncHTTP_Binary = function ( path ) {
		/* ==== Malloc ==== */
		var arr_bytResponse;
		var numBytes;
		var idx;
		/* ==== /Malloc ==== */
		
		xmlhttp.open("GET", path, false);
		// Force to x-user-defined encoding (Latin-1 ASCII, UTF-8 fail in reserved 128-160 range - force to UNICODE Private Area (0xF700-0xF7FF) range)
		//	( NB: fix from http://mgran.blogspot.com/2006/08/downloading-binary-streams-with.html )
		xmlhttp.overrideMimeType("text/plain; charset=x-user-defined");
		xmlhttp.send("");
		
		// Read response, split into bytes / characters
		arr_bytResponse = xmlhttp.responseText.split("");
		
		// Clip charCodes into ASCII range 00h->FFh (from UNICODE F700h->F7FFh)
		numBytes = arr_bytResponse.length;
		for ( idx = 0 ; idx < numBytes ; ++idx ) {
			arr_bytResponse[idx] = arr_bytResponse[idx].charCodeAt(0) & 0xFF;
		}
		
		// Read raw program image data
		return arr_bytResponse;
	}
	
	/* ==== Exports ==== */
	
	/* ==== /Exports ==== */
});

// Add Module to emulator
jsEmu.AddModule(mod);