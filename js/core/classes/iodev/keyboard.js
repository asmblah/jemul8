/*
 * jemul8 - JavaScript x86 Emulator
 *
 * MODULE: 8042 Keyboard & controller class support
 *
 *	References
 *		[1]: Bochs source /iodev/keyboard.h & keyboard.cc
 *		[2]: http://www.computer-engineering.org/ps2keyboard/
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
	"../iodev",
	"../register",
	"../pc",
	"./keyboard/scancode"
], function (
	util,
	IODevice,
	Register,
	PC,
	Scancode
) {
    "use strict";

	/* ====== Private ====== */

	/* ==== Const ==== */
	// Constants as in Bochs' /iodev/keyboard.h (prefix with "BX_")
	var KBD_ELEMENTS = 16, KBD_CONTROLLER_QSIZE = 5
		, MOUSE_BUFF_SIZE = 48
		, MOUSE_MODE_RESET = 10, MOUSE_MODE_STREAM = 11
		, MOUSE_MODE_REMOTE = 12, MOUSE_MODE_WRAP = 13;
	/* ==== /Const ==== */

	// Constructor / pre-init
	function KeyboardCntrlr(machine) {
		util.assert(this && (this instanceof KeyboardCntrlr)
			, "KeyboardCntrlr ctor ::"
			+ " error - constructor not called properly");

		var idx, state;
		var core;

		util.info("KeyboardCntrlr (Intel 8042) PreInit");

		this.machine = machine;

		this.timerHandle = null;

		this.keyboard = new Keyboard(this);
		this.mouse = new Mouse(this);

		this.inited = false;
	}
	// Methods based on Bochs /iodev/keyboard.h & keyboard.cc
	util.inherit(KeyboardCntrlr, IODevice, "KeyboardCntrlr"); // Inheritance
	KeyboardCntrlr.prototype.init = function (done, fail) {
		var machine = this.machine, state
			, keyboard = this.keyboard, mouse = this.mouse;

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

		this.resetInternals(true);

		keyboard.init();
		mouse.init();

		// Clear paste buffer
		// (todo)

		// Install mouse port on system board
		machine.cmos.installEquipment(0x04);

		// Add keyboard LEDs to the status bar
		// (todo)

		done();
	};
	KeyboardCntrlr.prototype.reset = function (type) {
		// ...
	};
	// Flush internal buffer and reset keyboard settings to power-up condition
	// Based on [bx_keyb_c::resetinternals]
	KeyboardCntrlr.prototype.resetInternals = function (isPowerUp) {
		var keyboard = this.keyboard
			, idx;

		keyboard.bufInternal.num_elements = 0;
		for (idx = 0 ; idx < KBD_ELEMENTS ; ++idx) {
			keyboard.bufInternal.buffer[ idx ] = 0;
		}
		keyboard.bufInternal.head = 0;

		keyboard.bufInternal.expecting_typematic = false;

		// Default scancode set is mf2 (translation is controlled by the 8042)
		keyboard.state.expecting_scancodes_set = false;
		keyboard.state.current_scancodes_set = 1;

		if (isPowerUp) {
			keyboard.bufInternal.expecting_led_write = 0;
			keyboard.bufInternal.delay = 1; // 500 mS
			keyboard.bufInternal.repeat_rate = 0x0b; // 10.9 chars/sec
		}
	};


	KeyboardCntrlr.prototype.registerState = function () {
		// ?
	};
	KeyboardCntrlr.prototype.afterRestoreState = function () {
		// ?
	};

	// Based on [bx_keyb_c::activate_timer]
	KeyboardCntrlr.prototype.activateTimer = function () {
		if (!this.keyboard.state.timer_pending) {
			this.keyboard.state.timer_pending = true;
		}
	};

	// Simulates the physical 8042 controller->keyboard connection:
	//	the actual command bytes involved are used
	// Based on [bx_keyb_c::kbd_ctrl_to_kbd]
	KeyboardCntrlr.prototype.sendToKeyboard = function (val) {
		var keyboard = this.keyboard
			, cps;
		util.debug("KeyboardCntrlr.sendToKeyboard() :: Controller passed byte "
			+ util.format("hex", val) + " to keyboard");

		if (keyboard.bufInternal.expecting_typematic) {
			keyboard.bufInternal.expecting_typematic = false;
			keyboard.bufInternal.delay = (val >> 5) & 0x03;
			switch (keyboard.bufInternal.delay) {
			case 0: util.info("KeyboardCntrlr.sendToKeyboard() ::"
				+ " Setting delay to 250 mS (unused)"); break;
			case 1: util.info("KeyboardCntrlr.sendToKeyboard() ::"
				+ " setting delay to 500 mS (unused)"); break;
			case 2: util.info("KeyboardCntrlr.sendToKeyboard() ::"
				+ " setting delay to 750 mS (unused)"); break;
			case 3: util.info("KeyboardCntrlr.sendToKeyboard() ::"
				+ " setting delay to 1000 mS (unused)"); break;
			}
			keyboard.bufInternal.repeat_rate = val & 0x1f;
			cps = 1 / (
				(8 + (val & 0x07))
				* Math.exp(Math.log(2) * ((val >> 3) & 0x03))
				* 0.00417
			);
			util.info("KeyboardCntrlr.sendToKeyboard() :: Setting repeat rate"
				+ " to " + cps + " cps (unused)");
			keyboard.enqueueKey(0xFA); // Send (ACK)nowledge
			return;
		}

		if (keyboard.bufInternal.expecting_led_write) {
			keyboard.bufInternal.expecting_led_write = 0;
			keyboard.bufInternal.led_status = val;
			util.debug("KeyboardCntrlr.sendToKeyboard() :: LED status set to "
				+ util.format("hex", keyboard.bufInternal.led_status));
			// TODO: Sort out status bar/LEDs/GUI etc...
			//bx_gui->statusbar_setitem(BX_KEY_THIS statusbar_id[0], val & 0x02);
			//bx_gui->statusbar_setitem(BX_KEY_THIS statusbar_id[1], val & 0x04);
			//bx_gui->statusbar_setitem(BX_KEY_THIS statusbar_id[2], val & 0x01);

			keyboard.enqueueKey(0xFA); // Send (ACK)nowledge
			return;
		}

		if (keyboard.state.expecting_scancodes_set) {
			keyboard.state.expecting_scancodes_set = false;
			if (val !== 0) {
				if (val < 4) {
					keyboard.state.current_scancodes_set = (val - 1);
					util.info("KeyboardCntrlr.sendToKeyboard() ::"
						+ " Switched to scancode set"
						+ keyboard.state.current_scancodes_set + 1
					);
					keyboard.enqueueKey(0xFA); // Send (ACK)nowledge
				} else {
					util.problem("KeyboardCntrlr.sendToKeyboard() ::"
						+ " Received scancodes set out of range: ", + val);
					keyboard.enqueueKey(0xFF); // Send ERROR
				}
			} else {
				// Send ACK [Bochs] (SF patch #1159626)
				keyboard.enqueueKey(0xFA);
				// Send current scancodes set to port 0x60
				keyboard.enqueueKey(1 + keyboard.state.current_scancodes_set);
			}
			return;
		}

		switch (val) {
		case 0x00: // ??? Ignore and let OS timeout with no response
			keyboard.enqueueKey(0xFA); // Send (ACK)nowledge
			break;

		case 0x05: // ???
			// (mch) trying to get this to work...
			//BX_KEY_THIS keyboard.state.sysf = 1;
			//kbd_enQ_imm(0xfe);
			break;

		case 0xED: // LED Write
			keyboard.bufInternal.expecting_led_write = true;
			keyboard.enqueueKey(0xFA); // Send (ACK)nowledge
			break;

		case 0xEE: // Echo
			keyboard.enqueueKey(0xEE); // return same byte (EEh) as echo diagnostic
			break;

		case 0xF0: // Select alternate scan code set
			keyboard.state.expecting_scancodes_set = true;
			util.debug("KeyboardCntrlr.sendToKeyboard() ::"
				+ " Expecting scancode set info...");
			keyboard.enqueueKey(0xFA); // Send (ACK)nowledge
			break;

		case 0xF2: // Identify keyboard
			util.info("KeyboardCntrlr.sendToKeyboard() ::"
				+ " 'Identify keyboard' command received");

			/** NB: Removed XT/MFII etc. codes from here,
				leaving only AT support (is this ok???) **/

			keyboard.enqueueKey(0xFA); // Send (ACK)nowledge
			break;

		case 0xF3:  // Typematic info
			keyboard.bufInternal.expecting_typematic = 1;
			util.info("KeyboardCntrlr.sendToKeyboard() ::"
				+ " Setting typematic info");
			keyboard.enqueueKey(0xFA); // Send (ACK)nowledge
			break;

		case 0xF4:  // Enable keyboard
			keyboard.bufInternal.scanning_enabled = 1;
			keyboard.enqueueKey(0xFA); // Send (ACK)nowledge
			break;

		case 0xF5:  // Reset keyboard to power-up settings and disable scanning
			this.resetInternals(true);
			keyboard.enqueueKey(0xFA); // Send (ACK)nowledge
			keyboard.bufInternal.scanning_enabled = 0;
			util.info("KeyboardCntrlr.sendToKeyboard() ::"
				+ " 'Reset-disable' command received");
			break;

		case 0xF6:  // Reset keyboard to power-up settings and enable scanning
			this.resetInternals(true);
			keyboard.enqueueKey(0xFA); // Send (ACK)nowledge
			keyboard.bufInternal.scanning_enabled = 1;
			util.info("KeyboardCntrlr.sendToKeyboard() ::"
				+ " 'Reset-enable' command received");
			break;
		// Resend - this should never happen,
		//	as it would indicate a physical problem
		//	eg. loose connection - we are an emulator!!!
		case 0xFE:
			util.panic("KeyboardCntrlr.sendToKeyboard() ::"
				+ " Got 0xFE (resend) !!!");
			break;

		case 0xFF: // Reset: Internal keyboard reset and afterwards the BAT
			util.debug("KeyboardCntrlr.sendToKeyboard() ::"
				+ " 'Reset' command received");
			this.resetInternals(true);
			keyboard.enqueueKey(0xFA); // Send (ACK)nowledge
			keyboard.state.bat_in_progress = true;
			keyboard.enqueueKey(0xAA); // BAT test passed
			break;

		case 0xD3:
			keyboard.enqueueKey(0xFA); // Send (ACK)nowledge
			break;

		case 0xF7:  // PS/2 Set All Keys To Typematic
		case 0xF8:  // PS/2 Set All Keys to Make/Break
		case 0xF9:  // PS/2 PS/2 Set All Keys to Make
		case 0xFA:  // PS/2 Set All Keys to Typematic Make/Break
		case 0xFB:  // PS/2 Set Key Type to Typematic
		case 0xFC:  // PS/2 Set Key Type to Make/Break
		case 0xFD:  // PS/2 Set Key Type to Make
		default:
			util.problem("KeyboardCntrlr.sendToKeyboard() ::"
				+ " Got value of " + util.format("hex", val));
			keyboard.enqueueKey(0xFE); // Send NACK
			break;
		}
	};
	// Simulates the physical 8042 controller->mouse connection:
	//	the actual command bytes involved are used
	// Based on [bx_keyb_c::kbd_ctrl_to_mouse]
	KeyboardCntrlr.prototype.sendToMouse = function (val) {
		var keyboard = this.keyboard, mouse = this.mouse
			, cps;
		util.debug("KeyboardCntrlr.sendToMouse() :: Controller passed byte "
			+ util.format("hex", val) + " to mouse");

		/** NB: This is _always_ a PS/2 mouse **/

		util.debug(" -> enable = ", mouse.state.enable);
		util.debug(" -> allow_irq12 = " + keyboard.state.allow_irq12);
		util.debug(" -> aux_clock_enabled = " + keyboard.state.aux_clock_enabled);

		// An (ACK)nowledge (0xFA) is always the first response
		//	to any valid input received from the system
		//	other than Set-Wrap-Mode & Resend-Command

		// A command was received, now a parameter/argument to that command
		//	is expected to be passed
		if (keyboard.state.expecting_mouse_parameter) {
			keyboard.state.expecting_mouse_parameter = false;
			switch (keyboard.state.last_mouse_command) {
			case 0xF3: // Set Mouse Sample Rate
				mouse.state.sample_rate = val;
				util.debug("KeyboardCntrlr.sendToMouse() ::"
					+ " Sampling rate set: " + val + " Hz");
				if ((val === 200) && (!mouse.state.im_request)) {
					mouse.state.im_request = 1;
				} else if ((val === 100) && (mouse.state.im_request === 1)) {
					mouse.state.im_request = 2;
				} else if ((val === 80) && (mouse.state.im_request === 2)) {
					util.info("KeyboardCntrlr.sendToMouse() ::"
						+ " Wheel mouse mode enabled");
					mouse.state.im_mode = true;

					mouse.state.im_request = 0;
				} else {
					mouse.state.im_request = 0;
				}
				mouse.enqueueCntrlr(0xFA); // (ACK)nowledge
				break;

			case 0xE8: // Set Mouse Resolution
				switch (val) {
				case 0:
					mouse.state.resolution_cpmm = 1;
					break;
				case 1:
					mouse.state.resolution_cpmm = 2;
					break;
				case 2:
					mouse.state.resolution_cpmm = 4;
					break;
				case 3:
					mouse.state.resolution_cpmm = 8;
					break;
				default:
					util.panic("KeyboardCntrlr.sendToMouse() ::"
						+ " Unknown resolution " + val);
				}
				util.debug("KeyboardCntrlr.sendToMouse() ::"
					+ " Resolution set to " + mouse.state.resolution_cpmm
					+ " counts per mm");

				mouse.enqueueCntrlr(0xFA); // (ACK)nowledge
				break;
			default:
				util.panic("KeyboardCntrlr.sendToMouse() ::"
					+ " Unknown last command ("
					+ util.format("hex", keyboard.state.last_mouse_command) + ")");
			}
		} else {
			keyboard.state.expecting_mouse_parameter = 0;
			keyboard.state.last_mouse_command = val;

			// Test for wrap mode first
			if (mouse.state.mode === MOUSE_MODE_WRAP) {
				// Not a reset command or reset wrap mode:
				//	just echo the byte.
				if ((val !== 0xFF) && (val !== 0xEC)) {
					util.debug("KeyboardCntrlr.sendToMouse() ::"
						+ " Wrap mode: ignoring command ("
						+ util.format("hex", val) + ")");
					mouse.enqueueCntrlr(val);
					// Bail out
					return;
				}
			}
			switch (val) {
			case 0xE6: // Set Mouse Scaling to 1:1
				mouse.enqueueCntrlr(0xFA); // (ACK)nowledge
				mouse.state.scaling = 2;
				util.debug("KeyboardCntrlr.sendToMouse() :: Scaling set to 1:1");
				break;

			case 0xE7: // Set Mouse Scaling to 2:1
				mouse.enqueueCntrlr(0xFA); // (ACK)nowledge
				mouse.state.scaling = 2;
				util.debug("KeyboardCntrlr.sendToMouse() :: Scaling set to 2:1");
				break;

			case 0xE8: // Set Mouse Resolution
				mouse.enqueueCntrlr(0xFA); // (ACK)nowledge
				keyboard.state.expecting_mouse_parameter = true;
				break;

			case 0xEA: // Set Stream Mode
				util.debug("KeyboardCntrlr.sendToMouse() :: Stream mode on");
				mouse.state.mode = MOUSE_MODE_STREAM;
				mouse.enqueueCntrlr(0xFA); // (ACK)nowledge
				break;

			case 0xEC: // Reset Wrap Mode
				// Unless we are in wrap mode ignore the command
				if (mouse.state.mode === MOUSE_MODE_WRAP) {
					util.debug("KeyboardCntrlr.sendToMouse() :: Wrap mode off");
					// Restore previous mode except disable stream mode reporting.
					// ### TODO disabling reporting in stream mode
					mouse.state.mode = mouse.state.saved_mode;
					mouse.enqueueCntrlr(0xFA); // (ACK)nowledge
				}
				break;
			case 0xEE: // Set Wrap Mode
				// ### TODO flush output queue.
				// ### TODO disable interrupts if in stream mode.
				util.debug("KeyboardCntrlr.sendToMouse() :: Wrap mode on");
				mouse.state.saved_mode = mouse.state.mode;
				mouse.state.mode = MOUSE_MODE_WRAP;
				mouse.enqueueCntrlr(0xFA); // (ACK)nowledge
				break;

			case 0xF0: // Set Remote Mode (polling mode, i.e. not stream mode.)
				util.debug("KeyboardCntrlr.sendToMouse() :: Remote mode on");
				// ### TODO should we flush/discard/ignore
				//	any already queued packets?
				mouse.state.mode = MOUSE_MODE_REMOTE;
				mouse.enqueueCntrlr(0xFA); // (ACK)nowledge
				break;

			case 0xF2: // Read Device Type
				mouse.enqueueCntrlr(0xFA); // (ACK)nowledge
				if (mouse.state.im_mode) {
					mouse.enqueueCntrlr(0x03); // Device ID (wheel z-mouse)
				} else {
					mouse.enqueueCntrlr(0x00); // Device ID (standard)
				}
				util.debug("KeyboardCntrlr.sendToMouse() :: Read mouse ID");
				break;

			case 0xF3: // Set Mouse Sample Rate (sample rate -> port 60h)
				mouse.enqueueCntrlr(0xFA); // (ACK)nowledge
				keyboard.state.expecting_mouse_parameter = true;
				break;

			case 0xF4: // Enable (in stream mode)
				mouse.state.enable = 1;
				mouse.enqueueCntrlr(0xFA); // (ACK)nowledge
				util.debug("KeyboardCntrlr.sendToMouse() ::"
					+ " Mouse enabled (stream mode)");
				break;

			case 0xF5: // Disable (in stream mode)
				mouse.state.enable = 0;
				mouse.enqueueCntrlr(0xFA); // (ACK)nowledge
				util.debug("KeyboardCntrlr.sendToMouse() ::"
					+ " Mouse disabled (stream mode)");
				break;

			case 0xF6: // Set Defaults
				mouse.state.sample_rate     = 100;	// Reports per second (default)
				mouse.state.resolution_cpmm = 4;	// 4 counts per millimeter (default)
				mouse.state.scaling         = 1;	// 1:1 (default)
				mouse.state.enable          = 0;
				mouse.state.mode            = MOUSE_MODE_STREAM;
				mouse.enqueueCntrlr(0xFA); // (ACK)nowledge
				util.debug("KeyboardCntrlr.sendToMouse() :: Set defaults");
				break;

			case 0xFF: // Reset
				mouse.state.sample_rate     = 100;	// Reports per second (default)
				mouse.state.resolution_cpmm = 4;	// 4 counts per millimeter (default)
				mouse.state.scaling         = 1;	// 1:1 (default)
				mouse.state.mode            = MOUSE_MODE_RESET;
				mouse.state.enable          = 0;
				if (mouse.state.im_mode) {
					util.info("KeyboardCntrlr.sendToMouse() ::"
						+ " Wheel mouse mode disabled");
					mouse.state.im_mode = false;
				}

				// [Bochs] (mch) NT expects an ack here
				mouse.enqueueCntrlr(0xFA); // (ACK)nowledge
				mouse.enqueueCntrlr(0xAA); // Completion code
				mouse.enqueueCntrlr(0x00); // ID code (standard after reset)
				util.debug("KeyboardCntrlr.sendToMouse() :: Mouse reset");
				break;

			case 0xE9: // Get mouse information
				// [Bochs] Should we ack here? (mch): Yes
				mouse.enqueueCntrlr(0xFA); // (ACK)nowledge
				mouse.enqueueCntrlr(mouse.state.get_status_byte()); // Status
				mouse.enqueueCntrlr(mouse.state.get_resolution_byte()); // Resolution
				mouse.enqueueCntrlr(mouse.state.sample_rate); // Sample rate
				util.debug("KeyboardCntrlr.sendToMouse() ::"
					+ " Get mouse information");
				break;

			case 0xEB: // Read Data (send a packet when in Remote Mode)
				mouse.enqueueCntrlr(0xFA); // (ACK)nowledge
				// [Bochs] Perhaps we should be adding some movement here.
				// Bit3 of first byte always set
				mouse_enQ_packet(((mouse.state.button_status & 0x0f) | 0x08),
					0x00, 0x00, 0x00);
				// [Bochs] Assumed we really aren't in polling mode,
				//	a rather odd assumption.
				util.problem("KeyboardCntrlr.sendToMouse() :: Warning:"
					+ " Read Data command partially supported.");
				break;

			case 0xBB: // OS/2 Warp 3 uses this command
				util.problem("KeyboardCntrlr.sendToMouse() ::"
					+ " Ignoring 0xbb command");
				break;

			default:
				util.problem("KeyboardCntrlr.sendToMouse() ::"
					+ " Got value of " + util.format("hex", val));
				mouse.enqueueCntrlr(0xFE); // Send NACK
			}
		}
	};
	//	Based on [bx_keyb_c::periodic]
	KeyboardCntrlr.prototype.periodic = function (delta_usecs) {
		//static unsigned count_before_paste=0;
		var keyboard = this.keyboard, mouse = this.mouse
			, retval;

		if (keyboard.state.kbd_clock_enabled) {
			// TODO: Implement paste buffer!!!
			/* if (++count_before_paste >= BX_KEY_THIS pastedelay) {
				// after the paste delay, consider adding moving more chars
				// from the paste buffer to the keyboard buffer.
				BX_KEY_THIS service_paste_buf();
				count_before_paste = 0;
			} */
		}

		retval = keyboard.state.irq1_requested
			| (keyboard.state.irq12_requested << 1);
		keyboard.state.irq1_requested = 0;
		keyboard.state.irq12_requested = 0;

		if (!keyboard.state.timer_pending) {
			return retval;
		}

		if (delta_usecs >= keyboard.state.timer_pending) {
			keyboard.state.timer_pending = 0;
		} else {
			keyboard.state.timer_pending -= delta_usecs;
			return retval;
		}

		if (keyboard.state.outb) {
			return retval;
		}

		// Nothing in outb, look for possible data xfer from keyboard or mouse
		if ( keyboard.bufInternal.num_elements &&
				(keyboard.state.kbd_clock_enabled
				|| keyboard.state.bat_in_progress) ) {
			util.debug("KeyboardCntrlr.periodic() ::"
				+ " Key in internal buffer waiting");
			keyboard.state.kbd_output_buffer =
				keyboard.bufInternal.buffer[ keyboard.bufInternal.head ];
			keyboard.state.outb = 1;
			// [Bochs] Commented out since this would override
			//	the current state of the mouse buffer flag -
			//	no bug seen - just seems wrong (das)
			//    keyboard.state.auxb = 0;
			keyboard.bufInternal.head = (keyboard.bufInternal.head + 1)
				% KBD_ELEMENTS;
			--keyboard.bufInternal.num_elements;
			if (keyboard.state.allow_irq1) {
				keyboard.state.irq1_requested = true;
			}
		} else {
			mouse.createPacket(false);
			if ( keyboard.state.aux_clock_enabled && mouse.bufInternal.num_elements) {
				util.debug("KeyboardCntrlr.periodic() ::"
					+ " Key(from mouse) in internal buffer waiting");
				keyboard.state.aux_output_buffer =
					mouse.bufInternal.buffer[ mouse.bufInternal.head ];

				keyboard.state.outb = 1;
				keyboard.state.auxb = 1;
				mouse.bufInternal.head = (mouse.bufInternal.head + 1)
					% MOUSE_BUFF_SIZE;
				--mouse.bufInternal.num_elements;
				if (keyboard.state.allow_irq12) {
					keyboard.state.irq12_requested = true;
				}
			} else {
				util.debug("KeyboardCntrlr.periodic() ::"
					+ " No keys waiting");
			}
		}
		return retval;
	};
	KeyboardCntrlr.prototype.enqueueKey = function (scancode) {
		this.keyboard.enqueueKey(scancode);
	};
	KeyboardCntrlr.prototype.updateMouse = function (x, y) {
		util.warning("KeyboardCntrlr.updateMouse() :: Not yet implemented");
	};

	function Keyboard(cntrlr) {
		this.cntrlr = cntrlr;

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
			, kbd_output_buffer: 0x00
			, aux_output_buffer: 0x00
			, /* byte */last_comm: 0
			, expecting_port60h: false
			, expecting_mouse_parameter: new Register("EXP_MOUSE_PARAM", 1)
			, last_mouse_command: new Register("LAST_MOUSE_CMD", 1)
			, timer_pending: false
			, irq1_requested: false
			, irq12_requested: false
			, scancodes_translate: false
			, expecting_scancodes_set: false
			, current_scancodes_set: 0
			// (B)asic (A)ssurance (T)est - a self-test for the keyboard
			, bat_in_progress: false

			, queue: new Array(KBD_CONTROLLER_QSIZE)
			, sizeQueue: 0
			, sourceQueue: 0 // 0 = keyboard, 1 = mouse
		};

		this.bufInternal = {
			num_elements: 0
			, buffer: new Array(KBD_ELEMENTS)
			, head: 0
			, expecting_typematic: false
			, expecting_led_write: false
			, delay: new Register("DELAY", 1)
			, repeat_rate: 0
			, led_status: 0
			, scanning_enabled: false
		};
	}
	Keyboard.prototype.init = function () {
		var state = this.state
			, idx;

		this.bufInternal.led_status = 0;
		this.bufInternal.scanning_enabled = true;

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
		state.kbd_output_buffer = 0x00;
		state.aux_output_buffer = 0x00;
		state.last_comm = 0;
		state.expecting_port60h = false;
		state.irq1_requested = false;
		state.irq12_requested = false;
		state.expecting_mouse_parameter = 0;
		state.bat_in_progress = 0;
		state.scancodes_translate = 1;

		state.timer_pending = false;

		for (idx = 0 ; idx < KBD_CONTROLLER_QSIZE ; ++idx) {
			state.queue[ idx ] = 0;
		}
		state.sizeQueue = 0;
		state.sourceQueue = 0;
	};
	Keyboard.prototype.generateScancode = function (/* Byte */key, makeOrBreak) {
		var state = this.state
			, i, scancode;

		//if ((BX_KEY_THIS pastebuf != NULL) && (!BX_KEY_THIS paste_service)) {
		//	BX_KEY_THIS stop_paste = 1;
		//	return;
		//}

		util.debug(util.sprintf(
			"gen_scancode(): %s %s"
			, Scancode.getKeyName(key), makeOrBreak === "make" ? "pressed" : "released"
		));

		if (!state.scancodes_translate) {
			util.debug(("keyboard: gen_scancode with scancode_translate cleared"));
		}

		// Ignore scancode if keyboard clock is driven low
		if (!state.kbd_clock_enabled) { return; }

		// Ignore scancode if scanning is disabled
		if (!this.bufInternal.scanning_enabled) { return; }

		// Switch between make and break code
		scancode = Scancode.scancodes[ key ];
		if (!scancode) {
			util.problem("Invalid key: " + key + ", ignoring");
			return;
		}
		scancode = scancode[ state.current_scancodes_set ][ (makeOrBreak !== "make") & 0x01 ];

		// if we have a removable keyboard installed, we need to call its handler first
		//if (DEV_optional_key_enq(scancode)) {
		//	return;
		//}

		// Translate before send if needed
		if (state.scancodes_translate) {
			var escaped = 0x00;

			for (i = 0 ; i < scancode.length ; ++i) {
				if (scancode[ i ] == 0xF0) {
					escaped = 0x80;
				} else {
					util.debug(util.sprintf(
						"gen_scancode(): writing translated %02x"
						, Scancode.translation8042[ scancode[ i ] ] | escaped
					));
					this.enqueueKey(Scancode.translation8042[ scancode[ i ] ] | escaped);
					escaped = 0x00;
				}
			}
		// Otherwise just send raw data
		} else {
			for (i = 0 ; i < scancode.length ; ++i) {
				util.debug(util.sprintf(
					"gen_scancode(): writing raw %02x"
					, scancode[ i ]
				));
				this.enqueueKey(scancode[ i ]);
			}
		}
	};
	// For turning the keyboard clock on or off
	//	Based on [bx_keyb_c::set_kbd_clock_enable]
	Keyboard.prototype.setClockEnabled = function (val) {
		var state = this.state, old_enabled;

		if (!val) {
			state.kbd_clock_enabled = false;
		} else {
			// Is another byte waiting to be sent from the keyboard?
			old_enabled = state.kbd_clock_enabled;
			state.kbd_clock_enabled = true;

			// Enable timer if switching from disabled -> enabled
			if (!old_enabled && state.outb === 0) {
				this.cntrlr.activateTimer();
			}
		}
	};
	// Based on (part of) [bx_keyb_c::controller_enQ]
	Keyboard.prototype.enqueueCntrlr = function (data) {
		var state = this.state;

		util.debug("KeyboardCntrlr.enqueueCntrlr(" + util.format("hex", data) + ")");

		// See if we need to queue this byte from the controller
		if (state.outb) {
			if (state.sizeQueue >= KBD_CONTROLLER_QSIZE) {
				util.panic("KeyboardCntrlr.enqueueCntrlr(" + util.format("hex", data)
					+ ") :: state.queue full!");
			}
			state.queue[ state.sizeQueue++ ] = data;
			state.sourceQueue = 0;
			return;
		}

		/** The queue is empty **/

		state.kbd_output_buffer = data;
		state.outb = 1;
		state.auxb = 0;
		state.inpb = 0;
		if (state.allow_irq1) {
			state.irq1_requested = true;
		}
	};
	Keyboard.prototype.enqueueKey = function (scancode) {
		util.debug("Keyboard.enqueueKey(scancode = "
			+ util.format("hex", scancode) + ")");

		if (this.bufInternal.num_elements >= KBD_ELEMENTS) {
			util.info("Keyboard.enqueueKey(...) ::"
				+ " Internal keyboard buffer full, ignoring scancode.");
			return;
		}

		// Enqueue scancode in multibyte internal keyboard buffer, as in Bochs.
		util.debug("Keyboard.enqueueKey(...) :: Putting scancode"
			+ " in internal buffer");

		this.bufInternal.buffer[
			// Calculate & store @ tail index
			(this.bufInternal.head + this.bufInternal.num_elements)
			% KBD_ELEMENTS
		] = scancode;
		++this.bufInternal.num_elements;

		if (!this.state.outb && this.state.kbd_clock_enabled) {
			this.cntrlr.activateTimer();
			util.debug("Keyboard.enqueueKey(...) :: Activating timer...");
			return;
		}
	};

	function Mouse(cntrlr) {
		this.cntrlr = cntrlr;

		this.state = {
			type: 0
			, sample_rate: 0
			, resolution_cpmm: 0 // Resolution in counts-per-mm
			, scaling: 0
			, mode: 0
			, saved_mode: 0 // The mode prior to entering wrap mode
			, enable: false

			, get_status_byte: function () {
				// Top bit is 0 , bit 6 is 1 if remote mode.
				var ret = (mode === MOUSE_MODE_REMOTE) ? 0x40 : 0;
				ret |= (enable << 5);
				ret |= (scaling == 1) ? 0 : (1 << 4);
				ret |= ((button_status & 0x1) << 2);
				ret |= ((button_status & 0x2) << 0);
				return ret;
			}, get_resolution_byte: function () {
				var ret = 0;

				switch (this.resolution_cpmm) {
				case 1:
					ret = 0;
					break;

				case 2:
					ret = 1;
					break;

				case 4:
					ret = 2;
					break;

				case 8:
					ret = 3;
					break;

				default:
					util.panic("Mouse.state.get_resolution_byte() ::"
						+ " Invalid resolution_cpmm");
				}
				return ret;

			}, button_status: 0
			, delayed_dx: 0
			, delayed_dy: 0
			, delayed_dz: 0
			, im_request: 0
			, im_mode: false
		};
		this.bufInternal = {
			num_elements: 0
			, buffer: new Array(MOUSE_BUFF_SIZE)
			, head: 0
		};
	}
	Mouse.prototype.init = function () {
		var state
			, idx, list, len;

		this.bufInternal.num_elements = 0;
		for (idx = 0 ; idx < MOUSE_BUFF_SIZE ; ++idx) {
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
		state.im_mode = false;		// Are we in wheel mouse mode?
	};
	// For turning the keyboard clock on or off
	//	Based on [bx_keyb_c::set_aux_clock_enable]
	Mouse.prototype.setClockEnabled = function (val) {
		var state = this.state, old_enabled;

		if (!val) {
			state.aux_clock_enabled = false;
		} else {
			// Is another byte waiting to be sent from the keyboard?
			old_enabled = state.aux_clock_enabled;
			state.aux_clock_enabled = true;

			// Enable timer if switching from disabled -> enabled
			if (!old_enabled && state.outb === 0) {
				this.cntrlr.activateTimer();
			}
		}
	};
	//	Based on (part of) [bx_keyb_c::controller_enQ]
	Mouse.prototype.enqueueCntrlr = function (data) {
		var state = this.state;

		util.debug("Mouse.enqueueCntrlr(" + util.format("hex", data) + ")");

		// See if we need to queue this byte from the controller
		//	(even for mouse bytes)
		if (state.outb) {
			if (state.sizeQueue >= KBD_CONTROLLER_QSIZE) {
				util.panic("Mouse.enqueueCntrlr(" + util.format("hex", data)
					+ ") :: state.queue full!");
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
		if (state.allow_irq12) {
			state.irq12_requested = true;
		}
	};
	// Based on [bx_keyb_c::mouse_enQ_packet]
	Mouse.prototype.enqueuePacket = function (byt1, byt2, byt3, byt4) {
		var bytes = this.state.im_mode ? 4 : 3;

		if ((this.bufInternal.num_elements + bytes) >= MOUSE_BUFF_SIZE) {
			return false; // Not enough space in buffer
		}

		this.enqueueData(byt1);
		this.enqueueData(byt2);
		this.enqueueData(byt3);
		if (this.state.im_mode) { this.enqueueData(byt4); }

		return true;
	};
	// Based on [bx_keyb_c::mouse_enQ]
	Mouse.prototype.enqueueData = function (data) {
		util.debug("Mouse.enqueueData(data = "
			+ util.format("hex", data) + ")");

		if (this.bufInternal.num_elements >= MOUSE_BUFF_SIZE) {
			util.info("Mouse.enqueueData(...) ::"
				+ " Internal mouse buffer full, ignoring mouse data.");
			return;
		}

		// Enqueue mouse data in multibyte internal mouse buffer, as in Bochs.
		util.debug("Mouse.enqueueData(...) :: Putting data"
			+ " in internal buffer");

		this.bufInternal.buffer[
			// Calculate & store @ tail index
			(this.bufInternal.head + this.bufInternal.num_elements)
			% MOUSE_BUFF_SIZE
		] = data;
		++this.bufInternal.num_elements;

		if (!this.cntrlr.state.outb && this.cntrlr.state.aux_clock_enabled) {
			this.cntrlr.activateTimer();
			util.debug("Mouse.enqueueData(...) :: Activating timer...");
			return;
		}
	};
	// Based on [bx_keyb_c::create_mouse_packet]
	Mouse.prototype.createPacket = function (forceEnqueue) {
		var byt1, byt2, byt3, byt4, delta_x, delta_y, button_state;

		if (this.bufInternal.num_elements && !forceEnqueue) {
			return;
		}

		delta_x = this.state.delayed_dx;
		delta_y = this.state.delayed_dy;
		button_state = this.state.button_status | 0x08;

		if (!forceEnqueue && !delta_x && !delta_y) {
			return;
		}

		// Enforce bounds
		if (delta_x > 254) { delta_x = 254; }
		if (delta_x < -254) { delta_x = -254; }
		if (delta_y > 254) { delta_y = 254; }
		if (delta_y < -254) { delta_y = -254; }

		byt1 = (button_state & 0x0F) | 0x08; // Bit3 always set

		if ((delta_x >= 0) && (delta_x <= 255)) {
			byt2 = delta_x;
			this.state.delayed_dx -= delta_x;
		} else if (delta_x > 255) {
			byt2 = 0xFF;
			this.state.delayed_dx -= 255;
		} else if (delta_x >= -256) {
			byt2 = delta_x;
			byt1 |= 0x10;
			this.state.delayed_dx -= delta_x;
		} else {
			byt2 = 0x00;
			byt1 |= 0x10;
			this.state.delayed_dx += 256;
		}

		if ((delta_y >= 0) && (delta_y <= 255)) {
			byt3 = delta_y;
			this.state.delayed_dy -= delta_y;
		} else if (delta_y > 255) {
			byt3 = 0xFF;
			this.state.delayed_dy -= 255;
		} else if (delta_y >= -256) {
			byt3 = delta_y;
			byt1 |= 0x20;
			this.state.delayed_dy -= delta_y;
		} else {
			byt3 = 0x00;
			byt1 |= 0x20;
			this.state.delayed_dy += 256;
		}

		byt4 = -this.state.delayed_dz;

		this.enqueuePacket(byt1, byt2, byt3, byt4);
	};
	// Called by external code to register a move of the mouse
	//	& send it to the guest OS, etc.
	// Based on [bx_keyb_c::mouse_motion]
	Mouse.prototype.motion = function (delta_x, delta_y, delta_z, button_state) {
		// ...
	};

	// KeyboardCntrlr controller's I/O read operations' handler routine
	function readHandler(device, addr, io_len) {
		// "device" will be KeyboardCntrlr
		var machine = device.machine, state = device.keyboard.state
			, keyboard = device.keyboard, mouse = device.mouse
			, idx
			, result8; // 8-bit result

		//util.info("KeyboardCntrlr readHandler() :: Read addr = "
		//	+ util.format("hex", addr));

		/** NB: This is an 8042 Keyboard controller **/

		switch (addr) {
		case 0x60: // Output buffer
			// Mouse byte available
			if (state.auxb) {
				result8 = state.aux_output_buffer;
				state.aux_output_buffer = 0x00;
				state.outb = 0;
				state.auxb = 0;
				state.irq12_requested = false;

				if (state.sizeQueue) {
					state.aux_output_buffer = state.queue[ 0 ];
					state.outb = 1;
					state.auxb = 1;
					if (state.allow_irq12) {
						state.irq12_requested = true;
					}
					// Move queue elements towards queue head by 1
					for (idx = 0 ; idx < state.sizeQueue - 1 ; ++idx) {
						state.queue[ idx ] = state.queue[ idx + 1 ];
					}
					--state.sizeQueue;
				}

				machine.pic.lowerIRQ(12);
				device.activateTimer();
				util.debug("KeyboardCntrlr (for aux - mouse) readHandler() ::"
					+ " Read from " + util.format("hex", addr)
					+ " returns " + util.format("hex", result8));
				return result8;
			// Keyboard byte available
			} else if (state.outb) {
				result8 = state.kbd_output_buffer;
				/** NB: Why is kbd_output_buffer not cleared??? **/
				state.outb = 0;
				state.auxb = 0;
				state.irq1_requested = false;
				state.bat_in_progress = 0;

				if (state.sizeQueue) {
					state.aux_output_buffer = state.queue[ 0 ];
					state.outb = 1;
					state.auxb = 1;
					if (state.allow_irq1) {
						state.irq1_requested = true;
					}
					// Move queue elements towards queue head by 1
					for (idx = 0 ; idx < state.sizeQueue - 1 ; ++idx) {
						state.queue[ idx ] = state.queue[ idx + 1 ];
					}
					util.debug("KeyboardCntrlr readHandler() ::"
						+ " state.sizeQueue = " + state.sizeQueue);
					--state.sizeQueue;
				}

				machine.pic.lowerIRQ(1);
				device.activateTimer();
				util.debug("KeyboardCntrlr readHandler() ::"
					+ " Read from " + util.format("hex", addr)
					+ " returns " + util.format("hex", result8));
				return result8;
			}
			util.debug("num_elements = " + keyboard.bufInternal.num_elements);
			util.debug("KeyboardCntrlr readHandler() ::"
				+ " Read from " + util.format("hex", addr)
				+ " with .outb empty");
			return state.kbd_output_buffer;

			//return 0x00;
			//return 0x55; // Pass keyboard self-test
		case 0x64: // Status register
			// Build the status register's value from all its bit values
			result8 = (state.parityError << 7)
				| (state.timeout << 6)
				| (state.auxb << 5)
				| (state.keylock << 4)
				| (state.commandOrData << 3)
				| (state.sysf << 2)
				| (state.inpb << 1)
				| state.outb;
			state.timeout = 0;
			//debugger;
			return result8;

			//return 0x00;
			//return 0x01; // Pass keyboard self-test
		default:
			util.problem("KeyboardCntrlr readHandler() :: Unsupported read, address="
				+ util.format("hex", addr) + "!");
			return 0;
		}
	}
	// Keyboard controller's I/O write operations' handler routine
	function writeHandler(device, addr, val, io_len) {
		// "device" will be KeyboardCntrlr
		var machine = device.machine, state = device.keyboard.state
			, keyboard = device.keyboard, mouse = device.mouse
			, idx
			, scan_convert, disable_keyboard, disable_aux;

		util.info("KeyboardCntrlr writeHandler() :: 8-bit write to address: "
			+ util.format("hex", addr) + " = " + util.format("hex", val));

		/** NB: This is a 8042 Keyboard controller **/

		switch (addr) {
		case 0x60: // Input buffer
			// Expecting data byte from command last sent to port 64h
			if (state.expecting_port60h) {
				state.expecting_port60h = false;
				state.commandOrData = 0; // Data byte written last to 0x60
				if (state.inpb) {
					util.problem("KeyboardCntrlr writeHandler() ::"
						+ " Write to port 60h - not ready for write");
				}

				switch (state.last_comm) {
				case 0x60: // Write command byte
					scan_convert = (val >> 6) & 0x01;
					disable_aux = (val >> 5) & 0x01;
					disable_keyboard = (val >> 4) & 0x01;
					state.sysf = (val >> 2) & 0x01;
					state.allow_irq1 = (val >> 0) & 0x01;
					state.allow_irq12 = (val >> 1) & 0x01;
					keyboard.setClockEnabled(!disable_keyboard);
					mouse.setClockEnabled(!disable_aux);
					if (state.allow_irq12 && state.auxb) {
						state.irq12_requested = true;
					} else if (state.allow_irq1 && state.outb) {
						state.irq1_requested = true;
					}
					util.debug("KeyboardCntrlr writeHandler() :: allow_irq12 set to "
						+ state.allow_irq12);

					if (!scan_convert) {
						util.info("KeyboardCntrlr writeHandler() ::"
							+ " Scan-convert turned off");
					}

					// [Bochs] (mch) NT needs this
					state.scancodes_translate = scan_convert;
					break;
				case 0xCB: // Write keyboard controller mode
					util.debug("KeyboardCntrlr writeHandler() ::"
						+ " Write keyboard controller mode with value "
						, util.format("hex", val));
					break;
				case 0xD1: // Write output port
					util.debug("KeyboardCntrlr writeHandler() ::"
						+ " Write output port with value "
						, util.format("hex", val));
					util.debug("KeyboardCntrlr writeHandler() ::"
						+ " Write output port: "
						+ ((val & 0x02) ? "en" : "dis") + "able A20");
					machine.setEnableA20((val & 0x02) != 0);
					if (!(val & 0x01)) {
						util.info("KeyboardCntrlr writeHandler() ::"
							+ " Write output port: Processor reset requested!");
						machine.reset(PC.RESET_SOFTWARE);
					}
					break;
				case 0xD4: // Write to mouse
					// [Bochs] I don't think this enables the AUX clock
					// [Bochs] mouse.setClockEnabled(true); // enable aux clock line
					device.sendToMouse(val);
					// [Bochs] ??? should I reset to previous value of aux enable?
					break;
				case 0xD3: // Write mouse output buffer
					// Queue in mouse output buffer
					mouse.enqueueCntrlr(val);
					break;
				case 0xD2:
					// Queue in keyboard output buffer
					keyboard.enqueueCntrlr(val);
					break;
				default:
					util.panic("KeyboardCntrlr writeHandler() ::"
						+ " Unsupported write to port 60h"
						+ "(lastcomm=" + util.format("hex", state.last_comm)
						+ ": " + util.format("hex", val));
				}
			} else {
				// Data byte written last to 0x60
				state.commandOrData = 0;
				state.expecting_port60h = false;
				// Pass byte to keyboard
				// [Bochs] ??? should conditionally pass
				//	to mouse device here ???
				if (!state.kbd_clock_enabled) {
					keyboard.setClockEnabled(true);
				}
				device.sendToKeyboard(val);
			}
			break;
		case 0x64: // Control register
			// Command byte written last to 0x64
			state.commandOrData = 1;
			state.last_comm = val;
			// Most commands NOT expecting port60 write next
			state.expecting_port60h = false;

			switch (val) {
			case 0x20: // Get keyboard command byte
				util.debug("KeyboardCntrlr writeHandler() ::"
					+ " Get keyboard command byte");
				// Controller output buffer must be empty
				if (state.outb) {
					util.problem("KeyboardCntrlr writeHandler() ::"
						+ " OUTB set and command "
						+ util.format("hex", val) + " encountered");
					break;
				}
				// Build command byte & enqueue
				keyboard.enqueueCntrlr(
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
				util.debug("KeyboardCntrlr writeHandler() ::"
						+ " Write command byte");
				// following byte written to port 60h is command byte
				state.expecting_port60h = true;
				break;

			case 0xA0:
				util.debug("KeyboardCntrlr writeHandler() ::"
					+ " Keyboard BIOS name not supported");
				break;

			case 0xA1:
				util.debug("KeyboardCntrlr writeHandler() ::"
					+ " Keyboard BIOS version not supported");
				break;

			case 0xA7: // Disable the aux device
				mouse.setClockEnabled(false);
				util.debug("KeyboardCntrlr writeHandler() ::"
					+ " Aux device (mouse) disabled");
				break;
			case 0xA8: // Enable the aux device
				mouse.setClockEnabled(true);
				util.debug("KeyboardCntrlr writeHandler() ::"
					+ " Aux device (mouse) enabled");
				break;
			case 0xA9: // Test Mouse Port
				// Controller output buffer must be empty
				if (state.outb) {
					util.problem("KeyboardCntrlr writeHandler() ::"
						+ " OUTB set and command " + util.format("hex", val)
						+ " encountered");
					break;
				}
				keyboard.enqueueCntrlr(0x00); // No errors detected
				break;
			case 0xAA: // Motherboard controller self test
				util.debug("KeyboardCntrlr writeHandler() ::"
					+ " Motherboard cntrlr Self Test");
				//debugger;
				if (!device.inited) {
					state.sizeQueue = 0;
					state.outb = 0;
					device.inited = true;
				}
				// Controller output buffer must be empty
				if (state.outb) {
					util.problem("KeyboardCntrlr writeHandler() ::"
						+ " OUTB set and command " + util.format("hex", val)
						+ " encountered");
					break;
				}
				// [Bochs] (mch) Why is this commented out??? Enabling
				state.sysf = 1; // Self test complete
				keyboard.enqueueCntrlr(0x55); // controller OK
				break;
			case 0xAB: // Interface Test
				// Controller output buffer must be empty
				if (state.outb) {
					util.problem("KeyboardCntrlr writeHandler() ::"
						+ " OUTB set and command " + util.format("hex", val)
						+ " encountered");
					break;
				}
				keyboard.enqueueCntrlr(0x00);
				break;
			case 0xAD: // Disable keyboard
				keyboard.setClockEnabled(false);
				util.debug("KeyboardCntrlr writeHandler() :: Keyboard disabled");
				break;
			case 0xAE: // Enable keyboard
				keyboard.setClockEnabled(true);
				util.debug("KeyboardCntrlr writeHandler() :: Keyboard enabled");
				break;
			case 0xAF: // Get controller version
				util.info("KeyboardCntrlr writeHandler() ::"
					+ " 'get controller version' not supported yet");
				break;
			case 0xC0: // Read input port
				// Controller output buffer must be empty
				if (state.outb) {
					util.problem("KeyboardCntrlr writeHandler() ::"
						+ " OUTB set and command " + util.format("hex", val)
						+ " encountered");
					break;
				}
				// Keyboard not inhibited
				keyboard.enqueueCntrlr(0x80);
				break;
			case 0xCA: // Read keyboard controller mode
				keyboard.enqueueCntrlr(0x01); // PS/2 (MCA)interface
				break;
			case 0xCB: // Write keyboard controller mode
				util.debug("KeyboardCntrlr writeHandler() ::"
					+ " Write keyboard controller mode");
				// Write keyboard controller mode to bit 0 of port 0x60
				state.expecting_port60h = true;
				break;
			case 0xD0: // Read output port: next byte read from port 60h
				util.debug("KeyboardCntrlr writeHandler() ::"
					+ " I/O write to port 64h, command d0h (partial)");
				// Controller output buffer must be empty
				if (state.outb) {
					util.problem("KeyboardCntrlr writeHandler() ::"
						+ " OUTB set and command " + util.format("hex", val)
						+ " encountered");
					break;
				}
				keyboard.enqueueCntrlr(
					(state.irq12_requested << 5)
					| (state.irq1_requested << 4)
					| (machine.getEnableA20() << 1)
					| 0x01
				);
				break;

			case 0xD1: // Write output port: next byte written to port 60h
				util.debug("KeyboardCntrlr writeHandler() ::"
					+ " Write output port");
				// Following byte to port 60h written to output port
				state.expecting_port60h = true;
				break;

			case 0xD3: // Write mouse output buffer
				// [Bochs] FIXME: Why was this a panic?
				util.debug("KeyboardCntrlr writeHandler() ::"
						+ " I/O write 0x64: command = 0xD3(write mouse outb)");
				// Following byte to port 60h
				//	written to output port as mouse write
				state.expecting_port60h = true;
				break;

			case 0xD4: // Write to mouse
				util.debug("KeyboardCntrlr writeHandler() ::"
						+ " I/O write 0x64: command = 0xD4 (write to mouse)");
				// following byte written to port 60h
				state.expecting_port60h = true;
				break;

			case 0xD2: // Write keyboard output buffer
				util.debug("KeyboardCntrlr writeHandler() ::"
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
				util.panic("KeyboardCntrlr writeHandler() ::"
					+ " I/O write 0x64: command = " + util.format("hex", val));
				break;

			case 0xFE: // System (cpu?) Reset, transition to real mode
				util.info("KeyboardCntrlr writeHandler() ::"
					+ " I/O write 0x64: command 0xfe: reset cpu");
				machine.reset(PC.RESET_SOFTWARE);
				break;

			default:
				if (val === 0xFF || (value >= 0xF0 && value <= 0xFD)) {
					// Useless pulse output bit commands ???
					util.debug("KeyboardCntrlr writeHandler() ::"
						+ " I/O write to port 64h, useless command "
						+ util.format("hex", val));
					return;
				}
				util.problem("KeyboardCntrlr writeHandler() ::"
					+ " Unsupported io write to keyboard port 0x64"
					+ ", value = " + util.format("hex", val));
				break;
			}
			break;
		default:
			util.problem("KeyboardCntrlr writeHandler() :: Unsupported read, address="
				+ util.format("hex", addr) + "!");
			return 0;
		}
	}

	// Periodic timer handler (see KeyboardCntrlr.init())
	//	Based on [bx_keyb_c::timer_handler]
	function handleTimer(ticksNow) {
		var retval = this.periodic(1);

		if (retval & 0x01) {
			this.machine.pic.raiseIRQ(1);
		}
		/** No "else", both IRQs may be needed **/
		if (retval & 0x02) {
			this.machine.pic.raiseIRQ(12);
		}
	}
	/* ====== /Private ====== */

	// Exports
	return KeyboardCntrlr;
});
