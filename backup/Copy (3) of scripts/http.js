/*
 *	jsEmu - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: HTTP I/O class support
 */
var mod = new jsEmu.PrimaryModule( function ( jsEmu ) {
	
	/* ==== Malloc ==== */
	var xmlhttp = window.XMLHttpRequest ? new window.XMLHttpRequest() : new window.ActiveXObject("MSXML2.XMLHTTP");
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
		
		xmlhttp.open("GET", "get.php?path=" + encodeURIComponent(path), false);
		// Force to x-user-defined encoding (Latin-1 ASCII, UTF-8 fail in reserved 128-160 range - force to UNICODE Private Area (0xF700-0xF7FF) range)
		//	( NB: fix from http://mgran.blogspot.com/2006/08/downloading-binary-streams-with.html )
		//xmlhttp.overrideMimeType("text/plain; charset=x-user-defined");
		xmlhttp.send("");
		
		// Non-IE browsers
		if ( !window.ActiveXObject ) {
			// Read response, split into bytes / characters
			arr_bytResponse = xmlhttp.responseText.split("");
			
			// Clip charCodes into ASCII range 00h->FFh (from UNICODE F700h->F7FFh)
			numBytes = arr_bytResponse.length;
			for ( idx = 0 ; idx < numBytes ; ++idx ) {
				arr_bytResponse[idx] = arr_bytResponse[idx].charCodeAt(0) & 0xFF;
			}
		// IE
		} else {
			// Use VBScript wrapper
			arr_bytResponse = IE_ReadBinFile(xmlhttp.responseBody).toArray();
		}
		
		// Read raw program image data
		return arr_bytResponse;
	}
	
	/* ==== Exports ==== */
	
	/* ==== /Exports ==== */
});

/*
 *	In IE, there is no support for reading binary files properly;
 *	for starters, overrideMimeType() is not defined, so a server-side script
 *	must be used to generate x-user-defined MIME type. VBScript, though,
 *	has binary-safe functions available ( eg. LenB instead of Len ),
 *	so we can pipe the data through there to get a useful response ( without this,
 *	IE does populate the xmlhttp.responseBody property, but its typeof is 'unknown' )
 */
//	NB: based on http://www.heypage.com/nagoon97/BinFileReader/BinFileReader.js
if ( window.ActiveXObject ) {
	document.write('\n\
<scr' + 'ipt type="text/vbscript">\n\
Function IE_ReadBinFile( data )\n\
	\' ==== Malloc ====\n\
	Dim arr_byt\n\
	Dim len_byt\n\
	Dim idx_byt\n\
	\' ==== /Malloc ====\n\
	\' Use binary-safe function to get correct length,\n\
	\' then resize byte array to hold all data\n\
	\' ( NB: entire function uses binary-safe versions, ending in "B" )\n\
	len_byt = LenB(data) - 1\n\
	ReDim arr_byt(len_byt)\n\
\n\
	\' Iterate through bytes returned\n\
	For idx_byt = 0 To len_byt\n\
		arr_byt(idx_byt) = AscB(MidB(data, idx_byt + 1, 1))\n\
	Next\n\
\n\
	\' Send back the ( now safe ) byte array to JavaScript\n\
	IE_ReadBinFile = arr_byt\n\
End Function\n\
</scr' + 'ipt>');
	
}

// Add Module to emulator
jsEmu.AddModule(mod);