/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: Guest->Host interface class support
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("iodev/guest2host", function ( $ ) { "use strict";
	var x86Emu = this.data("x86Emu");
	
	/* ====== Private ====== */
	
	/* ==== Const ==== */
	
	/* ==== /Const ==== */
	
	// Constructor / pre-init
	function Guest2Host( machine ) {
		$.assert(this && (this instanceof Guest2Host), "Guest2Host ctor ::"
			+ " error - constructor not called properly");
		
		$.info("Guest2Host PreInit");
		
		this.machine = machine;
		
		this.state = {
			bufferInfo: {
				buffer: new Array()
				, pos: 0
			}
		};
	}
	Guest2Host.prototype = new x86Emu.IODevice( "Guest2Host", Guest2Host ); // Inheritance
	Guest2Host.prototype.init = function () {
		var state = this.state;
		
		// I/O port addresses used
		this.registerIO_Read(0x0402, "Guest2Host interface", readHandler, 1);
		this.registerIO_Read(0x0403, "Guest2Host interface", readHandler, 1);
		this.registerIO_Write(0x0402, "Guest2Host interface", writeHandler, 1);
		this.registerIO_Write(0x0403, "Guest2Host interface", writeHandler, 1);
	};
	Guest2Host.prototype.reset = function ( type ) {
		// Nothing to do
	};
	Guest2Host.prototype.registerState = function () {
		var state = this.state;
		
		// ?
	};
	Guest2Host.prototype.afterRestoreState = function () {
		var state = this.state;
		
		// ?
	};
	
	// Guest2Host interface's I/O read operations' handler routine
	function readHandler( device, addr, len ) {
		var state = device.state; // "device" will be Guest2Host
		
		$.info("Guest2Host readHandler() :: Write to address: "
			+ $.format("hex", addr) + " = " + $.format("hex", val));
		
		switch ( addr ) {
		case 0x0402: // INFO_PORT
			
			break;
		case 0x0403: // DEBUG_PORT
			
			break;
		default:
			$.panic("Guest2Host readHandler() :: Unsupported write, address="
				+ $.format("hex", addr) + "!");
			return 0;
		}
	}
	// Guest2Host interface's I/O write operations' handler routine
	function writeHandler( device, addr, val, len ) {
		var state = device.state // "device" will be Guest2Host
			, idx, text;
		
		//$.info("Guest2Host writeHandler() :: Write to address: "
		//	+ $.format("hex", addr) + " = " + $.format("hex", val));
		
		switch ( addr ) {
		case 0x0402: // INFO_PORT
			//alert(String.fromCharCode(val));
			if ( val !== 0x0A && val !== "$".charCodeAt(0) ) {
				state.bufferInfo.buffer[ state.bufferInfo.pos++ ] = val;
			} else {
				text = "";
				for ( idx = 0 ; idx < state.bufferInfo.pos ; ++idx ) {
					text += String.fromCharCode(
						state.bufferInfo.buffer[ idx ]);
				}
				state.bufferInfo.pos = 0;
				alert("INFO_PORT: " + text);
			}
			break;
		case 0x0403: // DEBUG_PORT
			
			break;
		default:
			$.panic("Guest2Host writeHandler() :: Unsupported write, address="
				+ $.format("hex", addr) + "!");
			return 0;
		}
	}
	/* ====== /Private ====== */
	
	// Exports
	x86Emu.Guest2Host = Guest2Host;
});
