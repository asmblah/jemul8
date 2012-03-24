/*
 *	jsEmu - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: Display Screen page support
 */
var mod = new jsEmu.PrimaryModule( function ( jsEmu ) {
	/* ============ Import system after setup ============ */
	var machine, motherboard, CPU, FlashBIOSChip, BIOS, DRAM;
	this.RegisterDeferredLoader( function ( machine_, motherboard_, CPU_, FlashBIOSChip_, BIOS_, DRAM_ ) {
			machine = machine_; motherboard = motherboard_; CPU = CPU_; FlashBIOSChip = FlashBIOSChip_; BIOS = BIOS_; DRAM = DRAM_;
		});
	/* ============ /Import system after setup ============ */
	
	// Display Screen page class constructor
	function ScreenPage( idx, rows, cols, offsetBytes ) {
		/* ==== Guards ==== */
		jsEmu.Assert(this != self, "ScreenPage constructor :: not called as constructor.");
		/* ==== /Guards ==== */
		/* ==== Malloc ==== */
		var idx_col;
		var idx_row;
		var row;
		var col;
		var divPage;
		var arr_row;
		var idx_char;
		/* ==== /Malloc ==== */
		
		this.idx = idx;
		// Current position of the cursor on this page
		//this.rowCursor = 0;
		//this.colCursor = 0;
		this.posCursor = 0;
		// Cursor size / shape
		this.lineCursorStart = 0x00;
		this.lineCursorEnd = 0x0F;
		
		// Number of rows / columns for page
		//	( eg. 80x25 or 40x25 )
		this.rows = rows;
		this.cols = cols;
		
		this.num_char = rows * cols;
		
		// Tab width, for horizontal tabs ( in columns )
		this.widthTab = 8;
		// Tab height, for vertical tabs ( in rows )
		this.heightTab = 4;
		
		// 1-dimensional array of character DOM elements ( row 0, then row 1, etc. )
		this.arr_char = [];
		
		// Size of video memory ( in bytes ) that this page consumes
		//	( NB: usually, video memory would be on the video adapter
		//	chip and mapped from address range B800:0000h, but for
		//	simplicity we just use the DRAM ( ie. emulate shared video memory ) )
		this.offsetBytes = offsetBytes;
		
		/* ========= Clear text video memory ========= */
		// Use an invisible ASCII character that won't get
		//	a special display by the browser ( ie. not ASCII char zero )
		var charASCII = " ".charCodeAt(0);
		// White on black char ( invisible anyway though )
		var bytAttribute = parseInt("00000111", 2);
		var wordChar = charASCII | (bytAttribute << 8);
		for ( idx_char = 0 ; idx_char < this.num_char ; ++idx_char ) {
			DRAM.WriteBytes(offsetBytes + idx_char * 2, wordChar, 2);
		}
		/* ========= /Clear text video memory ========= */
		
		/* ====== Page in the DOM ====== */
		divPage = this.divPage = document.createElement("div");
		divPage.className = "pageScreen";
		/* ====== /Page in the DOM ====== */
		
		for ( idx_row = 0, idx_char = 0 ; idx_row < rows ; ++idx_row ) {
			row = document.createElement("div");
			row.className = "row";
			
			for ( idx_col = 0 ; idx_col < cols ; ++idx_col ) {
				col = document.createElement("div");
				col.className = "char";
				col.style.left = /*idx_col / 2 + "em"*/ idx_col * 9 + "px";
				row.appendChild(col);
				
				this.arr_char[idx_char] = col;
				++idx_char;
			}
			// Add the completed row to the screen wrapper
			divPage.appendChild(row);
		}
	}
	
	ScreenPage.prototype.GetCursorRow = function () {
		return ((this.posCursor / this.cols) >> 0);
	};
	ScreenPage.prototype.GetCursorCol = function () {
		return this.posCursor % this.cols;
	};
	// Move the cursor to a position by an absolute row and column
	ScreenPage.prototype.SetCursorPosition = function ( rowCursor, colCursor ) {
		// Ensure column parameter is modulo'd in case too large a value is passed
		this.posCursor = rowCursor * this.cols + (colCursor % this.cols);
	};
	// Return to beginning of current line
	ScreenPage.prototype.CarriageReturn = function () {
		this.AdvanceCursor(-this.GetCursorCol());
	};
	// Move down one row ( stay at current column )
	ScreenPage.prototype.LineFeed = function () {
		this.AdvanceCursor(this.cols);
	};
	// Move to next tab stop
	ScreenPage.prototype.HorizontalTab = function () {
		this.AdvanceCursor(this.widthTab - (this.GetCursorCol() % this.widthTab));
	};
	// Move to next vertical stop
	ScreenPage.prototype.VerticalTab = function () {
		this.AdvanceCursor(this.heightTab - (this.GetCursorRow() % this.heightTab));
	};
	
	ScreenPage.prototype.Hide = function () {
		this.divPage.style.display = "none";
	};
	ScreenPage.prototype.Show = function () {
		this.divPage.style.display = "block";
	};
	// Write a character ( given as a 1-char text string, not as ASCII number ) to the page @ cursor
	//	NB: ANSI text characters will only advance the cursor if specified, however carriage-return and linefeed
	//	both move the cursor under all conditions
	ScreenPage.prototype.WriteCharAtCursor = function ( charASCII, flgAdvance ) {
		/* ==== Malloc ==== */
		var bytAttribute;
		var wordChar;
		/* ==== /Malloc ==== */
		
		// Carriage-return
		if ( charASCII === 0x0D ) {
			// Always move cursor
			this.CarriageReturn();
			return;	// Don't try to print
		// Line-feed
		} else if ( charASCII === 0x0A ) {
			// Always move cursor
			this.LineFeed();
			return;	// Don't try to print
		// BEL ( Terminal Bell )
		} else if ( charASCII === 0x07 ) {
			// Alert user with beep / sound the terminal bell !
			jsEmu.speakerOnboard.Beep();
			return;	// Don't try to print
		// Backspace ( NOT destructive )
		//	NB: although backspace is treated specially, space is implemented
		//		as a "blank" on the raster font image, as it is destructive anyway
		//		( ie. will overwrite whatever is under the cursor, unlike backspace )
		} else if ( charASCII === 0x08 ) {
			// NB: Do not use "this.AdvanceCursor(-1);", as this would allow
			//	backspace to move to end of previous line
			if ( this.posCursor % this.cols > 0 ) {
				--this.posCursor;
			}
			return;	// Don't try to print
		// Horizontal tab ( not supported for BIOS teletype - has a character )
		//} else if ( charASCII === 0x09 ) {
		//	this.HorizontalTab();
		// Vertical tab ( not supported for BIOS teletype - has a character )
		//} else if ( charASCII === 0x0B ) {
		//	this.VerticalTab();
		}
		
		/**** If this point is reached, character is printable and should be displayed ****/
		
		// Attribute byte; format ( for bits, from 7 -> 0 ):
		//	7		=> normal (0) | blink(1)
		//	6, 5, 4	=> 3-bit background colour
		//	3		=> Brightness - normal (0) | bright(1)
		//	2, 1, 0	=> 3-bit foreground colour
		bytAttribute = parseInt("00000111", 2);
		wordChar = charASCII | (bytAttribute << 8);
		
		// Advance cursor first, to ensure we do not write to the next page accidentally
		this.AdvanceCursor(1);
		// Remember to subtract 2 bytes as we already advanced the cursor forward
		DRAM.WriteBytes(this.offsetBytes + this.posCursor * 2 - 2, wordChar, 2);
	};
	
	// Advance the cursor by an amount relative to its current position,
	//	scrolling screen as necessary ( may be negative )
	ScreenPage.prototype.AdvanceCursor = function ( num_char ) {
		/* ==== Malloc ==== */
		var numCharsOnPage = this.num_char;
		var num_rowsScroll;
		/* ==== /Malloc ==== */
		this.posCursor += num_char;
		// Scroll page when cursor tries to move off the end / bottom
		if ( this.posCursor >= numCharsOnPage ) {
			num_rowsScroll = this.GetCursorRow() - this.rows + 1;
			this.ScrollUp(num_rowsScroll);
			this.posCursor = numCharsOnPage - this.cols * num_rowsScroll;
		}
	};
	
	// Scroll the page up/forward by the specified number of lines ( text moves up if positive )
	ScreenPage.prototype.ScrollUp = function ( num_lines ) {
		/* ==== Malloc ==== */
		var idx_rowDest;
		var idx_rowSource;
		var offset_rowDest;
		var offset_rowSource;
		
		var idx_col;
		var offsetBytes = this.offsetBytes;
		var cols = this.cols;
		var rows = this.rows - num_lines;
		var numBytesPerRow = cols * 2;
		/* ==== /Malloc ==== */
		
		for ( idx_rowDest = 0 ; idx_rowDest <= rows ; ++idx_rowDest ) {
			idx_rowSource = idx_rowDest + num_lines;
			offset_rowDest = offsetBytes + numBytesPerRow * idx_rowDest;
			offset_rowSource = offsetBytes + numBytesPerRow * idx_rowSource;
			
			// Iterate along chars in each column of this row, move them up to the new line
			for ( idx_col = 0 ; idx_col < cols ; ++idx_col ) {
				DRAM.WriteBytes(offset_rowDest + idx_col * 2, DRAM.ReadBytes(offset_rowSource + idx_col * 2, 2), 2);
			}
		}
	};
	
	/* ==== Exports ==== */
	jsEmu.ScreenPage = ScreenPage;
	/* ==== /Exports ==== */
});

// Add Module to emulator
jsEmu.AddModule(mod);