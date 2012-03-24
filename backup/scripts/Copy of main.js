/*
 *	jsGL - JavaScript Graphics Layer, based on the specification for the OpenGL® API
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: jsEmu ( x86) Main
 */

// Scope encapsulator
new function () {
	/* ==== Malloc ==== */
	var xmlhttp = window.XMLHttpRequest ? new window.XMLHttpRequest() : null;
	// System RAM
	var memData = "";
	
	var CPU = {
			// Write to memory
			mem_write: function ( addr, val, size ) {
				/* ==== Guards ==== */
				Assert((val / 0xFF) >> 0 <= size, "mem_write :: Value is greater in bytes than size");
				/* ==== /Guards ==== */
				
				// Use size of operand to determine how many bytes to write
				switch ( size ) {
				case 1:	// Byte ( 8-bit )
					memData[addr	] = val;
				case 2:	// Word ( 16-bit )
					memData[addr	] = val & 0x00FF;
					memData[addr + 1] = val & 0xFF00;
				case 4:	// Dword ( 32-bit )
					memData[addr	] = val & 0x000000FF;
					memData[addr + 1] = val & 0x0000FF00;
					memData[addr + 2] = val & 0x00FF0000;
					memData[addr + 3] = val & 0xFF000000;
				default:
					throw new Error("Operand size > 32-bit not supported");
				}
			// Read from memory
			}, mem_read: function ( addr, size ) {
				// Use size of operand to determine how many bytes to read
				switch ( size ) {
				case 1:	// Byte ( 8-bit )
					return memData[addr];
				case 2:	// Word ( 16-bit )
					return (memData[addr + 1] << 8) | (memData[addr]);
				case 4:	// Dword ( 32-bit )
					return (memData[addr + 3] << 24) | (memData[addr + 2] << 16) | (memData[addr + 1] << 8) | (memData[addr]);
				default:
					throw new Error("Operand size > 32-bit not supported");
				}
			}, eax: 0	// Accumulator
			, ebx: 0	// Base
			, ecx: 0	// Counter
			, edx: 0	// Data
			
			, sp: 0		// Stack pointer
			, bp: 0		// Base pointer
			
			, si: 0		// Source index
			, di: 0		// Dest. index
			, get ax() {
				// Mask out high word, leaving only AX
				return this.eax & 0x0000FFFF;
			}, set ax( val ) {
				// Wrap round if negative
				if ( val < 0 ) val += 0xFFFF + 1;
				this.eax
						// Mask out current AX val ( low word )
						= (this.eax	& 0xFFFF0000)
						// Restrict AX to low word
						| (val		& 0x0000FFFF);
			}, get al() {
				// Mask, leaving only AL
				return this.eax & 0x000000FF;
			}, set al( val ) {
				// Wrap round if negative
				if ( val < 0 ) val += 0xFF + 1;
				this.eax
						// Mask out current AL val
						= (this.eax	& 0xFFFFFF00)
						// Restrict AL to low byte
						| (val		& 0x000000FF);
			}, get ah() {
				// Mask, leaving only AH
				return this.eax & 0x0000FF00;
			}, set ah( val ) {
				// Wrap round if negative
				if ( val < 0 ) val += 0xFF + 1;
				this.eax
						// Mask out current AH val
						= (this.eax	& 0xFFFF00FF)
						// Restrict AH to high byte
						| (val		& 0x0000FF00);
			}
			
			, 
			
			// Push a value onto the stack ( as defined by ss, esi )
			, push: function ( val ) {
				
			// Pop a value off the stack ( as defined by ss, esi )
			}, pop: function ( val ) {
				
			}
			
			// Generate a software interrupt
			, Interrupt: function ( idx ) {
				
			// Near return to calling procedure
			//	( optionally include no. of bytes to release )
			}, Return_near: function ( numBytesToRelease ) {
				// Far return pops only IP
				this.eip = this.Pop();
			// Far return to calling procedure
			//	( optionally include no. of bytes to release )
			}, Return_far: function ( numBytesToRelease ) {
				// Far return pops IP followed by CS
				this.eip = this.Pop();
				this.cs = this.Pop();
			}
		};
	/* ==== /Malloc ==== */
	
	// Load sequence
	window.onload = function () {
		/* ==== Malloc ==== */
		var jsTraced;
		/* ==== /Malloc ==== */
		
		// Perform trace...
		
		/* ===== Load traced JavaScript for fast native exec ===== */
		jsTraced
				= "AH.Set(0x09);"
				+ "DX.Set(0x0108);"
				+ "Interrupt(0x21);"
				+ "Return_near();"
			;
		/* ===== /Load traced JavaScript for fast native exec ===== */
		
		// Boot!
		Exec(jsTraced);
	};
	
	CPU.EAX = new Register();
	CPU.AX = new SubRegister(CPU.EAX, 0xFFFF, 0x0000FFFF);
	CPU.AH = new SubRegister(CPU.EAX, 0xFF, 0x0000FF00);
	CPU.AL = new SubRegister(CPU.EAX, 0xFF, 0x000000FF);
	
	CPU.EBX = new Register();
	CPU.BX = new SubRegister(CPU.EAX, 0xFFFF, 0x0000FFFF);
	CPU.BH = new SubRegister(CPU.EAX, 0xFF, 0x0000FF00);
	CPU.BL = new SubRegister(CPU.EAX, 0xFF, 0x000000FF);
	
	CPU.ECX = new Register();
	CPU.CX = new SubRegister(CPU.EAX, 0xFFFF, 0x0000FFFF);
	CPU.CH = new SubRegister(CPU.EAX, 0xFF, 0x0000FF00);
	CPU.CL = new SubRegister(CPU.EAX, 0xFF, 0x000000FF);
	
	CPU.EDX = new Register();
	CPU.DX = new SubRegister(CPU.EAX, 0xFFFF, 0x0000FFFF);
	CPU.DH = new SubRegister(CPU.EAX, 0xFF, 0x0000FF00);
	CPU.DL = new SubRegister(CPU.EAX, 0xFF, 0x000000FF);
	
	// CPU Register ( eg. EAX, EBX ) class constructor
	function Register() {
		/* ==== Guards ==== */
		Assert(this != self, "Register constructor :: not called as constructor.");
		/* ==== /Guards ==== */
		
		this.value = 0;
	}
	Register.prototype.Get = function () {
		return this.value;
	};
	Register.prototype.Set = function ( val ) {
		this.value = val;
	};
	// CPU Sub-register ( eg AX, AL, AH ) class constructor
	function SubRegister( regMaster, bitmaskSize, bitmaskOccupies ) {
		/* ==== Guards ==== */
		Assert(this != self, "SubRegister constructor :: not called as constructor.");
		Assert(!regMaster || !(regMaster instanceof Register), "SubRegister constructor :: no valid master register specified.");
		/* ==== /Guards ==== */
		
		this.Get = SubRegister_CreateGetter(regMaster, bitmaskSize, bitmaskOccupies);
		this.Set = SubRegister_CreateSetter(regMaster, bitmaskSize, bitmaskOccupies);
	}
	
	function SubRegister_CreateGetter( regMaster, bitmaskSize, bitmaskOccupies ) {
		return function () {
			// Mask, leaving only subvalue
			return this.eax & bitmaskOccupies;
		};
	}
	function SubRegister_CreateSetter( regMaster, bitmaskSize, bitmaskOccupies ) {
		/* ==== Malloc ==== */
		// Amount to add to wrap negative number around
		var valNegativeWrap = bitmaskSize + 1;
		// Bitmask for extracting only the part of the value not occupied by this subregister
		var bitmaskNotOccupies = 0xFFFFFFFF - bitmaskOccupies;
		/* ==== /Malloc ==== */
		
		return function ( val ) {
			// Wrap round if negative
			if ( val < 0 ) val += valNegativeWrap;
			regMaster.Set(
					// Mask out current AX val ( low word )
					(regMaster.Get() & bitmaskNotOccupies)
					// Restrict AX to low word
					| (val & bitmaskOccupies)
				);
		};
	}
	
	function Exec( js ) {
		// Run it, using CPU object as context
		//	to expose register variables etc.
		with ( CPU ) {
			
			eval(js);
		}
	}
	
	// Synchronously download a file over HTTP
	function GetSyncHTTP( path ) {
		xmlhttp.open("GET", path, false);
		xmlhttp.send("");
		return xmlhttp.responseText;
	}
	
	// Debugging helpers
	function Assert( test, textMsg ) {
		if ( !test ) {
			throw textMsg;
		}
	}
}