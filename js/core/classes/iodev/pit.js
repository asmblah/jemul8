/*
 * jemul8 - JavaScript x86 Emulator
 *
 * MODULE: Programmable Interval Timer (PIT) wrapper class support
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
	"../iodev/pit/82c54"
], function (
	util,
	IODevice,
	PIT_82C54
) {
    "use strict";

	// Microseconds (us) === 1000 * 1000 per second,
	//  but clock signal is 1193181 (because of oscillator/crystal).
	//  Slight difference between the two, but enough to warrant additional
	//  calculations for accuracy.

	var USEC_PER_SECOND = 1000000    // Of course: 1000ms * 1000 = us, but...
		, TICKS_PER_SECOND = 1193181 // ... because of 1.193181MHz clock.
		;

	/* === Macros === */
	var TICKS_TO_USEC = function (a) {
		return Math.floor((a * USEC_PER_SECOND) / TICKS_PER_SECOND);
	}, USEC_TO_TICKS = function (a) {
		return Math.floor((a * TICKS_PER_SECOND) / USEC_PER_SECOND);
	};
	/* === /Macros === */

	// Constructor / pre-init
	function PIT(machine) {
		util.assert(this && (this instanceof PIT), "PIT ctor ::"
			+ " error - constructor not called properly");

		/** 8254/82C54 Programmable Interval Timer (PIT) **/

		util.info("PIT (Intel 8254/82C54) PreInit");

		this.machine = machine;

		this.state = {
			/* PIT_82c54 */timer: new PIT_82C54(this)
			, speaker_data_on: 0x00
			, refresh_clock_div2: false
			, last_usec: 0x00000000 // Should be 64-bit
			, last_next_event_time: 0x00000000
			, total_ticks: 0x00000000 // Should be 64-bit
			, total_usec: 0x00000000 // Should be 64-bit
			, timer_handle: null
		};
	}
	util.inherit(PIT, IODevice, "PIT"); // Inheritance
	util.extend(PIT.prototype, {
		init: function (done, fail) {
			var machine = this.machine, state = this.state;

			// Make a note that IRQ #0 is used by the PIT
			this.registerIRQ(0, "8254 PIT");

			this.registerIO_Read(0x0040, "8254 PIT", readHandler, 1);
			this.registerIO_Read(0x0041, "8254 PIT", readHandler, 1);
			this.registerIO_Read(0x0042, "8254 PIT", readHandler, 1);
			this.registerIO_Read(0x0043, "8254 PIT", readHandler, 1);
			this.registerIO_Read(0x0061, "8254 PIT", readHandler, 1);

			this.registerIO_Write(0x0040, "8254 PIT", writeHandler, 1);
			this.registerIO_Write(0x0041, "8254 PIT", writeHandler, 1);
			this.registerIO_Write(0x0042, "8254 PIT", writeHandler, 1);
			this.registerIO_Write(0x0043, "8254 PIT", writeHandler, 1);
			this.registerIO_Write(0x0061, "8254 PIT", writeHandler, 1);

			util.debug(("starting init"));

			state.speaker_data_on = 0;
			state.refresh_clock_div2 = 0;

			state.timer.init();
			state.timer.set_OUT_handler(0, this, this.irq_handler);

			var my_time_usec = machine.getTimeUsecs();

			if (state.timer_handle == null) {
				state.timer_handle = machine.registerTimer(
					this.timer_handler, this, 100, true, true, "PIT"
				);
			}
			util.debug(("PIT.init() :: RESETting timer."));
			state.timer_handle.deactivate();
			util.debug(("deactivated timer."));
			if (state.timer.get_next_event_time()) {
				state.timer_handle.activate(
					state.timer_handle
					, Math.max(1, TICKS_TO_USEC(state.timer.get_next_event_time()))
					, false
				);
				util.debug(("activated timer."));
			}
			state.last_next_event_time = state.timer.get_next_event_time();
			state.last_usec = my_time_usec;

			state.total_ticks = 0;
			state.total_usec = 0;

			util.debug(("finished init"));

			util.debug(util.sprintf(
				"s.last_usec=%lld"
				, state.last_usec
			));
			util.debug(util.sprintf(
				"s.timer.get_next_event_time=%d"
				, state.timer.get_next_event_time()
			));
			util.debug(util.sprintf(
				"s.last_next_event_time=%d"
				, state.last_next_event_time
			));

			done();
		// Based on [bx_pit_c::reset]
		}, reset: function (type) {
			this.state.timer.reset(type);
		// Based on [bx_pit_c::timer_handler]
		}, timer_handler: function (ticksNow) {
			// TODO: Merge this with .handle_timer() ?
			this.handle_timer();
		// Based on [bx_pit_c::handle_timer]
		}, handle_timer: function () {
			var machine = this.machine, state = this.state
				, my_time_usec = machine.getTimeUsecs();
			var time_passed = my_time_usec - state.last_usec;
			var time_passed32 = time_passed & 0xFFFFFFFF;

			util.debug(("entering timer handler"));

			if (time_passed32) {
				this.periodic(time_passed32);
			}
			state.last_usec = state.last_usec + time_passed;
			if ( time_passed
				|| (state.last_next_event_time != state.timer.get_next_event_time())
			) {
				util.debug(("PIT.handle_timer() :: RESETting timer"));
				state.timer_handle.deactivate();
				util.debug(("deactivated timer"));
				if (state.timer.get_next_event_time()) {
					state.timer_handle.activate(
						state.timer_handle
						, Math.max(1, TICKS_TO_USEC(state.timer.get_next_event_time()))
						, false
					);
					util.debug(("activated timer"));
				}
				state.last_next_event_time = state.timer.get_next_event_time();
			}
			util.debug(util.sprintf(
				"s.last_usec=%lld"
				, state.last_usec
			));
			util.debug(util.sprintf(
				"s.timer.get_next_event_time=%x"
				, state.timer.get_next_event_time()
			));
			util.debug(util.sprintf(
				"s.last_next_event_time=%d"
				, state.last_next_event_time
			));
		}, periodic: function (usec_delta) {//return;
			var state = this.state
				, ticks_delta = 0;

			state.total_usec += usec_delta;
			ticks_delta = ((USEC_TO_TICKS(state.total_usec)) - state.total_ticks) & 0xFFFFFFFF;
			state.total_ticks += ticks_delta;
			//debugger;

			// Modulus: get ticks & microseconds down to < one second
			//          (modulo 1 second)
			while ( (state.total_ticks >= TICKS_PER_SECOND)
				&& (state.total_usec >= USEC_PER_SECOND)
			) {
				state.total_ticks -= TICKS_PER_SECOND;
				state.total_usec  -= USEC_PER_SECOND;
			}

			var a = 0;
			while (ticks_delta > 0) {
				// TEMP: FIXME
				//if (++a > 1000) { debugger; break; }

				var maxchange = state.timer.get_next_event_time();
				var timedelta = maxchange;
				if ((maxchange == 0) || (maxchange > ticks_delta)) {
					timedelta = ticks_delta;
				}
				state.timer.clock_all(timedelta);
				ticks_delta -= timedelta;
			}

			return 0;
		// Based on [bx_pit_c::irq_handler]
		}, irq_handler: function (val) {
			var machine = this.machine;
			if (val == 1) {
				machine.pic.raiseIRQ(0);
			} else {
				machine.pic.lowerIRQ(0);
			}
		// Based on [bx_pit_c::get_timer]
		}, get_timer: function (timer) {
			return this.state.timer.get_inlatch(timer);
		}
	});

	/* ====== Private ====== */
	// PIT chip's I/O read operations' handler routine
	function readHandler(device, addr, io_len) {
		var machine = device.machine, state = device.state // "device" will be PIT
			, result8 // 8-bit result
			;
		//debugger;

		device.handle_timer();

		var my_time_usec = machine.getTimeUsecs();

		/** NB: This is an 8254/82C54 Programmable Interval Timer (PIT) **/

		switch (addr) {
		case 0x40: /* timer 0 - system ticks */
			result8 = state.timer.read(0);
			break;
		case 0x41: /* timer 1 read */
			result8 = state.timer.read(1);
			break;
		case 0x42: /* timer 2 read */
			result8 = state.timer.read(2);
			break;
		case 0x43: /* timer 1 read */
			result8 = state.timer.read(3);
			break;

		case 0x61:
			/* AT, port 61h */
			state.refresh_clock_div2 = !!((my_time_usec / 15) & 1);
			result8 = (state.timer.read_OUT(2) << 5)
				| (state.refresh_clock_div2 << 4)
				| (state.speaker_data_on << 1)
				| (state.timer.read_GATE(2) ? 1 : 0);
			break;
		default:
			util.panic(util.sprintf(
				"PIT readHandler() :: Unsupported read from port 0x%04X!"
				, addr
			));
			return 0;
		}
		util.debug(util.sprintf(
			"PIT readHandler() :: Read from port 0x%04X, value = 0x%02X"
			, addr, result8
		));
		return result8;
	}
	// PIT chip's I/O write operations' handler routine
	function writeHandler(device, addr, val, io_len) {
		var machine = device.machine, state = device.state // "device" will be PIT
			, val8;
		//debugger;

		var my_time_usec = machine.getTimeUsecs();
		var time_passed = my_time_usec - state.last_usec;
		var time_passed32 = time_passed & 0xFFFFFFFF;

		if (time_passed32) {
			device.periodic(time_passed32);
		}
		state.last_usec += time_passed;

		val8 = val & 0xFF; // Cast to 8-bit

		util.debug(util.sprintf(
			"PIT writeHandler() :: Write to port 0x%04X, value = 0x%02X"
			, addr, val8
		));

		/** NB: This is an 8254/82C54 Programmable Interval Timer (PIT) **/

		switch (addr) {
		case 0x40: /* timer 0: write count register */
			state.timer.write(0, val8);
			break;

		case 0x41: /* timer 1: write count register */
			state.timer.write(1, val8);
			break;

		case 0x42: /* timer 2: write count register */
			state.timer.write(2, val8);
			break;

		case 0x43: /* timer 0-2 mode control */
			state.timer.write(3, val8);
			break;

		case 0x61:
			state.speaker_data_on = (val8 >> 1) & 0x01;
			if (state.speaker_data_on) {
				//DEV_speaker_beep_on((float)(1193180.0 / BX_PIT_THIS get_timer(2)));
			} else {
				//DEV_speaker_beep_off();
			}
			/* ??? only on AT+ */
			state.timer.set_GATE(2, val8 & 0x01);
			break;

		default:
			util.panic(util.sprintf(
				"PIT writeHandler() :: Unsupported write to port 0x%04X, value = 0x%02X!"
				, addr, val
			));
			return 0;
		}
		if ( time_passed
			|| (state.last_next_event_time != state.timer.get_next_event_time())
		) {
			util.debug(("RESETting timer"));
			state.timer_handle.deactivate();
			util.debug(("deactivated timer"));
			if (state.timer.get_next_event_time()) {
				state.timer_handle.activate(
					state.timer_handle
					, Math.max(1, TICKS_TO_USEC(state.timer.get_next_event_time()))
					, false
				);
				util.debug(("activated timer"));
			}
			state.last_next_event_time = state.timer.get_next_event_time();
		}
		util.debug(util.sprintf(
			"s.last_usec=%lld"
			, state.last_usec
		));
		util.debug(util.sprintf(
			"s.timer.get_next_event_time=%x"
			, state.timer.get_next_event_time()
		));
		util.debug(util.sprintf(
			"s.last_next_event_time=%d"
			, state.last_next_event_time
		));
	}
	/* ====== /Private ====== */

	// Exports
	return PIT;
});
