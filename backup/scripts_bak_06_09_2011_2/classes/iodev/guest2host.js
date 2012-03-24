/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: Guest->Host interface class support
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("iodev/guest2host", function ( $ ) { "use strict";
	var jemul8 = this.data("jemul8");
	
	/* ====== Private ====== */
	
	/* ==== Const ==== */
	
	/* ==== /Const ==== */
	
	// Constructor / pre-init
	function Guest2Host( machine ) {
		jemul8.assert(this && (this instanceof Guest2Host), "Guest2Host ctor ::"
			+ " error - constructor not called properly");
		
		jemul8.info("Guest2Host PreInit");
		
		this.machine = machine;
		
		this.state = {
			bufferInfo: {
				buffer: new Array()
				, pos: 0
			}, bufferDebug: {
				buffer: new Array()
				, pos: 0
			}
		};
	}
	$.inherit(Guest2Host, jemul8.IODevice, "Guest2Host"); // Inheritance
	Guest2Host.prototype.init = function () {
		var state = this.state;
		
		// I/O port addresses used
		this.registerIO_Read(0x0402, "INFO_PORT", readHandler, 1);
		this.registerIO_Read(0x0403, "DEBUG_PORT", readHandler, 1);
		this.registerIO_Read(0x0080, "PORT_DIAG", readHandler, 1);
		this.registerIO_Write(0x0402, "INFO_PORT", writeHandler, 1);
		this.registerIO_Write(0x0403, "DEBUG_PORT", writeHandler, 1);
		this.registerIO_Write(0x0080, "PORT_DIAG", writeHandler, 1);
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
	function readHandler( device, addr, io_len ) {
		var state = device.state; // "device" will be Guest2Host
		
		jemul8.info("Guest2Host readHandler() :: Read from address: "
			+ $.format("hex", addr));
		
		switch ( addr ) {
		case 0x0402: // INFO_PORT
			// ??
			break;
		case 0x0403: // DEBUG_PORT
			// ??
			break;
		case 0x0080: // PORT_DIAG
			// Ignore for now...
			break;
		default:
			jemul8.panic("Guest2Host readHandler() :: Unsupported read, address="
				+ $.format("hex", addr) + "!");
			return 0;
		}
	}
	// Guest2Host interface's I/O write operations' handler routine
	function writeHandler( device, addr, val, io_len ) {
		var state = device.state // "device" will be Guest2Host
			, idx, text;
		
		//jemul8.info("Guest2Host writeHandler() :: Write to address: "
		//	+ $.format("hex", addr) + " = " + $.format("hex", val));
		
		switch ( addr ) {
		case 0x0402: // INFO_PORT
			if ( val !== 0x0A/* && val !== "$".charCodeAt(0)*/ ) {
				state.bufferInfo.buffer[ state.bufferInfo.pos++ ] = val;
			} else {
				text = "";
				for ( idx = 0 ; idx < state.bufferInfo.pos ; ++idx ) {
					text += String.fromCharCode(
						state.bufferInfo.buffer[ idx ]);
				}
				state.bufferInfo.pos = 0;
				//alert("INFO_PORT: " + text);
			}
			break;
		case 0x0403: // DEBUG_PORT
			if ( val !== 0x0A/* && val !== "$".charCodeAt(0)*/ ) {
				state.bufferDebug.buffer[ state.bufferDebug.pos++ ] = val;
			} else {
				text = "";
				for ( idx = 0 ; idx < state.bufferDebug.pos ; ++idx ) {
					text += String.fromCharCode(
						state.bufferDebug.buffer[ idx ]);
				}
				state.bufferDebug.pos = 0;
				alert("DEBUG_PORT: " + text);
			}
			break;
		case 0x0080: // PORT_DIAG
			// Ignore for now...
			break;
		default:
			jemul8.panic("Guest2Host writeHandler() :: Unsupported write, address="
				+ $.format("hex", addr) + "!");
			return 0;
		}
	}
	/* ====== /Private ====== */
	
	// Exports
	jemul8.Guest2Host = Guest2Host;
});
