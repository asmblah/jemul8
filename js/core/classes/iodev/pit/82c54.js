/*
 * jemul8 - JavaScript x86 Emulator
 *
 * MODULE: Intel 8254/82C54 Programmable Interval Timer (PIT) class support
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
	"../../../util"
], function (
	util
) {
    "use strict";

	/* ==== Const ==== */
	var MAX_COUNTER = 2, MAX_ADDRESS = 3, CONTROL_ADDRESS = 3, MAX_MODE = 5
	// rw_status
		, LSByte = 0, MSByte = 1, LSByte_multiple = 2, MSByte_multiple = 3
	// real_RW_status
		, LSB_real = 1, MSB_real = 2, BOTH_real = 3
	// problem_type
		, UNL_2P_READ = 1
		;
	/* ==== /Const ==== */

	// TODO: Should be a config setting
	var enableDebug = false;

	var debug = enableDebug ? function (msg) {
		util.debug(msg);
	} : function () {};

	// Constructor / pre-init
	function PIT_82C54(wrapper) {
		util.assert(this && (this instanceof PIT_82C54), "PIT_82C54 ctor ::"
			+ " error - constructor not called properly");

		this.wrapper = wrapper;

		this.counter = [
			new Counter(), new Counter(), new Counter()
		];
		this.controlword = 0xFF;
		this.seen_problems = 0;

		this.init();
	}
	util.extend(PIT_82C54.prototype, {
		print_counter: function (thisctr) {
			util.info(("Printing Counter"));
			util.info(util.sprintf(
				"count: %d"
				, thisctr.count));
			util.info(util.sprintf(
				"count_binary: %x"
				, thisctr.count_binary
			));
			util.info(util.sprintf(
				"counter gate: %x"
				, thisctr.GATE
			));
			util.info(util.sprintf(
				"counter OUT: %x"
				, thisctr.OUTpin
			));
			util.info(util.sprintf(
				"next_change_time: %d"
				, thisctr.next_change_time
			));
			util.info(("End Counter Printout"));
		}, print_cnum: function (cnum) {
			if (cnum > 0xFF) {
				util.problem("PIT_82C54.print_cnum() :: Must be 8-bit");
			}
			if (cnum > MAX_COUNTER) {
				util.problem(("Bad counter index to print_cnum"));
			} else {
				this.print_counter(this.counter[ cnum ]);
			}
		}, latch_counter: function (thisctr) {
			if (thisctr.count_LSB_latched || thisctr.count_MSB_latched) {
				// [Bochs] Do nothing because previous latch has not been read.;
			} else {
				switch (thisctr.read_state) {
				case MSByte:
					thisctr.outlatch = thisctr.count & 0xFFFF;
					thisctr.count_MSB_latched = 1;
					break;
				case LSByte:
					thisctr.outlatch = thisctr.count & 0xFFFF;
					thisctr.count_LSB_latched = 1;
					break;
				case LSByte_multiple:
					thisctr.outlatch = thisctr.count & 0xFFFF;
					thisctr.count_LSB_latched = 1;
					thisctr.count_MSB_latched = 1;
					break;
				case MSByte_multiple:
					if (!(this.seen_problems & UNL_2P_READ)) {
						// this.seen_problems |= UNL_2P_READ;
						util.problem(("Unknown behavior when latching during 2-part read."));
						util.problem(("  This message will not be repeated."));
					}
					// [Bochs] I guess latching and resetting to LSB first makes sense;
					debug(("Setting read_state to LSB_mult"));
					thisctr.read_state = LSByte_multiple;
					thisctr.outlatch = thisctr.count & 0xFFFF;
					thisctr.count_LSB_latched = 1;
					thisctr.count_MSB_latched = 1;
					break;
				default:
					util.problem(("Unknown read mode found during latch command."));
				}
			}
		}, set_OUT: function (thisctr, data) {
			if (thisctr.OUTpin != data) {
				thisctr.OUTpin = data;
				if (thisctr.out_handler != null) {
					thisctr.out_handler[ 1 ].call(thisctr.out_handler[ 0 ], data);
				}
			}
		}, set_count: function (thisctr, data) {
			thisctr.count = data & 0xFFFF;
			this.set_binary_to_count(thisctr);
		}, set_count_to_binary: function (thisctr) {
			if (thisctr.bcd_mode) {
				thisctr.count =
					(((thisctr.count_binary/1)%10)<<0) |
					(((thisctr.count_binary/10)%10)<<4) |
					(((thisctr.count_binary/100)%10)<<8) |
					(((thisctr.count_binary/1000)%10)<<12);
			} else {
				thisctr.count = thisctr.count_binary;
			}
		}, set_binary_to_count: function (thisctr) {
			if (thisctr.bcd_mode) {
				thisctr.count_binary =
					(1*((thisctr.count>>0)&0xF)) +
					(10*((thisctr.count>>4)&0xF)) +
					(100*((thisctr.count>>8)&0xF)) +
					(1000*((thisctr.count>>12)&0xF));
			} else {
				thisctr.count_binary = thisctr.count;
			}
		}, decrement: function (thisctr) {
			if (!thisctr.count) {
				if (thisctr.bcd_mode) {
					thisctr.count = 0x9999;
					thisctr.count_binary = 9999;
				} else {
					thisctr.count = 0xFFFF;
					thisctr.count_binary = 0xFFFF;
				}
			} else {
				thisctr.count_binary--;
				this.set_count_to_binary(thisctr);
			}
		}, init: function () {
			var i;

			for (i = 0 ; i < 3 ; i++) {
				this.counter[ i ].init();
			}
			this.seen_problems = 0;
		}, reset: function (type) {
			// ???
		}, register_state: function () {
		}, decrement_multiple: function (thisctr, cycles) {
			while (cycles > 0) {
				if (cycles <= thisctr.count_binary) {
					thisctr.count_binary -= cycles;
					cycles -= cycles;
					this.set_count_to_binary(thisctr);
				} else {
					cycles -= (thisctr.count_binary + 1);
					thisctr.count_binary -= thisctr.count_binary;
					this.set_count_to_binary(thisctr);
					this.decrement(thisctr);
				}
			}
		}, clock_multiple: function (cnum, cycles) {
			if (cnum > MAX_COUNTER) {
				util.problem(("Counter number too high in clock"));
			} else {
				var thisctr = this.counter[ cnum ];
				while (cycles > 0) {
					if (thisctr.next_change_time == 0) {
						if (thisctr.count_written) {
							switch (thisctr.mode) {
							case 0:
								if (thisctr.GATE && (thisctr.write_state != MSByte_multiple)) {
									this.decrement_multiple(thisctr, cycles);
								}
								break;
							case 1:
								this.decrement_multiple(thisctr, cycles);
								break;
							case 2:
								if (!thisctr.first_pass && thisctr.GATE) {
									this.decrement_multiple(thisctr, cycles);
								}
								break;
							case 3:
								if (!thisctr.first_pass && thisctr.GATE) {
									this.decrement_multiple(thisctr, 2 * cycles);
								}
								break;
							case 4:
								if (thisctr.GATE) {
									this.decrement_multiple(thisctr, cycles);
								}
								break;
							case 5:
								this.decrement_multiple(thisctr, cycles);
								break;
							default:
							}
						}
						cycles -= cycles;
					} else {
						switch (thisctr.mode) {
						case 0:
						case 1:
						case 2:
						case 4:
						case 5:
							if (thisctr.next_change_time > cycles) {
								this.decrement_multiple(thisctr,cycles);
								thisctr.next_change_time -= cycles;
								cycles -= cycles;
							} else {
								this.decrement_multiple(thisctr, (thisctr.next_change_time - 1));
								cycles -= thisctr.next_change_time;
								this.clock(cnum);
							}
							break;
						case 3:
							if (thisctr.next_change_time > cycles) {
								this.decrement_multiple(thisctr,cycles * 2);
								thisctr.next_change_time -= cycles;
								cycles -= cycles;
							} else {
								this.decrement_multiple(thisctr, (thisctr.next_change_time - 1) * 2);
								cycles -= thisctr.next_change_time;
								this.clock(cnum);
							}
							break;
						default:
							cycles -= cycles;
						}
					}
				}
				//#if 0
				//this.print_counter(thisctr);
				//#endif
			}
		}, clock: function (cnum) {
			if (cnum > MAX_COUNTER) {
				util.problem(("Counter number too high in clock"));
			} else {
				var thisctr = this.counter[ cnum ];
				switch (thisctr.mode) {
				case 0:
					if (thisctr.count_written) {
						if (thisctr.null_count) {
							this.set_count(thisctr, thisctr.inlatch);
							if (thisctr.GATE) {
								if (thisctr.count_binary == 0) {
									thisctr.next_change_time = 1;
								} else {
									thisctr.next_change_time = thisctr.count_binary & 0xFFFF;
								}
							} else {
								thisctr.next_change_time = 0;
							}
							thisctr.null_count = 0;
						} else {
							if (thisctr.GATE && (thisctr.write_state != MSByte_multiple)) {
								this.decrement(thisctr);
								if (!thisctr.OUTpin) {
									thisctr.next_change_time = thisctr.count_binary & 0xFFFF;
									if (!thisctr.count) {
										this.set_OUT(thisctr,1);
									}
								} else {
									thisctr.next_change_time = 0;
								}
							} else {
								thisctr.next_change_time = 0; //if the clock isn't moving.
							}
						}
					} else {
						thisctr.next_change_time = 0; //default to 0.
					}
					thisctr.triggerGATE=0;
					break;
				case 1:
					if (thisctr.count_written) {
						if (thisctr.triggerGATE) {
							this.set_count(thisctr, thisctr.inlatch);
							if (thisctr.count_binary == 0) {
								thisctr.next_change_time = 1;
							} else {
								thisctr.next_change_time = thisctr.count_binary & 0xFFFF;
							}
							thisctr.null_count = 0;
							this.set_OUT(thisctr, 0);
							if (thisctr.write_state == MSByte_multiple) {
								util.problem(("Undefined behavior when loading a half loaded count."));
							}
						} else {
							this.decrement(thisctr);
							if (!thisctr.OUTpin) {
								if (thisctr.count_binary == 0) {
									thisctr.next_change_time = 1;
								} else {
									thisctr.next_change_time = thisctr.count_binary & 0xFFFF;
								}
								if (thisctr.count == 0) {
									this.set_OUT(thisctr,1);
								}
							} else {
								thisctr.next_change_time=0;
							}
						}
					} else {
						thisctr.next_change_time = 0; //default to 0.
					}
					thisctr.triggerGATE = 0;
					break;
				case 2:
					if (thisctr.count_written) {
						if (thisctr.triggerGATE || thisctr.first_pass) {
							this.set_count(thisctr, thisctr.inlatch);
							thisctr.next_change_time = (thisctr.count_binary - 1) & 0xFFFF;
							thisctr.null_count = 0;
							if (thisctr.inlatch == 1) {
								util.problem(("ERROR: count of 1 is invalid in pit mode 2."));
							}
							if (!thisctr.OUTpin) {
								this.set_OUT(thisctr, 1);
							}
							if (thisctr.write_state == MSByte_multiple) {
								util.problem(("Undefined behavior when loading a half loaded count."));
							}
							thisctr.first_pass = 0;
						} else {
							if (thisctr.GATE) {
								this.decrement(thisctr);
								thisctr.next_change_time = (thisctr.count_binary - 1) & 0xFFFF;
								if (thisctr.count == 1) {
									thisctr.next_change_time = 1;
									this.set_OUT(thisctr, 0);
									thisctr.first_pass = 1;
								}
							} else {
								thisctr.next_change_time = 0;
							}
						}
					} else {
						thisctr.next_change_time = 0;
					}
					thisctr.triggerGATE = 0;
					break;
				case 3:
					if (thisctr.count_written) {
						if ( (thisctr.triggerGATE || thisctr.first_pass
							|| thisctr.state_bit_2) && thisctr.GATE
						) {
							this.set_count(thisctr, thisctr.inlatch & 0xFFFE);
							thisctr.state_bit_1 = thisctr.inlatch & 0x1;
							if (!thisctr.OUTpin || !thisctr.state_bit_1) {
								if (((thisctr.count_binary / 2) - 1) == 0) {
									thisctr.next_change_time = 1;
								} else {
									thisctr.next_change_time = ((thisctr.count_binary / 2) - 1) & 0xFFFF;
								}
							} else {
								if ((thisctr.count_binary / 2) == 0) {
									thisctr.next_change_time = 1;
								} else {
									thisctr.next_change_time = (thisctr.count_binary / 2) & 0xFFFF;
								}
							}
							thisctr.null_count = 0;
							if (thisctr.inlatch == 1) {
								util.problem(("Count of 1 is invalid in pit mode 3."));
							}
							if (!thisctr.OUTpin) {
								this.set_OUT(thisctr, 1);
							} else if (thisctr.OUTpin && !thisctr.first_pass) {
								this.set_OUT(thisctr, 0);
							}
							if (thisctr.write_state == MSByte_multiple) {
								util.problem(("Undefined behavior when loading a half loaded count."));
							}
							thisctr.state_bit_2 = 0;
							thisctr.first_pass = 0;
						} else {
							if (thisctr.GATE) {
								this.decrement(thisctr);
								this.decrement(thisctr);
								if (!thisctr.OUTpin || !thisctr.state_bit_1) {
									thisctr.next_change_time = ((thisctr.count_binary / 2) - 1) & 0xFFFF;
								} else {
									thisctr.next_change_time = (thisctr.count_binary / 2) & 0xFFFF;
								}
								if (thisctr.count == 0) {
									thisctr.state_bit_2 = 1;
									thisctr.next_change_time = 1;
								}
								if ( (thisctr.count==2)
									&& (!thisctr.OUTpin || !thisctr.state_bit_1)
								) {
									thisctr.state_bit_2 = 1;
									thisctr.next_change_time = 1;
								}
							} else {
								thisctr.next_change_time = 0;
							}
						}
					} else {
						thisctr.next_change_time = 0;
					}
					thisctr.triggerGATE = 0;
					break;
				case 4:
					if (thisctr.count_written) {
						if (!thisctr.OUTpin) {
							this.set_OUT(thisctr, 1);
						}
						if (thisctr.null_count) {
							this.set_count(thisctr, thisctr.inlatch);
							if (thisctr.GATE) {
								if (thisctr.count_binary == 0) {
									thisctr.next_change_time = 1;
								} else {
									thisctr.next_change_time = thisctr.count_binary & 0xFFFF;
								}
							} else {
								thisctr.next_change_time = 0;
							}
							thisctr.null_count = 0;
							if (thisctr.write_state == MSByte_multiple) {
								util.problem(("Undefined behavior when loading a half loaded count."));
							}
							thisctr.first_pass = 1;
						} else {
							if (thisctr.GATE) {
								this.decrement(thisctr);
								if (thisctr.first_pass) {
									thisctr.next_change_time = thisctr.count_binary & 0xFFFF;
									if (!thisctr.count) {
										this.set_OUT(thisctr, 0);
										thisctr.next_change_time = 1;
										thisctr.first_pass = 0;
									}
								} else {
									thisctr.next_change_time = 0;
								}
							} else {
								thisctr.next_change_time = 0;
							}
						}
					} else {
						thisctr.next_change_time = 0;
					}
					thisctr.triggerGATE = 0;
					break;
				case 5:
					if (thisctr.count_written) {
						if (!thisctr.OUTpin) {
							this.set_OUT(thisctr, 1);
						}
						if (thisctr.triggerGATE) {
							this.set_count(thisctr, thisctr.inlatch);
							if (thisctr.count_binary == 0) {
								thisctr.next_change_time = 1;
							} else {
								thisctr.next_change_time = thisctr.count_binary & 0xFFFF;
							}
							thisctr.null_count = 0;
							if (thisctr.write_state == MSByte_multiple) {
								util.problem(("Undefined behavior when loading a half loaded count."));
							}
							thisctr.first_pass = 1;
						} else {
							this.decrement(thisctr);
							if (thisctr.first_pass) {
								thisctr.next_change_time = thisctr.count_binary & 0xFFFF;
								if (!thisctr.count) {
									this.set_OUT(thisctr, 0);
									thisctr.next_change_time = 1;
									thisctr.first_pass = 0;
								}
							} else {
								thisctr.next_change_time = 0;
							}
						}
					} else {
						thisctr.next_change_time = 0;
					}
					thisctr.triggerGATE = 0;
					break;
				default:
					util.problem(("Mode not implemented."));
					thisctr.next_change_time = 0;
					thisctr.triggerGATE = 0;
					break;
				}
			}
		}, clock_all: function (cycles) {
			debug(util.sprintf(
				"clock_all: cycles=%d"
				, cycles
			));
			this.clock_multiple(0, cycles);
			this.clock_multiple(1, cycles);
			this.clock_multiple(2, cycles);
		}, read: function (address) {
			if (address > MAX_ADDRESS) {
				util.problem(("Counter address incorrect in data read."));
			} else if (address == CONTROL_ADDRESS) {
				debug(("PIT Read: Control Word Register."));
				// Read from control word register;
				/* This might be okay.  If so, 0 seems the most logical
				*  return value from looking at the docs.
				*/
				util.problem(("Read from control word register not defined."));
				return 0;
			} else {
				// Read from a counter;
				debug(util.sprintf(
					"PIT Read: Counter %d."
					, address
				));
				var thisctr = this.counter[ address ];
				if (thisctr.status_latched) {
					// Latched Status Read;
					if ( thisctr.count_MSB_latched
						&& (thisctr.read_state == MSByte_multiple)
					) {
						util.problem(("Undefined output when status latched and count half read."));
					} else {
						thisctr.status_latched = 0;
						return thisctr.status_latch;
					}
				} else {
					// Latched Count Read;
					if (thisctr.count_LSB_latched) {
						// Read Least Significant Byte;
						if (thisctr.read_state == LSByte_multiple) {
							debug(("Setting read_state to MSB_mult"));
							thisctr.read_state = MSByte_multiple;
						}
						thisctr.count_LSB_latched = 0;
						return (thisctr.outlatch & 0xFF);
					} else if (thisctr.count_MSB_latched) {
						// Read Most Significant Byte;
						if (thisctr.read_state == MSByte_multiple) {
							debug(("Setting read_state to LSB_mult"));
							thisctr.read_state = LSByte_multiple;
						}
						thisctr.count_MSB_latched = 0;
						return ((thisctr.outlatch >> 8) & 0xFF);
					} else {
						// Unlatched Count Read;
						if (!(thisctr.read_state & 0x1)) {
							// Read Least Significant Byte;
							if (thisctr.read_state == LSByte_multiple) {
								thisctr.read_state = MSByte_multiple;
								debug(("Setting read_state to MSB_mult"));
							}
							return (thisctr.count & 0xFF);
						} else {
							//Read Most Significant Byte;
							if (thisctr.read_state == MSByte_multiple) {
								debug(("Setting read_state to LSB_mult"));
								thisctr.read_state = LSByte_multiple;
							}
							return ((thisctr.count >> 8) & 0xFF);
						}
					}
				}
			}

			// Should only get here on errors;
			return 0;
		}, write: function (address, data) {
			if (address > MAX_ADDRESS) {
				util.problem(("Counter address incorrect in data write."));
			} else if (address == CONTROL_ADDRESS) {
				var SC, RW, M, BCD;
				this.controlword = data;
				debug(("Control Word Write."));
				SC = (this.controlword >> 6) & 0x3;
				RW = (this.controlword >> 4) & 0x3;
				M = (this.controlword >> 1) & 0x7;
				BCD = this.controlword & 0x1;
				if (SC == 3) {
					// [Bochs] READ_BACK command;
					var i;
					debug(("READ_BACK command."));
					for(i = 0 ; i <= MAX_COUNTER ; i++) {
						if ((M >> i) & 0x1) {
							// [Bochs] If we are using this counter;
							var thisctr = this.counter[ i ];
							if (!((this.controlword>>5) & 1)) {
								// [Bochs] Latch Count;
								this.latch_counter(thisctr);
							}
							if (!((this.controlword>>4) & 1)) {
								// [Bochs] Latch Status;
								if (thisctr.status_latched) {
									// [Bochs] Do nothing because latched status has not been read.;
								} else {
									thisctr.status_latch =
										((thisctr.OUTpin & 0x1) << 7) |
										((thisctr.null_count & 0x1) << 6) |
										((thisctr.rw_mode & 0x3) << 4) |
										((thisctr.mode & 0x7) << 1) |
										(thisctr.bcd_mode & 0x1);
									thisctr.status_latched = 1;
								}
							}
						}
					}
				} else {
					var thisctr = this.counter[ SC ];
					if (!RW) {
						// [Bochs] Counter Latch command;
						debug(util.sprintf(
							"Counter Latch command.  SC=%d"
							, SC
						));
						this.latch_counter(thisctr);
					} else {
						// [Bochs] Counter Program Command;
						debug(util.sprintf(
							"Counter Program command.  SC=%d, RW=%d, M=%d, BCD=%d"
							, SC, RW, M, BCD
						));
						thisctr.null_count = 1;
						thisctr.count_LSB_latched = 0;
						thisctr.count_MSB_latched = 0;
						thisctr.status_latched = 0;
						thisctr.inlatch = 0;
						thisctr.count_written = 0;
						thisctr.first_pass = 1;
						thisctr.rw_mode = RW;
						thisctr.bcd_mode = (BCD > 0);
						thisctr.mode = M;
						switch (RW) {
						case 0x1:
							debug(("Setting read_state to LSB"));
							thisctr.read_state = LSByte;
							thisctr.write_state = LSByte;
							break;
						case 0x2:
							debug(("Setting read_state to MSB"));
							thisctr.read_state = MSByte;
							thisctr.write_state = MSByte;
							break;
						case 0x3:
							debug(("Setting read_state to LSB_mult"));
							thisctr.read_state = LSByte_multiple;
							thisctr.write_state = LSByte_multiple;
							break;
						default:
							util.problem(("RW field invalid in control word write."));
						}
						// [Bochs] All modes except mode 0 have initial output of 1.;
						if (M) {
							this.set_OUT(thisctr, 1);
						} else {
							this.set_OUT(thisctr, 0);
						}
						thisctr.next_change_time = 0;
					}
				}
			} else {
				// [Bochs] Write to counter initial value.
				var thisctr = this.counter[ address ];
				debug(util.sprintf(
					"Write Initial Count: counter=%d, count=%d"
					, address, data
				));
				switch (thisctr.write_state) {
				case LSByte_multiple:
					thisctr.inlatch = data;
					thisctr.write_state = MSByte_multiple;
					break;
				case LSByte:
					thisctr.inlatch = data;
					thisctr.count_written = 1;
					break;
				case MSByte_multiple:
					thisctr.write_state = LSByte_multiple;
					thisctr.inlatch |= (data << 8);
					thisctr.count_written = 1;
					break;
				case MSByte:
					thisctr.inlatch = (data << 8);
					thisctr.count_written = 1;
					break;
				default:
					util.problem(("write counter in invalid write state."));
				}
				if (thisctr.count_written && thisctr.write_state != MSByte_multiple) {
					thisctr.null_count = 1;
					this.set_count(thisctr, thisctr.inlatch);
				}
				switch (thisctr.mode) {
				case 0:
					if (thisctr.write_state == MSByte_multiple) {
						this.set_OUT(thisctr, 0);
					}
					thisctr.next_change_time = 1;
					break;
				case 1:
					if (thisctr.triggerGATE) { // [Bochs] for initial writes, if already saw trigger.
						thisctr.next_change_time = 1;
					} // [Bochs] Otherwise, no change.
					break;
				case 6:
				case 2:
					thisctr.next_change_time = 1; // [Bochs] FIXME: this could be loosened.
					break;
				case 7:
				case 3:
					thisctr.next_change_time = 1; // [Bochs] FIXME: this could be loosened.
					break;
				case 4:
					thisctr.next_change_time = 1;
					break;
				case 5:
					if (thisctr.triggerGATE) { // [Bochs] for initial writes, if already saw trigger.
						thisctr.next_change_time = 1;
					} //Otherwise, no change.
					break;
				}
			}
		}, set_GATE: function (cnum, data) {
			if (cnum > MAX_COUNTER) {
				util.problem(("Counter number incorrect in 82C54 set_GATE"));
			} else {
				var thisctr = this.counter[ cnum ];
				if (!((thisctr.GATE && data) || (!(thisctr.GATE || data)))) {
					util.info(util.sprintf(
						"Changing GATE %d to: %d"
						, cnum, data
					));
					thisctr.GATE = data;
					if (thisctr.GATE) {
						thisctr.triggerGATE = 1;
					}
					switch (thisctr.mode) {
					case 0:
						if (data && thisctr.count_written) {
							if (thisctr.null_count) {
								thisctr.next_change_time = 1;
							} else {
								if ( (!thisctr.OUTpin)
									&& (thisctr.write_state != MSByte_multiple)
								) {
									if (thisctr.count_binary == 0) {
										thisctr.next_change_time = 1;
									} else {
										thisctr.next_change_time = thisctr.count_binary & 0xFFFF;
									}
								} else {
									thisctr.next_change_time = 0;
								}
							}
						} else {
							if (thisctr.null_count) {
								thisctr.next_change_time = 1;
							} else {
								thisctr.next_change_time = 0;
							}
						}
						break;
					case 1:
						if (data && thisctr.count_written) { // [Bochs] only triggers cause a change.
							thisctr.next_change_time = 1;
						}
						break;
					case 2:
						if (!data) {
							this.set_OUT(thisctr, 1);
							thisctr.next_change_time = 0;
						} else {
							if (thisctr.count_written) {
								thisctr.next_change_time = 1;
							} else {
								thisctr.next_change_time = 0;
							}
						}
						break;
					case 3:
						if (!data) {
							this.set_OUT(thisctr, 1);
							thisctr.first_pass = 1;
							thisctr.next_change_time = 0;
						} else {
							if (thisctr.count_written) {
								thisctr.next_change_time = 1;
							} else {
								thisctr.next_change_time = 0;
							}
						}
						break;
					case 4:
						if (!thisctr.OUTpin || thisctr.null_count) {
							thisctr.next_change_time = 1;
						} else {
							if (data && thisctr.count_written) {
								if (thisctr.first_pass) {
									if (thisctr.count_binary == 0) {
										thisctr.next_change_time = 1;
									} else {
										thisctr.next_change_time = thisctr.count_binary & 0xFFFF;
									}
								} else {
									thisctr.next_change_time = 0;
								}
							} else {
								thisctr.next_change_time = 0;
							}
						}
						break;
					case 5:
						if (data && thisctr.count_written) { // [Bochs] only triggers cause a change.
							thisctr.next_change_time = 1;
						}
						break;
					default:
					}
				}
			}
		}, read_OUT: function (cnum) {
			if (cnum > MAX_COUNTER) {
				util.problem(("Counter number incorrect in 82C54 read_OUT"));
				return 0;
			}

			return this.counter[ cnum ].OUTpin;
		}, read_GATE: function (cnum) {
			if (cnum > MAX_COUNTER) {
				util.problem(("Counter number incorrect in 82C54 read_GATE"));
				return 0;
			}

			return this.counter[ cnum ].GATE;
		}, get_clock_event_time: function (cnum) {
			if (cnum > MAX_COUNTER) {
				util.problem(("Counter number incorrect in 82C54 read_GATE"));
				return 0;
			}

			return this.counter[ cnum ].next_change_time;
		}, get_next_event_time: function () {
			var time0 = this.get_clock_event_time(0);
			var time1 = this.get_clock_event_time(1);
			var time2 = this.get_clock_event_time(2);

			var out = time0;
			if (time1 && (time1 < out)) {
				out = time1;
			}
			if (time2 && (time2 < out)) {
				out = time2;
			}
			return out;
		}, get_inlatch: function (counternum) {
			return this.counter[ counternum ].inlatch;
		}, set_OUT_handler: function (counternum, thisObj, outh) {
			this.counter[ counternum ].out_handler = [ thisObj, outh ];
		}
	});

	/* ====== Private ====== */

	// Counter class (like Bochs' type "counter_type")
	// - TODO: Move methods onto this object (eg. get_inlatch())
	function Counter() {
		util.assert(this && (this instanceof Counter), "Counter ctor ::"
			+ " error - constructor not called properly");

		/** See .init() for properties **/
	}
	util.extend(Counter.prototype, {
		init: function () {
			debug(("Setting read_state to LSB"));
			this.read_state = LSByte;
			this.write_state = LSByte;
			this.GATE = 1;
			this.OUTpin = 1;
			this.triggerGATE = 0;
			this.mode = 4;
			this.first_pass = 0;
			this.bcd_mode = 0;
			this.count = 0;
			this.count_binary = 0;
			this.state_bit_1 = 0;
			this.state_bit_2 = 0;
			this.null_count = 0;
			this.rw_mode = 1;
			this.count_written = 1;
			this.count_LSB_latched = 0;
			this.count_MSB_latched = 0;
			this.status_latched = 0;
			this.next_change_time = 0;
			this.out_handler = null;
		}
	});
	/* ====== /Private ====== */

	// Exports
	return PIT_82C54;
});
