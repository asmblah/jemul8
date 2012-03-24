/*
 *	jsEmu - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: Display Screen page support
 */
var mod = new jsEmu.PrimaryModule( function ( jsEmu ) {
	
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
			jsEmu.DRAM.WriteBytes(offsetBytes + idx_char * 2, wordChar, 2);
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
				col.style.left = idx_col / 2 + "em";
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
		this.posCursor -= this.GetCursorCol();
	};
	// Move down one row ( stay at current column )
	ScreenPage.prototype.LineFeed = function () {
		this.posCursor += this.cols;
	};
	ScreenPage.prototype.Hide = function () {
		this.divPage.style.display = "none";
	};
	ScreenPage.prototype.Show = function () {
		this.divPage.style.display = "block";
	};
	// Write a character ( given as a 1-char text string, not as ASCII number ) to the page @ cursor
	ScreenPage.prototype.WriteCharAtCursor = function ( charASCII ) {
		/* ==== Malloc ==== */
		var bytAttribute;
		var wordChar;
		/* ==== /Malloc ==== */
		
		// Carriage-return
		if ( charASCII == 0x0D ) {
			this.CarriageReturn();
			return false;
		// Line-feed
		} else if ( charASCII == 0x0A ) {
			this.LineFeed();
			return false;
		// Other ASCII character
		} else {
			// NB: it would be nice ( possibly quicker ) to be able to use .innerText instead of .innerHTML,
			//	as we are never going to pass any HTML here so that should skip starting up IE's HTML
			//	parser, however when a space is passed it ends up as an accented "a" so this is a solution.
			//	Also, .textContent should be used in other browsers for the same reason, but a double-
			//	assignment here would be slower as innerHTML IS parsed by all modern browsers.
			//this.arr_char[this.rowCursor][this.colCursor].innerHTML = textChar;
			//this.arr_char[this.posCursor].innerHTML = textChar;
			
			// Attribute byte; format ( for bits, from 7 -> 0 ):
			//	7		=> normal (0) | blink(1)
			//	6, 5, 4	=> 3-bit background colour
			//	3		=> Brightness - normal (0) | bright(1)
			//	2, 1, 0	=> 3-bit foreground colour
			bytAttribute = parseInt("00000111", 2);
			wordChar = charASCII | (bytAttribute << 8);
			
			jsEmu.DRAM.WriteBytes(this.offsetBytes + this.posCursor * 2, wordChar, 2);
			return true;
		}
	};
	// Advance the cursor, scrolling screen as necessary ( may be negative )
	ScreenPage.prototype.AdvanceCursor = function ( num_chars ) {
		// TODO: handle end of page
		this.posCursor += num_chars;
		// TODO: scroll screen if goes off bottom
	};
	
	/* ==== Exports ==== */
	jsEmu.ScreenPage = ScreenPage;
	/* ==== /Exports ==== */
});

// Add Module to emulator
jsEmu.AddModule(mod);