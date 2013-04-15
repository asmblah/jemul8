/*
 * jemul8 - JavaScript x86 Emulator
 *
 * MODULE: Guest->Host interface class support
 *
 * ====
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*jslint bitwise: true, plusplus: true */
/*global define, require */

define([
	"../../util",
	"../iodev"
], function (
	util,
	IODevice
) {
    "use strict";

	/* ====== Private ====== */

	/* ==== Const ==== */

	/* ==== /Const ==== */

	// Constructor / pre-init
	function Guest2Host(machine) {
		util.assert(this && (this instanceof Guest2Host), "Guest2Host ctor ::"
			+ " error - constructor not called properly");

		util.info("Guest2Host PreInit");

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
	util.inherit(Guest2Host, IODevice, "Guest2Host"); // Inheritance
	Guest2Host.prototype.init = function (done, fail) {
		var state = this.state;

		// I/O port addresses used
		this.registerIO_Read(0x0402, "INFO_PORT", readHandler, 1);
		this.registerIO_Read(0x0403, "DEBUG_PORT", readHandler, 1);
		//this.registerIO_Read(0x0080, "PORT_DIAG", readHandler, 1);
		this.registerIO_Write(0x0402, "INFO_PORT", writeHandler, 1);
		this.registerIO_Write(0x0403, "DEBUG_PORT", writeHandler, 1);
		//this.registerIO_Write(0x0080, "PORT_DIAG", writeHandler, 1);

		done();
	};
	Guest2Host.prototype.reset = function (type) {
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
	function readHandler(device, addr, io_len) {
		var state = device.state; // "device" will be Guest2Host

		util.info("Guest2Host readHandler() :: Read from address: "
			+ util.format("hex", addr));

		switch (addr) {
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
			util.panic("Guest2Host readHandler() :: Unsupported read, address="
				+ util.format("hex", addr) + "!");
			return 0;
		}
	}
	// Guest2Host interface's I/O write operations' handler routine
	function writeHandler(device, addr, val, io_len) {
		var state = device.state // "device" will be Guest2Host
			, idx, text;

		//util.info("Guest2Host writeHandler() :: Write to address: "
		//	+ util.format("hex", addr) + " = " + util.format("hex", val));

		switch (addr) {
		case 0x0402: // INFO_PORT
			if (val !== 0x0A/* && val !== "$".charCodeAt(0)*/) {
				state.bufferInfo.buffer[ state.bufferInfo.pos++ ] = val;
			} else {
				text = "";
				for (idx = 0 ; idx < state.bufferInfo.pos ; ++idx) {
					text += String.fromCharCode(
						state.bufferInfo.buffer[ idx ]);
				}
				state.bufferInfo.pos = 0;
				util.info("INFO_PORT: " + text);
				//alert("INFO_PORT: " + text);
			}
			break;
		case 0x0403: // DEBUG_PORT
			if (val !== 0x0A/* && val !== "$".charCodeAt(0)*/) {
				state.bufferDebug.buffer[ state.bufferDebug.pos++ ] = val;
			} else {
				text = "";
				for (idx = 0 ; idx < state.bufferDebug.pos ; ++idx) {
					text += String.fromCharCode(
						state.bufferDebug.buffer[ idx ]);
				}
				state.bufferDebug.pos = 0;
				util.info("DEBUG_PORT: " + text);
				//alert("DEBUG_PORT: " + text);
			}
			break;
		case 0x0080: // PORT_DIAG
			// Ignore for now...
			break;
		default:
			util.panic("Guest2Host writeHandler() :: Unsupported write, address="
				+ util.format("hex", addr) + "!");
			return 0;
		}
	}
	/* ====== /Private ====== */

	// Exports
	return Guest2Host;
});
