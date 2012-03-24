/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: Display Screen support
 */
var mod = new jemul8.PrimaryModule( function ( jemul8 ) {
	/* ============ Import system after setup ============ */
	var machine, CPU, DRAM;
	this.RegisterDeferredLoader( function ( machine_, CPU_, DRAM_ ) {
		machine = machine_; CPU = CPU_; DRAM = DRAM_;
	});
	/* ============ /Import system after setup ============ */
	
	// Display Screen class constructor
	function Screen( divScreen ) {
		/* ==== Guards ==== */
		jemul8.Assert(this != self, "Screen constructor :: not called as constructor.");
		jemul8.Assert(divScreen && divScreen.tagName, "Screen constructor :: invalid DOM screen object given.");
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
		jemul8.Assert(page instanceof jemul8.ScreenPage, "Screen.AddPage :: invalid ScreenPage object given.");
		jemul8.Assert(!this.arr_page[page.idx], "Screen.AddPage :: a ScreenPage object with the given index already exists.");
		/* ==== /Guards ==== */
		
		this.arr_page[page.idx] = page;
		
		// Add page's wrapper div to the screen's wrapper
		this.divScreen.appendChild(page.divPage);
	};
	Screen.prototype.setActivePage = function ( idx ) {
		/*
		 *	For simplicity & speed, rather than play around with z-indexes
		 *	to try to order screen pages such that the active one is at front,
		 *	we simply hide all pages except the active page.
		 */
		/* ==== Malloc ==== */
		var idx_page;
		var num_page = this.arr_page.length;
		/* ==== /Malloc ==== */
		// Hide all pages
		for ( idx_page = 0 ; idx_page < num_page ; ++idx_page ) {
			this.arr_page[idx_page].Hide();
		}
		// Show only the active one
		this.pageActive = this.arr_page[idx];
		this.pageActive.Show();
	};
	Screen.prototype.getActivePage = function () {
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
		
		var bytAttribute;
		var flgBlink;
		var clrBackground;
		var flgBright;
		var clrForeground;
		
		var codeChar;
		var divChar;
		var offsetBytes = pageActive.offsetBytes;
		/* ==== /Malloc ==== */
		
		if ( numRefresh == 0 ) {
			flgRefresh_BlinkVisible = !flgRefresh_BlinkVisible;
		}
		
		// Iterate through all characters in page to draw to screen
		for ( idx_char = 0 ; idx_char < num_char ; ++idx_char ) {
			wordChar = DRAM.ReadBytes(offsetBytes + idx_char * 2, 2);
			// Extract Attribute byte as high-byte
			bytAttribute = wordChar >> 8;
			flgBlink = bytAttribute >> 7;
			clrBackground = (bytAttribute >> 4) & 0x07;
			flgBright = bytAttribute & 0x08;	// Brightness is ignored
			clrForeground = bytAttribute & 0x07;
			// Extract ASCII char code as low-byte
			codeChar = wordChar & 0xFF;
			// textContent should be used where supported; it takes approximately
			//	half the time to render than setting .innerHTML ( presumably
			//	because it does not have to start up the HTML parser )
			// NB: MASSIVE difference doing this check first, so we only change if the character
			//	has actually changed; this may seem unnecessary, but FF hooks the setting of .textContent
			//	( even if it is being set to the same value ) and updates the DOM ( slowly! )
			// NB2: halved time again by reading a custom property from the object instead of a DOM one
			// NB3: removed use of .innerHTML/.textContent completely, in favour of using a raster image for font
			//	rendering - this saves an ASCII code -> string character lookup, and all char elements are initialised
			//	to the top-left corner of the font image, so changing character just involves moving image ( see below )
			divChar = arr_char[idx_char];
			// Only update character displayed if it has changed
			if ( divChar.codeChar !== codeChar ) {
				divChar.codeChar = codeChar;
				// Look up ASCII code in map to quickly use to the appropriate background offset
				//	and switch to the new character
				divChar.style.backgroundPosition = hshASCII_CSS_BG_Pos[codeChar];
			}
			// Background colour of character
			if ( divChar.clrBackground !== clrBackground ) {
				divChar.clrBackground = clrBackground;
				divChar.style.backgroundColor = palleteColours[clrBackground];
			}
			// Text / foreground colour of character
			if ( divChar.clrForeground !== clrForeground ) {
				divChar.clrForeground = clrForeground;
				divChar.style.color = palleteColours[clrForeground];
			}
			// Blink character
			if ( flgBlink ) {
				divChar.flgVisible = flgRefresh_BlinkVisible;
				divChar.style.visibility = visibility[divChar.flgVisible];
			// Character blink turned off; ensure character is visible
			} //else if ( !divChar.flgVisible ) {
				//divChar.flgVisible = true;
				//divChar.style.visibility = "visible";
			//}
		}
		
		numRefresh = (numRefresh + 1) % 30;
	};
	
	var numRefresh = 0;
	var flgRefresh_BlinkVisible = false;
	
	/* ====== Cache ASCII codes -> characters ====== */
	// Function calls are expensive, so rather than calling
	//	fromCharCode() for every char on page, do an
	//	array lookup ( see Screen.Refresh )
	var hshASCII = {};
	for ( var codeChar = 0 ; codeChar < 256 ; ++codeChar ) {
		hshASCII[codeChar] = String.fromCharCode(codeChar);
	}
	/* ====== /Cache ASCII codes -> characters ====== */
	
	/* ======== Cache ASCII codes -> font image offsets ======== */
	var hshASCII_CSS_BG_Pos = {};
	var x, y;
	for ( var codeChar = 0 ; codeChar < 256 ; ++codeChar ) {
		// Font table image is 144px x 256px
		x = (codeChar % 16) * 9;
		y = ((codeChar / 16) >> 0) * 16;
		hshASCII_CSS_BG_Pos[codeChar] = -x + "px " + -y + "px";
	}
	/* ======== /Cache ASCII codes -> font image offsets ======== */
	
	// Fast lookup to convert visibility state to CSS value
	var visibility = {
		1: "visible"
		, 0: "hidden"
	};
	
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
	jemul8.Screen = Screen;
	/* ==== /Exports ==== */
});

// Add Module to emulator
jemul8.AddModule(mod);