/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: 8042 Keyboard & controller class support
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("iodev/keyboard", function ( $ ) { "use strict";
	var x86Emu = this.data("x86Emu");
	
	/* ====== Private ====== */
	
	/* ==== Const ==== */
	// Constants as in Bochs' /iodev/keyboard.h (prefix with "BX_")
	var KBD_ELEMENTS = 16, KBD_CONTROLLER_QSIZE = 5
		, MOUSE_BUFF_SIZE = 48
		, MOUSE_MODE_RESET = 10, MOUSE_MODE_STREAM = 11
		, MOUSE_MODE_REMOTE = 12, MOUSE_MODE_WRAP = 13;
	/* ==== /Const ==== */
	
	// Constructor / pre-init
	function Keyboard( machine ) {
		$.assert(this && (this instanceof Keyboard)
			, "Keyboard ctor ::"
			+ " error - constructor not called properly");
		
		var idx, state;
		var core;
		
		$.info("Keyboard controller (Intel 8042) PreInit");
		
		this.machine = machine;
		
		this.state = {
			// Status bits matching the status port
			parityError: 0		// Bit7, 1= parity error from keyboard/mouse - ignored.
			, timeout: 0		// Bit6, 1= timeout from keyboard - ignored.
			, auxb: 0			// Bit5, 1= mouse data waiting for CPU to read.
			, keylock: 0		// Bit4, 1= keyswitch in lock position - ignored.
			, commandOrData: 0	// Bit3, 1=command to port 64h, 0=data to port 60h
			, sysf: 0			// Bit2,
			, inpb: 0			// Bit1,
			, outb: 0			// Bit0, 1= keyboard data or mouse data ready for CPU
								//	check aux to see which. Or just keyboard
								//	data before AT style machines
			
			// Internal to our version of the keyboard controller
			, kbd_clock_enabled: false
			, aux_clock_enabled: false
			, allow_irq1: false
			, allow_irq12: false
			, kbd_output_buffer: new x86Emu.Register( "KBD_OUT", 1 )
			, aux_output_buffer: new x86Emu.Register( "AUX_OUT", 1 )
			, /* byte */last_comm: 0
			, expecting_port60h: false
			, expecting_mouse_parameter: new x86Emu.Register( "EXP_MOUSE_PARAM", 1 )
			, last_mouse_command: new x86Emu.Register( "LAST_MOUSE_CMD", 1 )
			, timer_pending: new x86Emu.Register( "TMR_PENDING", 4 )
			, irq1_requested: false
			, irq12_requested: false
			, scancodes_translate: false
			, expecting_scancodes_set: false
			, current_scancodes_set: new x86Emu.Register( "CUR_SCAN_SET", 4 )
			, bat_in_progress: false
		};
		this.bufInternal = {
			num_elements: 0
			, buffer: new Array( KBD_ELEMENTS )
			, head: 0
			, expecting_typematic: false
			, expecting_led_write: false
			, delay: new x86Emu.Register( "DELAY", 1 )
			, repeat_rate: new x86Emu.Register( "REPEAT_RATE", 1 )
			, led_status: new x86Emu.Register( "LED_STATUS", 1 )
			, scanning_enabled: false
		};
		
		this.mouse = new Mouse( this );
		
		this.inited = false;
	}
	// Methods based on Bochs /iodev/keyboard.h & keyboard.cc
	Keyboard.prototype = new x86Emu.IODevice( "Keyboard", Keyboard ); // Inheritance
	Keyboard.prototype.init = function () {
		var machine = this.machine, state
			, addr;
		
		// I/O port addresses used
		this.registerIO_Read(0x0060, "8042 Keyboard controller", readHandler, 1);
		this.registerIO_Read(0x0064, "8042 Keyboard controller", readHandler, 1);
		this.registerIO_Write(0x0060, "8042 Keyboard controller", writeHandler, 1);
		this.registerIO_Write(0x0064, "8042 Keyboard controller", writeHandler, 1);
		
		// Make a note that IRQ #1 & #12 are used by the Keyboard & aux (eg. mouse)
		this.registerIRQ(1, "8042 Keyboard controller");
		this.registerIRQ(12, "8042 Keyboard controller (PS/2 mouse)");
		
		this.timerHandle = machine.registerTimer(handleTimer, this
			, 10, true, true, "8042 Keyboard controller");
		
		this.resetInternals(1);
		
		this.bufInternal.led_status.set(0);
		this.bufInternal.scanning_enabled = true;
		
		this.mouse.init();
		
		state = this.state;
		state.parityError = 0;
		state.timeout = 0;
		state.auxb = 0;
		state.keylock = 1;
		state.commandOrData = 1;
		state.sysf = 0;
		state.inpb = 0;
		state.outb = 0;
		
		state.kbd_clock_enabled = true;
		state.aux_clock_enabled = 0;
		state.allow_irq1 = 1;
		state.allow_irq12 = 1;
		state.kbd_output_buffer = 0;
		state.aux_output_buffer = 0;
		state.last_comm = 0;
		state.expecting_port60h = false;
		state.irq1_requested = false;
		state.irq12_requested = false;
		state.expecting_mouse_parameter = 0;
		state.bat_in_progress = 0;
		state.scancodes_translate = 1;
		
		state.timer_pending = 0;
		
		for ( idx = 0 ; idx < KBD_CONTROLLER_QSIZE ; ++idx ) {
			state.queue[ idx ] = 0;
		}
		state.sizeQueue = 0;
		state.sourceQueue = 0;
		
		// Clear paste buffer
		// (todo)
		
		// Install mouse port on system board
		machine.cmos.installEquipment(0x04);
		
		// Add keyboard LEDs to the status bar
		// (todo)
		
		
	};
	Keyboard.prototype.reset = function ( type ) {
		// ...
	};
	Keyboard.prototype.resetInternals = function ( isPowerUp ) {
		// ...
	};
	
	
	Keyboard.prototype.registerState = function () {
		// ?
	};
	Keyboard.prototype.afterRestoreState = function () {
		// ?
	};
	
	// For turning the keyboard clock on or off
	Keyboard.prototype.setClockEnabled = function ( val ) {
		var state = this.state, old_enabled;
		
		if ( !value ) {
			state.kbd_clock_enabled = false;
		} else {
			// Is another byte waiting to be sent from the keyboard?
			old_enabled = state.kbd_clock_enabled;
			state.kbd_clock_enabled = true;
			
			// Enable timer if switching from disabled -> enabled
			if ( !old_enabled && state.outb === 0 ) {
				activate_timer();
			}
		}
	};
	Keyboard.prototype.enqueue = function ( data ) {
		var state = this.state;
		
		$.debug("Keyboard (cntrlr) .enqueue() ::"
			+ " enqueue(" + $.format("hex", data) + ")");
		
		// See if we need to queue this byte from the controller
		if ( state.outb ) {
			if ( state.sizeQueue >= KBD_CONTROLLER_QSIZE ) {
				$.panic("Keyboard (cntrlr) .enqueue() ::"
					+ " enqueue(" + $.format("hex", data)
					+ "): state.queue full!");
			}
			state.queue[ state.sizeQueue++ ] = data;
			state.sourceQueue = source;
			return;
		}
		
		/** The queue is empty **/
		
		state.kbd_output_buffer = data;
		state.outb = 1;
		state.auxb = 0;
		state.inpb = 0;
		if ( state.allow_irq1 ) {
			state.irq1_requested = true;
		}
	};
	
	function Mouse( cntrlr ) {
		this.cntrlr = cntrlr;
		
		this.bufInternal = {
			num_elements: 0
			, buffer: new Array( MOUSE_BUFF_SIZE )
			, head: 0
		};
	}
	Mouse.prototype.init = function () {
		var state
			, idx, list, len;
		
		this.bufInternal.num_elements = 0;
		for ( idx = 0 ; idx < MOUSE_BUFF_SIZE ; ++idx ) {
			this.bufInternal.buffer[ idx ] = 0;
		}
		this.bufInternal.head = 0;
		
		state = this.state;
		state.type = 0;				// ???
		state.sample_rate = 100;	// Reports per second
		state.resolution_cpmm = 4;	// 4 counts per millimeter
		state.scaling = 1;			// 1:1 (default)
		state.mode = MOUSE_MODE_RESET;
		state.enable = 0;
		state.delayed_dx = 0;
		state.delayed_dy = 0;
		state.delayed_dz = 0;
		state.im_request = 0;		// Wheel mouse mode request
		state.im_mode = 0;			// Wheel mouse mode
	};
	// For turning the keyboard clock on or off
	Mouse.prototype.setClockEnabled = function ( val ) {
		var state = this.state, old_enabled;
		
		if ( !value ) {
			state.aux_clock_enabled = false;
		} else {
			// Is another byte waiting to be sent from the keyboard?
			old_enabled = state.aux_clock_enabled;
			state.aux_clock_enabled = true;
			
			// Enable timer if switching from disabled -> enabled
			if ( !old_enabled && state.outb === 0 ) {
				activate_timer();
			}
		}
	};
	Mouse.prototype.enqueue = function ( data ) {
		var state = this.state;
		
		$.debug("Keyboard (aux mouse) .enqueue() ::"
			+ " enqueue(" + $.format("hex", data) + ")");
		
		// See if we need to queue this byte from the controller
		//	(even for mouse bytes)
		if ( state.outb ) {
			if ( state.sizeQueue >= KBD_CONTROLLER_QSIZE ) {
				$.panic("Keyboard (aux mouse) .enqueue() ::"
					+ " enqueue(" + $.format("hex", data)
					+ "): state.queue full!");
			}
			state.queue[ state.sizeQueue++ ] = data;
			state.sourceQueue = 1;
			return;
		}
		
		/** The queue is empty **/
		
		state.aux_output_buffer = data;
		state.outb = 1;
		state.auxb = 1;
		state.inpb = 0;
		if ( state.allow_irq12 ) {
			state.irq12_requested = true;
		}
	};
	
	// Keyboard controller's I/O read operations' handler routine
	function readHandler( device, addr, len ) {
		// "device" will be Keyboard
		var machine = device.machine, state = device.state
			, idx
			, result8; // 8-bit result
		
		$.info("Keyboard readHandler() :: Read addr = "
			+ $.format("hex", addr));
		
		/** NB: This is an 8042 Keyboard controller **/
		
		switch ( addr ) {
		case 0x60: // Output buffer
			// Mouse byte available
			if ( state.auxb ) {
				result8 = state.aux_output_buffer.get();
				state.aux_output_buffer.set(0x00);
				state.outb = 0;
				state.auxb = 0;
				state.irq12_requested = false;
				
				if ( state.sizeQueue ) {
					state.aux_output_buffer.set(state.queue[ 0 ]);
					state.outb = 1;
					state.auxb = 1;
					if ( state.allow_irq12 ) {
						state.irq12_requested = true;
					}
					// Move queue elements towards queue head by 1
					for ( idx = 0 ; idx < state.sizeQueue - 1 ; ++idx ) {
						state.queue[ idx ] = state.queue[ idx + 1 ];
					}
					--state.sizeQueue;
				}
				
				machine.pic.lowerIRQ(12);
				activate_timer();
				$.debug("Keyboard (mouse aux) readHandler() ::"
					+ " Read from " + $.format("hex", addr)
					+ " returns " + $.format("hex", result8));
				return result8;
			// Keyboard byte available
			} else if ( state.outb ) {
				result8 = state.kbd_output_buffer.get();
				/** NB: Why is kbd_output_buffer not cleared??? **/
				state.outb = 0;
				state.auxb = 0;
				state.irq1_requested = false;
				state.bat_in_progress = 0;
				
				if ( state.sizeQueue ) {
					state.aux_output_buffer.set(state.queue[ 0 ]);
					state.outb = 1;
					state.auxb = 1;
					if ( state.allow_irq1 ) {
						state.irq1_requested = true;
					}
					// Move queue elements towards queue head by 1
					for ( idx = 0 ; idx < state.sizeQueue - 1 ; ++idx ) {
						state.queue[ idx ] = state.queue[ idx + 1 ];
					}
					$.debug("Keyboard (ctrlr) readHandler() ::"
						+ " state.sizeQueue = " + state.sizeQueue);
					--state.sizeQueue;
				}
				
				machine.pic.lowerIRQ(1);
				activate_timer();
				$.debug("Keyboard (ctrlr) readHandler() ::"
					+ " Read from " + $.format("hex", addr)
					+ " returns " + $.format("hex", result8));
				return result8;
			}
			$.debug("num_elements = %d", device.bufInternal.num_elements);
			$.debug("Keyboard readHandler() ::"
				+ " Read from " + $.format("hex", addr)
				+ " with .outb empty");
			return state.kbd_output_buffer;
			
			//return 0x00;
			//return 0x55; // Pass keyboard self-test
		case 0x64: // Status register
			// Build the status register's value from all its bit values
			result8 = (state.parityError << 7)
				| (state.timeout  << 6)
				| (state.auxb << 5)
				| (state.keylock << 4)
				| (state.commandOrData << 3)
				| (state.sysf << 2)
				| (state.inpb << 1)
				| state.outb;
			state.timeout = 0;
			return result8;
			
			//return 0x00;
			//return 0x01; // Pass keyboard self-test
		default:
			$.problem("Keyboard readHandler() :: Unsupported read, address="
				+ $.format("hex", addr) + "!");
			return 0;
		}
	}
	// Keyboard controller's I/O write operations' handler routine
	function writeHandler( device, addr, val, len ) {
		// "device" will be Keyboard
		var machine = device.machine, state = device.state
			, idx
			, scan_convert, disable_keyboard, disable_aux;
		
		$.info("Keyboard writeHandler() :: 8-bit write to address: "
			+ $.format("hex", addr) + " = " + $.format("hex", val));
		
		/** NB: This is a 8042 Keyboard controller **/
		
		switch ( addr ) {
		case 0x60: // Input buffer
			// Expecting data byte from command last sent to port 64h
			if ( state.expecting_port60h ) {
				state.expecting_port60h = false;
				state.commandOrData = 0; // Data byte written last to 0x60
				if ( state.inpb ) {
					$.problem("Keyboard writeHandler() :: Write to port 60h"
						+ " - not ready for write");
				}
				
				switch ( state.last_comm ) {
				case 0x60: // Write command byte
					scan_convert = (val >> 6) & 0x01;
					disable_aux = (val >> 5) & 0x01;
					disable_keyboard = (val >> 4) & 0x01;
					state.sysf = (val >> 2) & 0x01;
					state.allow_irq1 = (val >> 0) & 0x01;
					state.allow_irq12 = (val >> 1) & 0x01;
					device.setClockEnabled(!disable_keyboard);
					device.mouse.setClockEnabled(!disable_aux);
					if ( state.allow_irq12 && state.auxb ) {
						state.irq12_requested = true;
					} else if ( state.allow_irq1 && state.outb ) {
						state.irq1_requested = true;
					}
					$.debug("Keyboard writeHandler() :: allow_irq12 set to "
						+ state.allow_irq12);
					
					if ( !scan_convert ) {
						$.info("Keyboard writeHandler() ::"
							+ " Scan-convert turned off");
					}
					
					// [Bochs] (mch) NT needs this
					state.scancodes_translate = scan_convert;
					break;
				case 0xCB: // Write keyboard controller mode
					$.debug("Keyboard writeHandler() ::"
						+ " Write keyboard controller mode with value "
						, $.format("hex", val));
					break;
				case 0xD1: // Write output port
					$.debug("Keyboard writeHandler() ::"
						+ " Write output port with value "
						, $.format("hex", val));
					$.debug("Keyboard writeHandler() ::"
						+ " Write output port: "
						+ ((val & 0x02) ? "en" : "dis") + "able A20");
					machine.setEnableA20((val & 0x02) != 0);
					if ( !(val & 0x01) ) {
						$.info("Keyboard writeHandler() ::"
							+ " Write output port: Processor reset requested!");
						machine.reset(machine.RESET_SOFTWARE);
					}
					break;
				case 0xD4: // Write to mouse
					// I don't think this enables the AUX clock
					//device.mouse.setClockEnabled(true); // enable aux clock line
					kbd_ctrl_to_mouse(val);
					// ??? should I reset to previous value of aux enable?
					break;
				case 0xD3: // Write mouse output buffer
					// Queue in mouse output buffer
					device.mouse.enqueue(val);
					break;
				case 0xD2:
					// Queue in keyboard output buffer
					device.enqueue(val);
					break;
				default:
					$.panic("Keyboard writeHandler() ::"
						+ " Unsupported write to port 60h"
						+ "(lastcomm=" + $.format("hex", state.last_comm)
						+ ": " + $.format("hex", val));
				}
			} else {
				// Data byte written last to 0x60
				state.commandOrData = 0;
				state.expecting_port60h = false;
				// Pass byte to keyboard
				// [Bochs] ??? should conditionally pass
				//	to mouse device here ???
				if ( state.kbd_clock_enabled === false ) {
					device.setClockEnabled(true);
				}
				kbd_ctrl_to_kbd(val);
			}
			break;
		case 0x64: // Control register
			// Command byte written last to 0x64
			state.commandOrData = 1;
			state.last_comm = val;
			// Most commands NOT expecting port60 write next
			state.expecting_port60h = false;
			
			switch ( val ) {
			case 0x20: // Get keyboard command byte
				$.debug("Keyboard writeHandler() ::"
					+ " Get keyboard command byte");
				// Controller output buffer must be empty
				if ( state.outb ) {
					$.problem("Keyboard writeHandler() ::"
						+ " OUTB set and command "
						+ $.format("hex", val) + " encountered");
					break;
				}
				// Build command byte & enqueue
				device.enqueue(
					(state.scancodes_translate << 6)
					| ((!state.aux_clock_enabled) << 5)
					| ((!state.kbd_clock_enabled) << 4)
					| (0 << 3)
					| (state.sysf << 2)
					| (state.allow_irq12 << 1)
					| (state.allow_irq1 << 0)
				);
				break;
			case 0x60: // Write command byte
				$.debug("Keyboard writeHandler() ::"
						+ " Write command byte");
				// following byte written to port 60h is command byte
				state.expecting_port60h = true;
				break;
			
			case 0xA0:
				$.debug("Keyboard writeHandler() ::"
					+ " Keyboard BIOS name not supported");
				break;
			
			case 0xA1:
				$.debug("Keyboard writeHandler() ::"
					+ " Keyboard BIOS version not supported"));
				break;
			
			case 0xA7: // Disable the aux device
				device.mouse.setClockEnabled(false);
				$.debug("Keyboard writeHandler() ::"
					+ " Aux device (mouse) disabled");
				break;
			case 0xA8: // Enable the aux device
				device.mouse.setClockEnabled(true);
				$.debug("Keyboard writeHandler() ::"
					+ " Aux device (mouse) enabled");
				break;
			case 0xA9: // Test Mouse Port
				// Controller output buffer must be empty
				if ( state.outb ) {
					$.problem("Keyboard writeHandler() ::"
						+ " OUTB set and command " + $.format("hex", val)
						+ " encountered");
					break;
				}
				device.enqueue(0x00); // No errors detected
				break;
			case 0xAA: // Motherboard controller self test
				$.debug("Keyboard writeHandler() ::"
					+ " Motherboard cntrlr Self Test");
				if ( !device.inited ) {
					state.sizeQueue = 0;
					state.outb = 0;
					device.inited = true;
				}
				// Controller output buffer must be empty
				if ( state.outb ) {
					$.problem("Keyboard writeHandler() ::"
						+ " OUTB set and command " + $.format("hex", val)
						+ " encountered");
					break;
				}
				// [Bochs] (mch) Why is this commented out??? Enabling
				state.sysf = 1; // Self test complete
				device.enqueue(0x55); // controller OK
				break;
			case 0xAB: // Interface Test
				// Controller output buffer must be empty
				if ( state.outb ) {
					$.problem("Keyboard writeHandler() ::"
						+ " OUTB set and command " + $.format("hex", val)
						+ " encountered");
					break;
				}
				device.enqueue(0x00);
				break;
			case 0xAD: // Disable keyboard
				device.setClockEnabled(false);
				$.debug("Keyboard writeHandler() :: Keyboard disabled");
				break;
			case 0xAE: // Enable keyboard
				device.setClockEnabled(true);
				$.debug("Keyboard writeHandler() :: Keyboard enabled");
				break;
			case 0xAF: // Get controller version
				$.info("Keyboard writeHandler() ::"
					+ " 'get controller version' not supported yet");
				break;
			case 0xC0: // Read input port
				// Controller output buffer must be empty
				if ( state.outb ) {
					$.problem("Keyboard writeHandler() ::"
						+ " OUTB set and command " + $.format("hex", val)
						+ " encountered");
					break;
				}
				// Keyboard not inhibited
				device.enqueue(0x80);
				break;
			case 0xCA: // Read keyboard controller mode
				device.enqueue(0x01); // PS/2 (MCA)interface
				break;
			case 0xCB: // Write keyboard controller mode
				$.debug("Keyboard writeHandler() ::"
					+ " Write keyboard controller mode");
				// Write keyboard controller mode to bit 0 of port 0x60
				state.expecting_port60h = true;
				break;
			case 0xD0: // Read output port: next byte read from port 60h
				$.debug("Keyboard writeHandler() ::"
					+ " I/O write to port 64h, command d0h (partial)"));
				// Controller output buffer must be empty
				if ( state.outb ) {
					$.problem("Keyboard writeHandler() ::"
						+ " OUTB set and command " + $.format("hex", val)
						+ " encountered");
					break;
				}
				device.enqueue(
					(state.irq12_requested << 5)
					| (state.irq1_requested << 4)
					| (machine.getEnableA20() << 1)
					| 0x01
				);
				break;
			
			case 0xD1: // Write output port: next byte written to port 60h
				$.debug("Keyboard writeHandler() ::"
					+ " Write output port");
				// Following byte to port 60h written to output port
				state.expecting_port60h = true;
				break;
			
			case 0xD3: // Write mouse output buffer
				// [Bochs] FIXME: Why was this a panic?
				$.debug("Keyboard writeHandler() ::"
						+ " I/O write 0x64: command = 0xD3(write mouse outb)");
				// Following byte to port 60h
				//	written to output port as mouse write
				state.expecting_port60h = true;
				break;
			
			case 0xD4: // Write to mouse
				$.debug("Keyboard writeHandler() ::"
						+ " I/O write 0x64: command = 0xD4 (write to mouse)"));
				// following byte written to port 60h
				state.expecting_port60h = true;
				break;
			
			case 0xD2: // Write keyboard output buffer
				$.debug("Keyboard writeHandler() ::"
						+ " I/O write 0x64: write keyboard output buffer");
				state.expecting_port60h = true;
				break;
			case 0xDD: // Disable A20 Address Line
				machine.setEnableA20(false);
				break;
			case 0xDF: // Enable A20 Address Line
				machine.setEnableA20(true);
				break;
			case 0xC1: // Continuous Input Port Poll, Low
			case 0xC2: // Continuous Input Port Poll, High
			case 0xE0: // Read Test Inputs
				$.panic("Keyboard writeHandler() ::"
					+ " I/O write 0x64: command = " + $.format("hex", val));
				break;
			
			case 0xFE: // System (cpu?) Reset, transition to real mode
				$.info("Keyboard writeHandler() ::"
					+ " I/O write 0x64: command 0xfe: reset cpu");
				machine.reset(machine.RESET_SOFTWARE);
				break;
			
			default:
				if ( val === 0xFF || (value >= 0xF0 && value <= 0xFD) ) {
					// Useless pulse output bit commands ???
					$.debug("Keyboard writeHandler() ::"
						+ " I/O write to port 64h, useless command "
						+ $.format("hex", val));
					return;
				}
				$.problem("Keyboard writeHandler() ::"
					+ " Unsupported io write to keyboard port 0x64"
					+ ", value = " + $.format("hex", val));
				break;
			}
			break;
		default:
			$.problem("Keyboard writeHandler() :: Unsupported read, address="
				+ $.format("hex", addr) + "!");
			return 0;
		}
	}
	
	function handleTimer( device, ticksNow ) {
		// ...
	}
	/* ====== /Private ====== */
	
	// Exports
	x86Emu.Keyboard = Keyboard;
});
