/*
 *	jsEmu - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: Display Screen support
 */
var mod = new jsEmu.PrimaryModule( function ( jsEmu ) {
	
	// Display Screen class constructor
	function Screen( divScreen ) {
		/* ==== Guards ==== */
		jsEmu.Assert(this != self, "Screen constructor :: not called as constructor.");
		jsEmu.Assert(divScreen && divScreen.tagName, "Screen constructor :: invalid DOM screen object given.");
		/* ==== /Guards ==== */
		
		// Store DOM element ref for screen
		this.divScreen = divScreen;
		// List of pages available for this screen, by index
		this.arr_page = [];
		
		this.pageActive = null;
	}
	
	// Add a display Page to this Screen
	Screen.prototype.AddPage = function ( page ) {
		/* ==== Guards ==== */
		jsEmu.Assert(page instanceof jsEmu.ScreenPage, "Screen.AddPage :: invalid ScreenPage object given.");
		jsEmu.Assert(!this.arr_page[page.idx], "Screen.AddPage :: a ScreenPage object with the given index already exists.");
		/* ==== /Guards ==== */
		
		this.arr_page[page.idx] = page;
		
		// Add page's wrapper div to the screen's wrapper
		this.divScreen.appendChild(page.divPage);
	};
	Screen.prototype.SetActivePage = function ( idx ) {
		/*
		 *	For simplicity & speed, rather than play around with z-indexes
		 *	to try to order screen pages such that the active one is at front,
		 *	we simply hide all pages except the active page.
		 */
		/* ==== Malloc ==== */
		var idx_page;
		var num_page;
		/* ==== /Malloc ==== */
		// Hide all pages
		for ( idx_page = 0 ; idx_page < num_page ; ++idx_page ) {
			this.arr_page[idx_page].Hide();
		}
		// Show only the active one
		this.pageActive = this.arr_page[idx];
		this.pageActive.Show();
	};
	Screen.prototype.GetActivePage = function () {
		return this.pageActive;
	};
	// Refresh video memory to screen
	Screen.prototype.Refresh = function () {
		/* ==== Malloc ==== */
		var pageActive = this.pageActive;
		var idx_char;
		var num_char = pageActive.num_char;
		var arr_char = pageActive.arr_char;
		var wordChar;
		var textChar;
		var divChar;
		var offsetBytes = pageActive.offsetBytes;
		var DRAM = jsEmu.DRAM;
		/* ==== /Malloc ==== */
		
		// Iterate through all characters in page to draw to screen
		for ( idx_char = 0 ; idx_char < num_char ; ++idx_char ) {
			wordChar = DRAM.ReadBytes(offsetBytes + idx_char * 2, 2);
			// Extract ASCII char as low-byte, and convert to a text char for display
			textChar = hshASCII[wordChar & 0xFF];
			// textContent should be used where supported; it takes approximately
			//	half the time to render than setting .innerHTML ( presumably
			//	because it does not have to start up the HTML parser )
			// NB: MASSIVE difference doing this check first, so we only change if the character
			//	has actually changed; this may seem unnecessary, but FF hooks the setting of .textContent
			//	( even if it is being set to the same value ) and updates the DOM ( slowly! )
			// NB2: halved time again by reading a custom property from the object instead of a DOM one
			divChar = arr_char[idx_char];
			if ( divChar.textChar !== textChar ) {
				divChar.innerHTML = divChar.textChar = textChar;
			}
		}
	};
	
	/* ====== Cache ASCII codes -> characters ====== */
	// Function calls are expensive, so rather than calling
	//	fromCharCode() for every char on page, do an
	//	array lookup ( see Screen.Refresh )
	var hshASCII = {};
	for ( var i = 0 ; i < 256 ; ++i ) {
		hshASCII[i] = String.fromCharCode(i);
	}
	/* ====== /Cache ASCII codes -> characters ====== */
	
	// Map of standard ( ie. BIOS-level ) 3-bit colour pallette
	//	to HTML colours for display
	var palleteColours = {
		0x07:	"white"
		, 0x06:	"yellow"
		, 0x05: "magenta"
		, 0x04: "red"
		, 0x03: "cyan"
		, 0x02: "green"
		, 0x01: "blue"
		, 0x00: "black"
	};
	
	/* ==== Exports ==== */
	jsEmu.Screen = Screen;
	/* ==== /Exports ==== */
});

// Add Module to emulator
jsEmu.AddModule(mod);