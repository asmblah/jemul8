/*
 * jemul8 - JavaScript x86 Emulator
 *
 * MODULE: Video/graphics card class support
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
	"../http",
	"../memory/buffer"
], function (
	util,
	IODevice,
	HTTP,
	Buffer
) {
    "use strict";

	var trace = false;

	/* ====== Private ====== */

	/* ==== Const ==== */
	var MAX_XRES = 1280, MAX_YRES = 1024
		, X_TILESIZE = 16, Y_TILESIZE = 24
		, NUM_X_TILES = (MAX_XRES / X_TILESIZE) >>> 0
		, NUM_Y_TILES = (MAX_YRES / Y_TILESIZE) >>> 0
	// Text mode blink feature
		, TEXT_BLINK_MODE = 0x01
		, TEXT_BLINK_TOGGLE = 0x02
		, TEXT_BLINK_STATE = 0x04

		// Some constant lookup tables from Bochs' /iodev/vga.cc
		, charmap_offset = [
			0x0000, 0x4000, 0x8000, 0xc000
			, 0x2000, 0x6000, 0xa000, 0xe000
		], ccdat = [
			[ 0x00, 0x00, 0x00, 0x00 ],
			[ 0xff, 0x00, 0x00, 0x00 ],
			[ 0x00, 0xff, 0x00, 0x00 ],
			[ 0xff, 0xff, 0x00, 0x00 ],
			[ 0x00, 0x00, 0xff, 0x00 ],
			[ 0xff, 0x00, 0xff, 0x00 ],
			[ 0x00, 0xff, 0xff, 0x00 ],
			[ 0xff, 0xff, 0xff, 0x00 ],
			[ 0x00, 0x00, 0x00, 0xff ],
			[ 0xff, 0x00, 0x00, 0xff ],
			[ 0x00, 0xff, 0x00, 0xff ],
			[ 0xff, 0xff, 0x00, 0xff ],
			[ 0x00, 0x00, 0xff, 0xff ],
			[ 0xff, 0x00, 0xff, 0xff ],
			[ 0x00, 0xff, 0xff, 0xff ],
			[ 0xff, 0xff, 0xff, 0xff ],
		];
	/* ==== /Const ==== */

	// TODO: These should be class properties...
	var old_iHeight = 0, old_iWidth = 0, old_MSL = 0;

	// Constructor / pre-init
	function VGA(machine) {
		util.assert(this && (this instanceof VGA), "VGA ctor ::"
			+ " error - constructor not called properly");

		var mem = machine.mem
			, idx;

		util.info("VGA PreInit");

		this.machine = machine;

		this.state = {
			misc_output: {
				// 1=color emulation,	base address = 3Dx
				// 0=mono emulation,	base address = 3Bx
				color_emulation: false
				, enable_ram: false			// enable CPU access to video memory if set
				, clock_select: 0x00		// 0=25Mhz 1=28Mhz
				, select_high_bank: false	// when in odd/even modes, select
				// high 64k bank if set
				, horiz_sync_pol: false		// Bit6: negative if set

				// Bit7: negative if set
				//   Bit7, bit6 represent no. of lines on display:
				//   0 = reserved
				//   1 = 400 lines
				//   2 = 350 lines
				//   3 - 480 lines
				, vert_sync_pol: false
			}, CRTC: {
				address: 0x00
				, reg: Buffer.createByteBuffer(0x19)
				, write_protect: false
			}, attribute_ctrl: {
				flip_flop: 0	// 0 = address, 1 = data-write
				, address: 0x00	// Register number
				, video_enabled: false
				, palette_reg: Buffer.createByteBuffer(16)
				, overscan_color: 0x00
				, color_plane_enable: 0x00
				, horiz_pel_panning: 0x00
				, color_select: 0x00

				, mode_ctrl: {
					graphics_alpha: false
					, display_type: false
					, enable_line_graphics: false
					, blink_intensity: false
					, pixel_panning_compat: false
					, pixel_clock_select: false
					, internal_palette_size: false
				}
			}, pel: {
				write_data_register: 0x00
				, write_data_cycle: 0x00	// 0, 1, 2
				, read_data_register: 0x00
				, read_data_cycle: 0x00		// 0, 1, 2
				, dac_state: 0x00
				, data: new Array(256)
				, mask: 0x00
			}, graphics_ctrl: {
				index: 0x00
				, set_reset: 0x00
				, enable_set_reset: 0x00
				, color_compare: 0x00
				, data_rotate: 0x00
				, raster_op: 0x00
				, read_map_select: 0x00
				, write_mode: 0x00
				, read_mode: false
				, odd_even: false
				, chain_odd_even: false
				, shift_reg: 0x00
				, graphics_alpha: false
				/*
				 *	0 = use A0000-BFFFF
				 *	1 = use A0000-AFFFF EGA/VGA graphics modes
				 *	2 = use B0000-B7FFF Monochrome modes
				 *	3 = use B8000-BFFFF CGA modes
				 */
				, memory_mapping: 0x00
				, color_dont_care: 0x00
				, bitmask: 0x00
				, latch: Buffer.createByteBuffer(4)
			}, sequencer: {
				index: 0x00
				, map_mask: 0x00
				, reset1: false
				, reset2: false
				, reg1: 0x00
				, char_map_select: 0x00
				, extended_mem: false
				, odd_even: false
				, chain_four: false
			}, vga_enabled: false
			, vga_mem_updated: false
			, x_tilesize: 0
			, y_tilesize: 0
			, line_offset: 0
			, line_compare: 0
			, vertical_display_end: 0
			, blink_counter: 0
			, vga_tile_updated: new Array(NUM_X_TILES)
			//Bit8u *memory;
			, size_mem: 0x00 // memsize
			// Bit8u text_snapshot[128 * 1024]; // current text snapshot
			// Bit8u tile[X_TILESIZE * Y_TILESIZE * 4]; /**< Currently allocates the tile as large as needed. */
			, charmap_address: 0x0000
			, x_dotclockdiv2: false
			, y_doublescan: false
			, last_bpp: 0x00
		};
		// For VGA.update()
		this.update_static = {
			/* static unsigned */cs_counter: 1
			/* static bx_bool */, cs_visible: 0
		};

		for (idx = 0 ; idx < 256 ; ++idx) {
			this.state.pel.data[ idx ] = new Colour();
		}
		// Values for these are set up in .init() for now
		for (idx = 0 ; idx < NUM_X_TILES ; ++idx) {
			this.state.vga_tile_updated[ idx ] = new Array(NUM_Y_TILES);
		}

		this.timerHandle = null;

		// HTMLCanvas references for drawing
		this.screenVGA = null;
		this.ctx_screenVGA = null;

		// Video memory / VRAM
		this.bufVRAM = null;
		// Snapshot of text currently being displayed
		this.textSnapshot = null;
	}
	util.inherit(VGA, IODevice, "VGA"); // Inheritance
	VGA.prototype.init = function (done, fail) {
		var machine = this.machine;
		var state = this.state;
		var idx;
		var data;
		var len;
		var x;
		var y;

		// Download & store VGABIOS firmware image
		HTTP.get(
			"docs/bochs-20100605/bios/VGABIOS-lgpl-latest"
			//"docs/vgabios-0.6c/VGABIOS-lgpl-latest.debug.bin")
			//"docs/bochs-20100605/bios/VGABIOS-elpin-2.40")
			, function (path, buffer) {
				machine.mem.loadROM(buffer, 0xC0000, 1);
				done();
			}, function (path) {
				fail();
			}
		);

		// VGA output
		//	TODO: Separate DOM access out into plugins for eg. jQuery
		this.screenVGA = $("#screenVGA")[ 0 ];
		if (this.screenVGA.getContext) {
			this.ctx_screenVGA = this.screenVGA.getContext("2d");
			this.imageData = this.ctx_screenVGA.createImageData(
				this.screenVGA.width, this.screenVGA.height
			);
			// Initialise ImageData alpha values to 255 (opaque),
			//  so pixels actually appear when blitted
			for ( idx = 3, data = this.imageData.data, len = data.length
				; idx < len ; idx += 4
			) {
				data[ idx ] = 0xFF;
			}
		}

		state.x_tilesize = X_TILESIZE;
		state.y_tilesize = Y_TILESIZE;

		// Init. VGA controllers and other internal stuff
		state.vga_enabled					= true;
		state.misc_output.color_emulation	= true;
		state.misc_output.enable_ram		= true;
		state.misc_output.clock_select		= 0;
		state.misc_output.select_high_bank	= 0;
		state.misc_output.horiz_sync_pol	= 1;
		state.misc_output.vert_sync_pol		= 1;

		state.attribute_ctrl.mode_ctrl.graphics_alpha = 0;
		state.attribute_ctrl.mode_ctrl.display_type = 0;
		state.attribute_ctrl.mode_ctrl.enable_line_graphics = 1;
		state.attribute_ctrl.mode_ctrl.blink_intensity = 0;
		state.attribute_ctrl.mode_ctrl.pixel_panning_compat = 0;
		state.attribute_ctrl.mode_ctrl.pixel_clock_select = 0;
		state.attribute_ctrl.mode_ctrl.internal_palette_size = 0;

		state.line_offset			= 80;
		state.line_compare			= 1023;
		state.vertical_display_end	= 399;

		for (idx = 0 ; idx <= 0x18 ; ++idx) {
			state.CRTC.reg[ idx ] = 0;
		}
		state.CRTC.address = 0;
		state.CRTC.write_protect = 0;

		state.attribute_ctrl.flip_flop = 0;
		state.attribute_ctrl.address = 0;
		state.attribute_ctrl.video_enabled = true;
		for (idx = 0 ; idx < 16 ; ++idx) {
			state.attribute_ctrl.palette_reg[ idx ] = 0;
		}
		state.attribute_ctrl.overscan_color = 0;
		state.attribute_ctrl.color_plane_enable = 0x0f;
		state.attribute_ctrl.horiz_pel_panning = 0;
		state.attribute_ctrl.color_select = 0;

		for (idx = 0 ; idx < 256 ; ++idx) {
			state.pel.data[ idx ].red = 0;
			state.pel.data[ idx ].green = 0;
			state.pel.data[ idx ].blue = 0;
		}
		state.pel.write_data_register = 0;
		state.pel.write_data_cycle = 0;
		state.pel.read_data_register = 0;
		state.pel.read_data_cycle = 0;
		state.pel.dac_state = 0x01;
		state.pel.mask = 0xFF;

		state.graphics_ctrl.index = 0;
		state.graphics_ctrl.set_reset = 0;
		state.graphics_ctrl.enable_set_reset = 0;
		state.graphics_ctrl.color_compare = 0;
		state.graphics_ctrl.data_rotate = 0;
		state.graphics_ctrl.raster_op    = 0;
		state.graphics_ctrl.read_map_select = 0;
		state.graphics_ctrl.write_mode = 0;
		state.graphics_ctrl.read_mode  = 0;
		state.graphics_ctrl.odd_even = 0;
		state.graphics_ctrl.chain_odd_even = 0;
		state.graphics_ctrl.shift_reg = 0;
		state.graphics_ctrl.graphics_alpha = 0;
		state.graphics_ctrl.memory_mapping = 2; // Monochrome text mode
		state.graphics_ctrl.color_dont_care = 0;
		state.graphics_ctrl.bitmask = 0;
		for (idx = 0 ; idx < 4 ; ++idx) {
			state.graphics_ctrl.latch[ idx ] = 0;
		}

		state.sequencer.index = 0;
		state.sequencer.map_mask = 0;
		state.sequencer.reset1 = 1;
		state.sequencer.reset2 = 1;
		state.sequencer.reg1 = 0;
		state.sequencer.char_map_select = 0;
		state.sequencer.extended_mem = 1;	// Display mem greater than 64K
		state.sequencer.odd_even = 1;		// Use sequential addressing mode
		state.sequencer.chain_four = 0;		// Use map mask & read map select

		state.charmap_address = 0;
		state.x_dotclockdiv2 = 0;
		state.y_doublescan = 0;
		state.last_bpp = 8;

		state.vga_mem_updated = false;
		for (y = 0 ; y < (480 / Y_TILESIZE) ; ++y) {
			for (x = 0 ; x < (640 / X_TILESIZE) ; ++x) {
				this.setTileUpdated(x, y, 0);
			}
		}

		this.extension_init = false;
		this.extension_checked = false;

		state.size_mem = 0x40000; // 256k
		// Ask system to allocate a memory buffer
		this.bufVRAM = Buffer.createByteBuffer(state.size_mem);

		// Snapshot of text currently being displayed
		this.textSnapshot = Buffer.createByteBuffer(128 * 1024);

		// Set up I/O handlers
		this.initIO();

		// Screen refresh/update timer
		this.initSystemTimer();

		// Set up I/O memory hooks/handlers for VGA
		this.registerMemoryHandlers(0xa0000, 0xbffff
			, memoryReadHandler, memoryWriteHandler);

		// Install Video Card on system board
		//	(TODO: This logic from Bochs doesn't make sense):
		//	DEV_cmos_set_reg(0x14, (DEV_cmos_get_reg(0x14) & 0xcf) | 0x00);
		this.machine.cmos.installEquipment(0x00);
	};
	VGA.prototype.reset = function (type) {
		// Wipe VRAM to reset it to boot state
		Buffer.zeroBuffer(this.bufVRAM);

		this.update();
	};
	VGA.prototype.registerState = function () {
		var state = this.state;

		// ?
	};
	VGA.prototype.afterRestoreState = function () {
		var state = this.state;

		// ?
	};
	// Register all VGA I/O port addresses used
	// Based on [bx_vga_c::init_iohandlers]
	VGA.prototype.initIO = function () {
		var idx, addr
			, hsh_maskIO = [ 3, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1 ]
			, name = "VGA video";
		for (addr = 0x03B4 ; addr <= 0x03B5; ++addr) {
			this.registerIO_Read(addr, name, readHandler, 1);
			this.registerIO_Write(addr, name, writeHandler, 3);
		}

		for (addr = 0x03BA ; addr <= 0x03BA ; ++addr) {
			this.registerIO_Read(addr, name, readHandler, 1);
			this.registerIO_Write(addr, name, writeHandler, 3);
		}

		idx = 0;
		for (addr = 0x03C0 ; addr <= 0x03CF ; ++addr) {
			this.registerIO_Read(addr, name, readHandler
								, hsh_maskIO[ idx++ ]);
			this.registerIO_Write(addr, name, writeHandler, 3);
		}

		for (addr = 0x03D4 ; addr <= 0x03D5 ; ++addr) {
			this.registerIO_Read(addr, name, readHandler, 3);
			this.registerIO_Write(addr, name, writeHandler, 3);
		}

		for (addr = 0x03DA ; addr <= 0x03DA ; ++addr) {
			this.registerIO_Read(addr, name, readHandler, 1);
			this.registerIO_Write(addr, name, writeHandler, 3);
		}
	};
	// Based on [#define MAKE_COLOUR in /iodev/vga.h]
	VGA.prototype.makeColour = function (
					red, red_shiftfrom, red_shiftto, red_mask,
                    green, green_shiftfrom, green_shiftto, green_mask,
                    blue, blue_shiftfrom, blue_shiftto, blue_mask ) {
		return (
			((((red_shiftto) > (red_shiftfrom)) ?
				(red) << ((red_shiftto) - (red_shiftfrom)) :
				(red) >> ((red_shiftfrom) - (red_shiftto))) &
				(red_mask)) |
			((((green_shiftto) > (green_shiftfrom)) ?
				(green) << ((green_shiftto) - (green_shiftfrom)) :
				(green) >> ((green_shiftfrom) - (green_shiftto))) &
				(green_mask)) |
			((((blue_shiftto) > (blue_shiftfrom)) ?
				(blue) << ((blue_shiftto) - (blue_shiftfrom)) :
				(blue) >> ((blue_shiftfrom) - (blue_shiftto))) &
				(blue_mask))
		);
	};
	// Based on [#define GET_TILE_UPDATED in /iodev/vga.cc]
	VGA.prototype.getTileUpdated = function (xtile, ytile) {
		//if (parseInt(xtile) !== xtile || parseInt(ytile) !== ytile) { debugger; }

		// Only reference the array if the tile numbers are within the bounds
		// of the array.  If out of bounds, return 0.
		return ((((xtile) < NUM_X_TILES) && ((ytile) < NUM_Y_TILES))
			? this.state.vga_tile_updated[ (xtile) ][ (ytile) ]
			: 0);
	};
	// Based on [#define SET_TILE_UPDATED in /iodev/vga.cc]
	VGA.prototype.setTileUpdated = function (xtile, ytile, val) {
		//if (parseInt(xtile) !== xtile || parseInt(ytile) !== ytile) { debugger; }

		// Only reference the array if the tile numbers are within the bounds
		// of the array.  If out of bounds, do nothing.
		if (((xtile) < NUM_X_TILES) && ((ytile) < NUM_Y_TILES)) {
			this.state.vga_tile_updated[ (xtile) ][ (ytile) ] = val;
		}
	};
	/*void bx_vga_c::init_systemtimer(bx_timer_handler_t f_timer, param_event_handler f_param)
	{
	  bx_param_num_c *vga_update_interval = SIM->get_param_num(BXPN_VGA_UPDATE_INTERVAL);
	  Bit64u interval = vga_update_interval->get();
	  BX_INFO(("interval=" FMT_LL "u", interval));
	  if (BX_VGA_THIS timer_id == BX_NULL_TIMER_HANDLE) {
		BX_VGA_THIS timer_id = bx_pc_system.register_timer(this, f_timer,
		   (Bit32u)interval, 1, 1, "vga");
		vga_update_interval->set_handler(f_param);
		vga_update_interval->set_runtime_param(1);
	  }
	  if (interval < 300000) {
		state.blink_counter = 300000 / (unsigned)interval;
	  } else {
		state.blink_counter = 1;
	  }
	}*/
	// Based on [bx_vga_c::init_systemtimer]
	VGA.prototype.initSystemTimer = function () {
		var interval = 40000;

		this.timerHandle = this.machine.registerTimer(handleTimer, this
			, interval, true, true, "VGA");

		if (interval < 300000) {
			this.state.blink_counter = Math.floor(300000 / interval);
		} else {
			this.state.blink_counter = 1;
		}
	};

	// Based on [bx_vga_c::update]
	VGA.prototype.update = function () {
		var machine = this.machine, state = this.state
			, bufVRAM = this.bufVRAM
			, iHeight = 0, iWidth = 0
			, attribute, palette_reg_val, DAC_regno
			, line_compare;
			//Bit8u *plane0, *plane1, *plane2, *plane3;

		// No screen update necessary
		if ( !state.vga_mem_updated
				&& state.graphics_ctrl.graphics_alpha ) {
			return;
		}

		// Skip screen update when vga/video is disabled
		//	or the sequencer is in reset mode
		if ( !state.vga_enabled || !state.attribute_ctrl.video_enabled
				|| !state.sequencer.reset2 || !state.sequencer.reset1
				|| (state.sequencer.reg1 & 0x20) ) {
			return;
		}

		// Skip screen update if the vertical retrace is in progress
		//	(using 72 Hz vertical frequency)
		//	- NB: This is to prevent screen tearing, but we do not have
		//	  proper microsecond-granularity in JS, so is this working?
		if ((machine.getTimeUsecs() % 13888) < 70) {
			return;
		}

		/** TODO: VBE **/

		/*
		 *	Fields that effect the way video memory is serialized into screen output:
		 *	GRAPHICS CONTROLLER:
		 *		state.graphics_ctrl.shift_reg:
		 *		0: Output data in standard VGA format or CGA-compatible 640x200 2 color
		 *			graphics mode (mode 6)
		 *		1: Output data in CGA-compatible 320x200 4 color graphics mode
		 *			(modes 4 & 5)
		 *		2: Output data 8 bits at a time from the 4 bit planes
		 *			(mode 13 and variants like modeX)
		 */

		// [Bochs] if (state.vga_mem_updated==0 || state.attribute_ctrl.video_enabled == 0)

		if (state.graphics_ctrl.graphics_alpha) {
			var color = 0x00;
			var bit_no, r, c, x, y;
			var byte_offset, start_addr;
			var xc, yc, xti, yti;

			start_addr = (state.CRTC.reg[ 0x0c ] << 8) | state.CRTC.reg[ 0x0d ];

			//BX_DEBUG(("update: shiftreg=%u, chain4=%u, mapping=%u",
			//  (unsigned) state.graphics_ctrl.shift_reg,
			//  (unsigned) state.sequencer.chain_four,
			//  (unsigned) state.graphics_ctrl.memory_mapping);

			var dimens = this.determineScreenDimensions();
			iWidth = dimens.width; iHeight = dimens.height;

			if ( (iWidth != old_iWidth) || (iHeight != old_iHeight)
					|| (state.last_bpp > 8) ) {
				// TODO: Get rid of this check & replace w/default
				//       (as for .textUpdate())
				if (this.dimensionUpdate) {
					// NB: Different from text mode's .dimensionUpdate()
					this.dimensionUpdate(
						iWidth, iHeight, 0, 0, 8
					);
				}

				old_iWidth = iWidth;
				old_iHeight = iHeight;
				state.last_bpp = 8;
			}

			switch (state.graphics_ctrl.shift_reg) {
			case 0:
				if (state.graphics_ctrl.memory_mapping == 3) { // CGA 640x200x2
					for (yc = 0, yti = 0 ; yc < iHeight ; yc += Y_TILESIZE, yti++) {
						for (xc = 0, xti = 0 ; xc < iWidth ; xc += X_TILESIZE, xti++) {
							if (this.getTileUpdated(xti, yti)) {
								for (r = 0 ; r < Y_TILESIZE ; r++) {
									y = yc + r;
									if (state.y_doublescan) { y >>= 1; }
									for (c = 0 ; c < X_TILESIZE ; c++) {

										x = xc + c;
										/* 0 or 0x2000 */
										byte_offset = start_addr + ((y & 1) << 13);
										/* to the start of the line */
										byte_offset += (320 / 4) * (y / 2);
										/* to the byte start */
										byte_offset += (x / 8);

										bit_no = 7 - (x % 8);
										palette_reg_val = (((bufVRAM[ byte_offset >>> 0 ]) >> bit_no) & 1);
										DAC_regno = state.attribute_ctrl.palette_reg[ palette_reg_val ];
										state.tile[ r * X_TILESIZE + c ] = DAC_regno;
									}
								}
								this.setTileUpdated(xti, yti, 0);
								if (trace) { util.warning("graphics_tile_update()"); }
								//bx_gui->graphics_tile_update(state.tile, xc, yc);
							}
						}
					}
				// Output data in serial fashion with each display plane
				//	output on its associated serial output. Standard EGA/VGA format
				} else {
					/** TODO: VBE **/

					//plane0 = &state.memory[ 0 << 16 ];
					//plane1 = &state.memory[ 1 << 16 ];
					//plane2 = &state.memory[ 2 << 16 ];
					//plane3 = &state.memory[ 3 << 16 ];
					line_compare = state.line_compare;
					if (state.y_doublescan) { line_compare >>= 1; }

					for ( yc = 0, yti = 0 ; yc < iHeight
							; yc += Y_TILESIZE, yti++ ) {
						for ( xc = 0, xti = 0 ; xc < iWidth
								; xc += X_TILESIZE, xti++ ) {
							if (this.getTileUpdated(xti, yti)) {
								for (r = 0 ; r < Y_TILESIZE ; r++) {
									y = yc + r;
									if (state.y_doublescan) { y >>= 1; }
									for (c = 0 ; c < X_TILESIZE ; c++) {
										x = xc + c;
										if (state.x_dotclockdiv2) { x >>= 1; }
										bit_no = 7 - (x % 8);
										if (y > line_compare) {
											byte_offset = x / 8 +
											((y - line_compare - 1) * state.line_offset);
										} else {
											byte_offset = start_addr + x / 8 +
											(y * state.line_offset);
										}

										byte_offset >>>= 0;
										attribute =
											(((/*plane0*/bufVRAM[ byte_offset ] >> bit_no) & 0x01) << 0)
											| (((/*plane1*/bufVRAM[ (1 << 16) + byte_offset ] >> bit_no) & 0x01) << 1)
											| (((/*plane2*/bufVRAM[ (2 << 16) + byte_offset ] >> bit_no) & 0x01) << 2)
											| (((/*plane3*/bufVRAM[ (3 << 16) + byte_offset ] >> bit_no) & 0x01) << 3);

										attribute &= state.attribute_ctrl.color_plane_enable;
										// [Bochs] undocumented feature ???: colors 0..7 high intensity, colors 8..15 blinking
										//	using low/high intensity. Blinking is not implemented yet.
										if (state.attribute_ctrl.mode_ctrl.blink_intensity) { attribute ^= 0x08; }
										palette_reg_val = state.attribute_ctrl.palette_reg[ attribute ];
										if (state.attribute_ctrl.mode_ctrl.internal_palette_size) {
											// use 4 lower bits from palette register
											// use 4 higher bits from color select register
											// 16 banks of 16-color registers
											DAC_regno = (palette_reg_val & 0x0f) |
												(state.attribute_ctrl.color_select << 4);
										} else {
											// use 6 lower bits from palette register
											// use 2 higher bits from color select register
											// 4 banks of 64-color registers
											DAC_regno = (palette_reg_val & 0x3f) |
											((state.attribute_ctrl.color_select & 0x0c) << 4);
										}
										// [Bochs] DAC_regno &= video DAC mask register ???

										state.tile[ r*X_TILESIZE + c ] = DAC_regno;
									}
								}
								this.setTileUpdated(xti, yti, 0);
								if (trace) { util.warning("graphics_tile_update()"); }
								//bx_gui->graphics_tile_update(state.tile, xc, yc);
							}
						}
					}
				}
				break; // case 0
			// Output the data in a CGA-compatible 320x200 4 color graphics
			//	mode.  (modes 4 & 5)
			case 1:
				// CGA 320x200x4 start

				for (yc = 0, yti = 0; yc < iHeight ; yc += Y_TILESIZE, yti++) {
					for (xc = 0, xti = 0 ; xc < iWidth ; xc += X_TILESIZE, xti++) {
						if (this.getTileUpdated(xti, yti)) {
							for (r = 0 ; r < Y_TILESIZE ; r++) {
								y = yc + r;
								if (state.y_doublescan) { y >>= 1; }
								for (c = 0 ; c < X_TILESIZE ; c++) {

									x = xc + c;
									if (state.x_dotclockdiv2) { x >>= 1; }
									// 0 or 0x2000
									byte_offset = start_addr + ((y & 1) << 13);
									// To the start of the line
									byte_offset += (320 / 4) * (y / 2);
									// To the byte start
									byte_offset += (x / 4);

									attribute = 6 - 2*(x % 4);
									palette_reg_val = (bufVRAM[ byte_offset >>> 0 ]) >> attribute;
									palette_reg_val &= 3;
									DAC_regno = state.attribute_ctrl.palette_reg[ palette_reg_val ];
									state.tile[ r*X_TILESIZE + c ] = DAC_regno;
								}
							}
							this.setTileUpdated(xti, yti, 0);
							if (trace) { util.warning("graphics_tile_update()"); }
							//bx_gui->graphics_tile_update(state.tile, xc, yc);
						}
					}
				}
				// CGA 320x200x4 end
				break; // case 1
			// Output the data eight bits at a time from the 4 bit plane
			//	(format for VGA mode 13 hex)
			case 2:
			case 3: // [Bochs] FIXME: is this really the same ???
				if (state.sequencer.chain_four) {
					var pixely, pixelx, plane;

					if (state.misc_output.select_high_bank != 1) {
						util.panic("VGA.update() :: select_high_bank != 1");
					}

					for (yc = 0, yti = 0 ; yc < iHeight ; yc += Y_TILESIZE, yti++) {
						for (xc = 0, xti = 0 ; xc < iWidth ; xc += X_TILESIZE, xti++) {
							if (this.getTileUpdated(xti, yti)) {
								for (r = 0 ; r < Y_TILESIZE ; r++) {
									pixely = yc + r;
									if (state.y_doublescan) { pixely >>= 1; }
									for (c = 0 ; c < X_TILESIZE ; c++) {
										pixelx = (xc + c) >> 1;
										plane  = (pixelx % 4);
										byte_offset = start_addr + (plane * 65536) +
											(pixely * state.line_offset) + (pixelx & ~0x03);
										color = bufVRAM[ byte_offset ];
										state.tile[ r*X_TILESIZE + c ] = color;
									}
								}
								this.setTileUpdated(xti, yti, 0);
								if (trace) { util.warning("graphics_tile_update()"); }
								//bx_gui->graphics_tile_update(state.tile, xc, yc);
							}
						}
					}
				} else { // chain_four == 0, modeX
					var pixely, pixelx, plane;

					for (yc = 0, yti = 0; yc < iHeight ; yc += Y_TILESIZE, yti++) {
						for (xc = 0, xti = 0; xc < iWidth ; xc += X_TILESIZE, xti++) {
							if (this.getTileUpdated(xti, yti)) {
								for (r = 0 ; r < Y_TILESIZE ; r++) {
									pixely = yc + r;
									if (state.y_doublescan) { pixely >>= 1; }
									for (c = 0 ; c < X_TILESIZE ; c++) {
										pixelx = (xc + c) >> 1;
										plane  = (pixelx % 4);
										byte_offset = (plane * 65536) +
											(pixely * state.line_offset)
											+ (pixelx >> 2);
										color = bufVRAM[ start_addr + byte_offset ];
										state.tile[ r*X_TILESIZE + c ] = color;
									}
								}
								this.setTileUpdated(xti, yti, 0);
								if (trace) { util.warning("graphics_tile_update"); }
								//bx_gui->graphics_tile_update(state.tile, xc, yc);
							}
						}
					}
				}
				break; // case 2
			default:
				util.panic("VGA.update() :: shift_reg == "
					+ state.graphics_ctrl.shift_reg);
			}

			state.vga_mem_updated = false;
			return;
		// Text mode
		} else {
			var start_address;
			var cursor_address, cursor_x, cursor_y;
			// Bochs' bx_vga_tminfo_t in gui.h
			var tm_info = new VGA_TMInfo();
			var VDE, MSL, cols, rows, cWidth;
			// static unsigned cs_counter = 1;
			// static bx_bool cs_visible = 0;
			var cs_toggle = false;

			this.update_static.cs_counter = (this.update_static.cs_counter - 1) & 0xFFFF;
			if (!state.vga_mem_updated && (this.update_static.cs_counter > 0)) {
				return;
			}

			tm_info.start_address = 2*((state.CRTC.reg[ 12 ] << 8) +
				state.CRTC.reg[ 13 ]);
			tm_info.cs_start = state.CRTC.reg[ 0x0a ] & 0x3f;
			if (this.update_static.cs_counter == 0) {
				cs_toggle = 1;
				this.update_static.cs_visible = !this.update_static.cs_visible;
				this.update_static.cs_counter = state.blink_counter;
			}
			if (!this.update_static.cs_visible) {
				tm_info.cs_start |= 0x20;
			}
			tm_info.cs_end = state.CRTC.reg[ 0x0b ] & 0x1f;
			tm_info.line_offset = state.CRTC.reg[ 0x13 ] << 2;
			tm_info.line_compare = state.line_compare;
			tm_info.h_panning = state.attribute_ctrl.horiz_pel_panning & 0x0f;
			tm_info.v_panning = state.CRTC.reg[ 0x08 ] & 0x1f;
			tm_info.line_graphics = state.attribute_ctrl.mode_ctrl.enable_line_graphics;
			tm_info.split_hpanning = state.attribute_ctrl.mode_ctrl.pixel_panning_compat;
			tm_info.blink_flags = 0;
			if (state.attribute_ctrl.mode_ctrl.blink_intensity) {
				tm_info.blink_flags |= TEXT_BLINK_MODE;
				if (cs_toggle) {
					tm_info.blink_flags |= TEXT_BLINK_TOGGLE;
				}
				if (this.update_static.cs_visible) {
					tm_info.blink_flags |= TEXT_BLINK_STATE;
				}
			}
			if ((state.sequencer.reg1 & 0x01) == 0) {
				if (tm_info.h_panning >= 8) {
					tm_info.h_panning = 0;
				} else {
					tm_info.h_panning++;
				}
			} else {
				tm_info.h_panning &= 0x07;
			}

			// (V)ertical (D)isplay (E)nd: find out how many lines are displayed
			VDE = state.vertical_display_end;
			// (M)aximum (S)can (L)ine: height of character cell
			MSL = state.CRTC.reg[ 0x09 ] & 0x1f;
			cols = state.CRTC.reg[1] + 1;
			// [Bochs] Workaround for update() calls before VGABIOS init
			if (cols == 1) {
				cols = 80;
				MSL = 15;
			}
			if ((MSL == 1) && (VDE == 399)) {
				// Emulated CGA graphics mode 160x100x16 colors
				MSL = 3;
			}
			rows = (VDE+1)/(MSL+1);
			if ((rows * tm_info.line_offset) > (1 << 17)) {
				util.problem("VGA.update() :: Text mode: out of memory");
				return;
			}
			cWidth = ((state.sequencer.reg1 & 0x01) == 1) ? 8 : 9;
			iWidth = cWidth * cols;
			iHeight = VDE + 1;

			// Screen size has changed: notify GUI
			if ( (iWidth != old_iWidth)
                || (iHeight != old_iHeight)
                || (MSL != old_MSL)
                || (state.last_bpp > 8)
            ) {
				//bx_gui->dimension_update(iWidth, iHeight, MSL+1, cWidth);
				//if (trace) { util.warning("dimension_update()"); }
				// TODO: Get rid of this check & replace w/default
				//       (as for .textUpdate())
				if (this.dimensionUpdate) {
					// NB: Different from gfx mode's .dimensionUpdate()
					this.dimensionUpdate(
						iWidth, iHeight, MSL + 1, cWidth, 8
					);
				}

				old_iWidth = iWidth;
				old_iHeight = iHeight;
				old_MSL = MSL;
				state.last_bpp = 8;
			}
			// Pass old text snapshot & new VGA memory contents
			start_address = tm_info.start_address;
			cursor_address = 2*((state.CRTC.reg[ 0x0e ] << 8) +
				state.CRTC.reg[ 0x0f ]);
			if (cursor_address < start_address) {
				cursor_x = 0xffff;
				cursor_y = 0xffff;
			} else {
				cursor_x = ((cursor_address - start_address)/2) % (iWidth/cWidth);
				cursor_y = (((cursor_address - start_address)/2) / (iWidth/cWidth)) >>> 0;
			}

            // TODO: Optimise by removing this check & defining a default
            //       .textUpdate() handler (will probably do nothing)
            if (this.textUpdate) {
                this.textUpdate(
                    this.textSnapshot
                    , bufVRAM
                    , start_address
                    , cursor_x
                    , cursor_y
                    , tm_info
                );
            }

            // Screen updated
			if (state.vga_mem_updated) {
				// Screen updated, copy new VGA memory contents
				//  into text snapshot so only dirty areas may be updated
				Buffer.copy(
					bufVRAM, start_address
					, this.textSnapshot, 0
					, tm_info.line_offset * rows
				);

				// Update applied
				state.vga_mem_updated = false;
			}
		}
	};
	// Based on [bx_vga_c::determine_screen_dimensions]
	VGA.prototype.determineScreenDimensions = function () {
		var ai = new Array(0x20)
			, i, h, v
			, dimens = { width: 0, height: 0 };

		for (i = 0 ; i < 0x20 ; i++) {
			ai[i] = state.CRTC.reg[i];
		}

		h = (ai[1] + 1) * 8;
		v = (ai[18] | ((ai[7] & 0x02) << 7) | ((ai[7] & 0x40) << 3)) + 1;

		if (state.graphics_ctrl.shift_reg == 0) {
			dimens.width = 640;
			dimens.height = 480;

			if (state.CRTC.reg[6] == 0xBF) {
				if ( state.CRTC.reg[23] == 0xA3 &&
						state.CRTC.reg[20] == 0x40 &&
						state.CRTC.reg[9] == 0x41 ) {
					dimens.width = 320;
					dimens.height = 240;
				} else {
					if (state.x_dotclockdiv2) { h <<= 1; }
					dimens.width = h;
					dimens.height = v;
				}
			} else if ((h >= 640) && (v >= 480)) {
				dimens.width = h;
				dimens.height = v;
			}
		} else if (state.graphics_ctrl.shift_reg == 2) {
			if (state.sequencer.chain_four) {
				dimens.width = h;
				dimens.height = v;
			} else {
				dimens.width = h;
				dimens.height = v;
			}
		} else {
			if (state.x_dotclockdiv2) { h <<= 1; }
			dimens.width = h;
			dimens.height = v;
		}

		return dimens;
	};
	// Marks an area of the screen to be updated
	// Based on [bx_vga_c::redraw_area]
	VGA.prototype.redrawArea = function (x0, y0, width, height) {
		var state = this.state
			, xti, yti, xt0, xt1, yt0, yt1, xmax, ymax;

		if ((width === 0) || (height === 0)) {
			return;
		}

		state.vga_mem_updated = true;

		if (state.graphics_ctrl.graphics_alpha) {
			util.panic("VGA.redrawArea() :: Gfx mode not implemented yet");
		}

	};
	// Based on [bx_vga_c::get_actl_palette_idx]
	VGA.prototype.getAttrCtrlPaletteIndex = function (index) {
		return this.state.attribute_ctrl.palette_reg[ index ];
	};

	function Colour() {
		this.red = 0;
		this.green = 0;
		this.blue = 0;
	}

	function VGA_TMInfo() {
		this.start_address = 0x0000;
		this.cs_start = 0x00;
		this.cs_end = 0x00;
		this.line_offset = 0x0000;
		this.line_compare = 0x0000;
		this.h_panning = 0x00;
		this.v_panning = 0x00;
		this.line_graphics = false;
		this.split_hpanning = false;
		this.blink_flags = 0x00;
	}


	// VGA device's I/O read operations' handler routine
	function readHandler(device, addr, io_len) {
		var machine = device.machine // "device" will be VGA
			, state = device.state
			, horiz_retrace = false, vert_retrace = false
			, usec = 0
			, ret16 = 0, vertres = 0
			, retval = 0;

		if (trace) {
			util.info("VGA readHandler() :: Read from address: "
				+ util.format("hex", addr));
		}

		// Debugging output dumper
		function debug(ret) {
			if (trace) {
				if (io_len === 1) {
					util.debug("VGA readHandler() :: 8-bit read from "
						+ util.format("hex", addr) + " = "
						+ util.format("hex", ret));
				} else {
					util.debug("VGA readHandler() :: 16-bit read from "
						+ util.format("hex", addr) + " = "
						+ util.format("hex", ret));
				}
			}
			return ret;
		}

		// Handle 2-byte reads as 2 separate 1-byte reads
		if (io_len === 2) {
			ret16 = readHandler(device, addr, 1);
			ret16 |= (readHandler(device, addr + 1, 1)) << 8;

			return debug(ret16);
		}

		// For OS/2
		//if (bx_options.videomode === BX_VIDEO_DIRECT) {
		//	util.panic("VGA readHandler() :: BX_VIDEO_DIRECT - unsupported");
		//	return machine.io.read(addr, 1);
		//}

		if ( (addr >= 0x03B0) && (addr <= 0x03BF)
				&& (state.misc_output.color_emulation) ) {
			return debug(0xFF);
		}
		if ( (addr >= 0x03D0) && (addr <= 0x03DF)
				&& (state.misc_output.color_emulation == 0) ) {
			return debug(0xFF);
		}

		switch (addr) {
		case 0x03BA: // Input Status 1 (monochrome emulation modes)
		case 0x03CA: // [Bochs] Feature Control ???
		case 0x03DA: // Input Status 1 (color emulation modes)
			// Bit3: Vertical Retrace
			//		0 = display is in the display mode
			//		1 = display is in the vertical retrace mode
			// Bit0: Display Enable
			//		0 = display is in the display mode
			//		1 = display is not in the display mode; either the
			//			horizontal or vertical retrace period is active

			// Using 72 Hz vertical frequency
			usec = machine.getTimeUsecs();
			switch ( (state.misc_output.vert_sync_pol << 1)
				| state.misc_output.horiz_sync_pol ) {
			case 0: vertres = 200; break;
			case 1: vertres = 400; break;
			case 2: vertres = 350; break;
			default: vertres = 480; break;
			}
			if ((usec % 13888) < 70) {
				vert_retrace = 1;
			}
			if (((usec % (13888 / vertres)) >>> 0) === 0) {
				horiz_retrace = 1;
			}

			retval = 0;
			if (horiz_retrace || vert_retrace) {
				retval = 0x01;
			}
			if (vert_retrace) {
				retval |= 0x08;
			}
			// Reading this port resets the flip-flop to address mode
			state.attribute_ctrl.flip_flop = 0;
			return debug(retval);

		case 0x03C0: // ???
			if (state.attribute_ctrl.flip_flop == 0) {
				//BX_INFO(("io read: 0x3c0: flip_flop = 0"));
				retval = (state.attribute_ctrl.video_enabled << 5)
					| state.attribute_ctrl.address;
				return debug(retval);
			} else {
				util.problem("VGA readHandler() :: I/O read: 0x3C0: flip_flop != 0");
				return 0;
			}
			break;

		case 0x03C1: // ???
			switch (state.attribute_ctrl.address) {
			case 0x00: case 0x01: case 0x02: case 0x03:
			case 0x04: case 0x05: case 0x06: case 0x07:
			case 0x08: case 0x09: case 0x0a: case 0x0b:
			case 0x0c: case 0x0d: case 0x0e: case 0x0f:
				retval = state.attribute_ctrl.palette_reg[
					state.attribute_ctrl.address ];
				return debug(retval);
			case 0x10: // Mode control register
				retval =
					(state.attribute_ctrl.mode_ctrl.graphics_alpha << 0)
					| (state.attribute_ctrl.mode_ctrl.display_type << 1)
					| (state.attribute_ctrl.mode_ctrl.enable_line_graphics << 2)
					| (state.attribute_ctrl.mode_ctrl.blink_intensity << 3)
					| (state.attribute_ctrl.mode_ctrl.pixel_panning_compat << 5)
					| (state.attribute_ctrl.mode_ctrl.pixel_clock_select << 6)
					| (state.attribute_ctrl.mode_ctrl.internal_palette_size << 7);
				return debug(retval);
			case 0x11: // Overscan color register
				return debug(state.attribute_ctrl.overscan_color);
			case 0x12: // Colour plane enable
				return debug(state.attribute_ctrl.color_plane_enable);
			case 0x13: // Horizontal PEL panning register
				return debug(state.attribute_ctrl.horiz_pel_panning);
			case 0x14: // Color select register
				return debug(state.attribute_ctrl.color_select);
			default:
				if (trace) {
					util.info("VGA readHandler() :: I/O read: 0x3C1: unknown register "
						+ util.format("hex", state.attribute_ctrl.address));
				}
				return debug(0);
			}
			break;

		case 0x03c2: // Input Status 0
			if (trace) {
				util.debug("VGA readHandler() :: I/O read 0x3C2:"
					+ " input status #0: ignoring");
			}
			return debug(0);

		case 0x03C3: // VGA Enable Register
			return debug(state.vga_enabled);

		case 0x03C4: // Sequencer Index Register
			return debug(state.sequencer.index);

		case 0x03C5: // Sequencer Registers 00 -> 04
			switch (state.sequencer.index) {
			case 0: // Sequencer: reset
				if (trace) {
					util.debug("VGA readHandler() :: I/O read 0x3C5:"
						+ " sequencer reset");
				}
				return debug(state.sequencer.reset
					| (state.sequencer.reset2 << 1));
				break;
			case 1: // Sequencer: clocking mode
				if (trace) {
					util.debug("VGA readHandler() I/O read 0x3C5:"
						+ " sequencer clocking mode");
				}
				return debug(state.sequencer.reg1);
				break;
			case 2: // Sequencer: map mask register
				return debug(state.sequencer.map_mask);
				break;
			case 3: // Sequencer: character map select register
				return debug(state.sequencer.char_map_select);
				break;
			case 4: // Sequencer: memory mode register
				retval =
					(state.sequencer.extended_mem	<< 1)
					| (state.sequencer.odd_even		<< 2)
					| (state.sequencer.chain_four	<< 3);
				return debug(retval);
				break;
			default:
				if (trace) {
					util.debug("VGA readHandler() I/O read 0x3C5: index "
						+ state.sequencer.index + " unhandled");
				}
				return debug(0);
			}
			break;

		case 0x03C6: // [Bochs] PEL mask ???
			return debug(state.pel.mask);

		case 0x03C7: // DAC state, read = 11b, write = 00b
			return debug(state.pel.dac_state);

		case 0x03C8: // PEL address write mode
			return debug(state.pel.write_data_register);

		case 0x03C9: // PEL Data Register, colors 00 -> FF
			if (state.pel.dac_state == 0x03) {
				switch (state.pel.read_data_cycle) {
				case 0:
					retval = state.pel.data[
						state.pel.read_data_register ].red;
					break;
				case 1:
					retval = state.pel.data[
						state.pel.read_data_register ].green;
					break;
				case 2:
					retval = state.pel.data[
						state.pel.read_data_register ].blue;
					break;
				default:
					retval = 0; // keep compiler happy
				}
				state.pel.read_data_cycle++;
				if (state.pel.read_data_cycle >= 3) {
					state.pel.read_data_cycle = 0;
					state.pel.read_data_register++;
				}
			} else {
				retval = 0x3F;
			}
			return debug(retval);

		case 0x03CC: // Miscellaneous Output / Graphics 1 Position ???
			retval =
				((state.misc_output.color_emulation  & 0x01) << 0)
				| ((state.misc_output.enable_ram       & 0x01) << 1)
				| ((state.misc_output.clock_select     & 0x03) << 2)
				| ((state.misc_output.select_high_bank & 0x01) << 5)
				| ((state.misc_output.horiz_sync_pol   & 0x01) << 6)
				| ((state.misc_output.vert_sync_pol    & 0x01) << 7);
			return debug(retval);

		case 0x03CE: // Graphics Controller Index Register
			return debug(state.graphics_ctrl.index);

		case 0x03CD: // ???
			if (trace) {
				util.debug("VGA readHandler() I/O read from 03cd");
			}
			return debug(0x00);

		case 0x03CF: // Graphics Controller Registers 00 -> 08
			switch (state.graphics_ctrl.index) {
			case 0: // Set/Reset
				return debug(state.graphics_ctrl.set_reset);
				break;
			case 1: // Enable Set/Reset
				return debug(state.graphics_ctrl.enable_set_reset);
				break;
			case 2: // Color Compare
				return debug(state.graphics_ctrl.color_compare);
				break;
			case 3: // Data Rotate
				retval =
					((state.graphics_ctrl.raster_op & 0x03) << 3)
					| ((state.graphics_ctrl.data_rotate & 0x07) << 0);
				return debug(retval);
				break;
			case 4: // Read Map Select
				return debug(state.graphics_ctrl.read_map_select);
				break;
			case 5: // Mode
				retval =
					((state.graphics_ctrl.shift_reg & 0x03) << 5)
					| ((state.graphics_ctrl.odd_even & 0x01) << 4)
					| ((state.graphics_ctrl.read_mode & 0x01) << 3)
					| ((state.graphics_ctrl.write_mode & 0x03) << 0);

				if ( state.graphics_ctrl.odd_even
						|| state.graphics_ctrl.shift_reg ) {
					if (trace) {
						util.debug("VGA readHandler() :: I/O read 0x3CF: reg 05 = "
							+ util.format("hex", retval));
					}
				}
				return debug(retval);
				break;
			case 6: // Miscellaneous
				retval =
					((state.graphics_ctrl.memory_mapping & 0x03) << 2) |
					((state.graphics_ctrl.odd_even & 0x01) << 1) |
					((state.graphics_ctrl.graphics_alpha & 0x01) << 0);
				return debug(retval);
			case 7: // Color Don't Care
				return debug(state.graphics_ctrl.color_dont_care);
			case 8: // Bit Mask
				return debug(state.graphics_ctrl.bitmask);
			default:
				// ???
				if (trace) {
					util.debug("VGA readHandler() I/O read: 0x3CF: index "
						+ state.graphics_ctrl.index + " unhandled");
				}
				return debug(0);
			}
			break;

		case 0x03D4: // CRTC Index Register (color emulation modes)
			return debug(state.CRTC.address);

		case 0x03B5: // CRTC Registers (monochrome emulation modes)
		case 0x03D5: // CRTC Registers (color emulation modes)
			if (state.CRTC.address > 0x18) {
				if (trace) {
					util.debug("VGA readHandler() :: I/O read: invalid CRTC register "
						+ util.format("hex", state.CRTC.address));
				}
				return debug(0);
			}
			return debug(state.CRTC.reg[ state.CRTC.address ]);

		case 0x03B4: // CRTC Index Register (monochrome emulation modes)
		case 0x03CB: // [Bochs] ??? Not sure but OpenBSD reads it a lot
		default:
			// (NB: Not a panic, as for other devices)
			if (trace) {
				util.info("VGA readHandler() :: Unsupported read, address="
					+ util.format("hex", addr) + "!");
			}
			return debug(0);
		}
	}
	// VGA device's I/O write operations' handler routine
	function writeHandler(device, addr, val, io_len, /* private */ noLog) {
		var state = device.state // "device" will be VGA
			, idx, text
			, charmap1 = 0x00, charmap2 = 0x00, prev_memory_mapping = 0x00
			, prev_video_enabled = false, prev_line_graphics = false, prev_int_pal_size = false
			, prev_graphics_alpha = false, prev_chain_odd_even = false
			, needs_update = false, charmap_update = false;

		if (trace) {
			util.info("VGA writeHandler() :: Write to address: "
				+ util.format("hex", addr) + " = " + util.format("hex", val));
		}

		// Debugging output dumper
		if (trace && !noLog) {
			if (io_len === 1) {
				util.debug(" :: 8-bit write to "
					+ util.format("hex", addr) + " = " + util.format("hex", val));
			} else if (io_len === 2) {
				util.debug(" :: 16-bit write to "
					+ util.format("hex", addr) + " = " + util.format("hex", val));
			} else {
				util.panic(" :: Strange VGA write size "
					+ io_len);
			}
		}

		// Handle 2-byte writes as 2 separate 1-byte writes
		if (io_len === 2) {
			writeHandler(device, addr, val & 0xFF, 1, true);
			writeHandler(device, addr + 1, (val >> 8) & 0xFF, 1, true);
			return;
		}

		// For OS/2
		//if (bx_options.videomode === BX_VIDEO_DIRECT) {
		//	util.panic(" :: BX_VIDEO_DIRECT - unsupported");
		//	return machine.io.write(addr, val, 1);
		//}

		// Support only writes to certain ports depending on emulation mode
		if ( (addr >= 0x03B0) && (addr <= 0x03BF)
				&& (state.misc_output.color_emulation) ) {
			return;
		}
		if ( (addr >= 0x03D0) && (addr <= 0x03DF)
				&& (state.misc_output.color_emulation == false) ) {
			return;
		}

		switch (addr) {
		case 0x03BA: // Feature Control (monochrome emulation modes)
			if (trace) {
				util.debug(" :: I/O write 3BA: feature control: ignoring");
			}
			break;

		case 0x03C0: // Attribute Controller
			if (state.attribute_ctrl.flip_flop == 0) { // Address mode
				prev_video_enabled = state.attribute_ctrl.video_enabled;
				state.attribute_ctrl.video_enabled = (val >> 5) & 0x01;

				if (trace) {
					util.debug(" :: I/O write 3C0: video_enabled = "
						+ state.attribute_ctrl.video_enabled);
				}

				if (!state.attribute_ctrl.video_enabled) {
					//bx_gui->clear_screen();
					if (trace) { util.warning("clear_screen()"); }
				} else if (!prev_video_enabled) {
					if (trace) { util.debug(" :: Found enable-transition"); }

					needs_update = true;
				}
				val &= 0x1F; // Address = bits 0 -> 4
				state.attribute_ctrl.address = val;
				switch (val) {
				case 0x00: case 0x01: case 0x02: case 0x03:
				case 0x04: case 0x05: case 0x06: case 0x07:
				case 0x08: case 0x09: case 0x0a: case 0x0b:
				case 0x0c: case 0x0d: case 0x0e: case 0x0f:
					break;
				default:
					if (trace) {
						util.debug(" :: I/O write 0x3C0: address mode reg="
							+ util.format("hex", val));
					}
				}
			} else { // Data-write mode
				switch (state.attribute_ctrl.address) {
				case 0x00: case 0x01: case 0x02: case 0x03:
				case 0x04: case 0x05: case 0x06: case 0x07:
				case 0x08: case 0x09: case 0x0A: case 0x0B:
				case 0x0C: case 0x0D: case 0x0E: case 0x0F:
					if ( val != state.attribute_ctrl.palette_reg[
							state.attribute_ctrl.address ] ) {
						state.attribute_ctrl.palette_reg[
							state.attribute_ctrl.address ] = val;
						needs_update = true;
					}
					break;
				case 0x10: // Mode control register
					prev_line_graphics = state.attribute_ctrl.mode_ctrl.enable_line_graphics;
					prev_int_pal_size = state.attribute_ctrl.mode_ctrl.internal_palette_size;
					state.attribute_ctrl.mode_ctrl.graphics_alpha
						= (val >> 0) & 0x01;
					state.attribute_ctrl.mode_ctrl.display_type
						= (val >> 1) & 0x01;
					state.attribute_ctrl.mode_ctrl.enable_line_graphics
						= (val >> 2) & 0x01;
					state.attribute_ctrl.mode_ctrl.blink_intensity
						= (val >> 3) & 0x01;
					state.attribute_ctrl.mode_ctrl.pixel_panning_compat
						= (val >> 5) & 0x01;
					state.attribute_ctrl.mode_ctrl.pixel_clock_select
						= (val >> 6) & 0x01;
					state.attribute_ctrl.mode_ctrl.internal_palette_size
						= (val >> 7) & 0x01;
					if (((val >> 2) & 0x01) != prev_line_graphics) {
						charmap_update = true;
					}
					if (((val >> 7) & 0x01) != prev_int_pal_size) {
						needs_update = true;
					}

					if (trace) {
						util.debug(" :: I/O write 0x3C0:"
							+ " mode control: " + util.format("hex", val));
					}
					break;
				case 0x11: // Overscan Color Register
					state.attribute_ctrl.overscan_color = (val & 0x3F);
					if (trace) {
						util.debug(" :: I/O write 0x3C0: overscan color = "
							+ util.format("hex", val));
					}
					break;
				case 0x12: // Color Plane Enable Register
					state.attribute_ctrl.color_plane_enable = (val & 0x0F);
					needs_update = true;

					if (trace) {
						util.debug(" :: I/O write 0x3c0: color plane enable = "
							+ util.format("hex", val));
					}
					break;
				case 0x13: // Horizontal Pixel Panning Register
					state.attribute_ctrl.horiz_pel_panning = (val & 0x0F);
					needs_update = true;

					if (trace) {
						util.debug(" :: I/O write 0x3C0: horiz pel panning = "
							+ util.format("hex", val));
					}
					break;
				case 0x14: // Color Select Register
					state.attribute_ctrl.color_select = (val & 0x0F);
					needs_update = true;

					if (trace) {
						util.debug(" :: I/O write 0x3C0: color select = "
							+ util.format("hex", state.attribute_ctrl.color_select));
					}
					break;
				default:
					if (trace) {
						util.debug(" :: I/O write 0x3C0: data-write mode "
							+ util.format("hex", state.attribute_ctrl.address));
					}
				}
			}
			state.attribute_ctrl.flip_flop = !state.attribute_ctrl.flip_flop;
			break;

		case 0x03C2: // Miscellaneous Output Register
			state.misc_output.color_emulation  = (val >> 0) & 0x01;
			state.misc_output.enable_ram       = (val >> 1) & 0x01;
			state.misc_output.clock_select     = (val >> 2) & 0x03;
			state.misc_output.select_high_bank = (val >> 5) & 0x01;
			state.misc_output.horiz_sync_pol   = (val >> 6) & 0x01;
			state.misc_output.vert_sync_pol    = (val >> 7) & 0x01;

			if (trace) {
				util.debug(" :: I/O write 3C2:");
				util.debug(" -> color_emulation (attempted) = "
					+ ((val >> 0) & 0x01));
				util.debug(" -> enable_ram = "
					+ state.misc_output.enable_ram);
				util.debug(" -> clock_select = "
					+ state.misc_output.clock_select);
				util.debug(" -> select_high_bank = "
					+ state.misc_output.select_high_bank);
				util.debug(" -> horiz_sync_pol = "
					+ state.misc_output.horiz_sync_pol);
				util.debug(" -> vert_sync_pol = "
					+ state.misc_output.vert_sync_pol);
			}
			break;

		case 0x03C3: // VGA enable
			// Bit0: enables VGA display if set
			state.vga_enabled = val & 0x01;

			if (trace) {
				util.debug(" :: I/O write 0x03C3: VGA enable ="
					+ state.vga_enabled);
			}
			break;

		case 0x03C4: // Sequencer Index Register
			if (val > 4) {
				if (trace) { util.debug(" :: I/O write 3C4: value > 4"); }
			}
			state.sequencer.index = val;
			break;

		case 0x03C5: // Sequencer Registers 00 -> 04
			switch (state.sequencer.index) {
			case 0: // Sequencer: reset
				if (trace) {
					util.debug(" :: I/O write 0x3C5:"
						+ " sequencer reset: value=" + util.format("hex", val));
				}

				if (state.sequencer.reset1 && ((val & 0x01) == 0)) {
					state.sequencer.char_map_select = 0;
					state.charmap_address = 0;
					charmap_update = true;
				}
				state.sequencer.reset1 = (val >> 0) & 0x01;
				state.sequencer.reset2 = (val >> 1) & 0x01;
				break;
			case 1: // Sequencer: clocking mode
				if (trace) {
					util.debug(" :: I/O write 0x3c5="
						+ util.format("hex", val) + ": clocking mode reg: ignoring");
				}
				if ((val & 0x20) > 0) {
					//bx_gui->clear_screen();
					if (trace) { util.warning("clear_screen()"); }
				} else if ((state.sequencer.reg1 & 0x20) > 0) {
					needs_update = true;
				}
				state.sequencer.reg1 = val & 0x3D;
				state.x_dotclockdiv2 = ((val & 0x08) > 0);
				break;
			case 2: // Sequencer: map mask register
				state.sequencer.map_mask = (val & 0x0F);
				break;
			case 3: // Sequencer: character map select register
				state.sequencer.char_map_select = val & 0x3F;
				charmap1 = val & 0x13;
				if (charmap1 > 3) { charmap1 = (charmap1 & 3) + 4; }
				charmap2 = (val & 0x2C) >> 2;
				if (charmap2 > 3) { charmap2 = (charmap2 & 3) + 4; }
				if (state.CRTC.reg[ 0x09 ] > 0) {
					state.charmap_address = charmap_offset[ charmap1 ];
					charmap_update = 1;
				}
				if (charmap2 != charmap1) {
					if (trace) {
						util.info(" :: Char map select: map #2"
							+ " in block #" + charmap2 + " unused");
					}
				}
				break;
			case 4: // Sequencer: memory mode register
				state.sequencer.extended_mem   = (val >> 1) & 0x01;
				state.sequencer.odd_even       = (val >> 2) & 0x01;
				state.sequencer.chain_four     = (val >> 3) & 0x01;

				if (trace) {
					util.debug(" :: I/O write 0x3C5: memory mode:");
					util.debug(" -> extended_mem = " + state.sequencer.extended_mem);
					util.debug(" -> odd_even = " + state.sequencer.odd_even);
					util.debug(" -> chain_four = " + state.sequencer.chain_four);
				}
				break;
			default:
				if (trace) {
					util.debug(" :: I/O write 0x3C5: index "
						+ util.format("hex", state.sequencer.index) + " unhandled");
				}
			}
			break;

		case 0x03C6: // PEL mask
			state.pel.mask = val;
			if (state.pel.mask != 0xFF) {
				if (trace) {
					util.debug(" :: I/O write 0x3C6: PEL mask="
						+ util.format("hex", val) + " != 0xFF");
				}
			}
			// [Bochs] state.pel.mask should be and'd with final value before
			// indexing into color register state.pel.data[]
			break;

		case 0x03C7: // PEL address, read mode
			state.pel.read_data_register = val;
			state.pel.read_data_cycle = 0;
			state.pel.dac_state = 0x03;
			break;

		case 0x03C8: // PEL address write mode
			state.pel.write_data_register = val;
			state.pel.write_data_cycle    = 0;
			state.pel.dac_state = 0x00;
			break;

		case 0x03C9: // PEL Data Register, colors 00 -> FF
			switch (state.pel.write_data_cycle) {
			case 0:
				state.pel.data[ state.pel.write_data_register ].red = val;
				break;
			case 1:
				state.pel.data[ state.pel.write_data_register ].green = val;
				break;
			case 2:
				state.pel.data[ state.pel.write_data_register ].blue = val;

				/** TODO: VBE **/

				// TODO: Get rid of this check & replace w/default
				//       (as for .textUpdate())
				if (device.paletteChange) {
					needs_update |= device.paletteChange(
						state.pel.write_data_register
						, state.pel.data[ state.pel.write_data_register ].red << 2
						, state.pel.data[ state.pel.write_data_register ].green << 2
						, state.pel.data[ state.pel.write_data_register ].blue << 2
					);
				}
				break;
			}

			state.pel.write_data_cycle++;
			if (state.pel.write_data_cycle >= 3) {
				//BX_INFO(("state.pel.data[%u] {r=%u, g=%u, b=%u}",
				//  (unsigned) state.pel.write_data_register,
				//  (unsigned) state.pel.data[state.pel.write_data_register].red,
				//  (unsigned) state.pel.data[state.pel.write_data_register].green,
				//  (unsigned) state.pel.data[state.pel.write_data_register].blue);
				state.pel.write_data_cycle = 0;
				state.pel.write_data_register++;
			}
			break;

		case 0x03CA: // Graphics 2 Position (EGA)
			// [Bochs] ignore, EGA only???
			break;

		case 0x03CC: // Graphics 1 Position (EGA)
			// [Bochs] ignore, EGA only???
			break;

		case 0x03CD: // [Bochs] ???
			if (trace) {
				util.debug(" :: I/O write to 0x3CD = "
					+ util.format("hex", val));
			}
			break;

		case 0x03CE: // Graphics Controller Index Register
			if (val > 0x08) { // [Bochs] ???
				if (trace) { util.debug(" :: I/O write: 0x3CE: value > 8"); }
			}
			state.graphics_ctrl.index = val;
			break;

		case 0x03CF: // Graphics Controller Registers 00 -> 08
			switch (state.graphics_ctrl.index) {
			case 0: // Set/Reset
				state.graphics_ctrl.set_reset = val & 0x0f;
				break;
			case 1: // Enable Set/Reset
				state.graphics_ctrl.enable_set_reset = val & 0x0f;
				break;
			case 2: // Color Compare
				state.graphics_ctrl.color_compare = val & 0x0f;
				break;
			case 3: // Data Rotate
				state.graphics_ctrl.data_rotate	= val & 0x07;
				state.graphics_ctrl.raster_op	= (val >> 3) & 0x03;
				break;
			case 4: // Read Map Select
				state.graphics_ctrl.read_map_select = val & 0x03;

				if (trace) {
					util.debug(" :: I/O write to 0x3CF = "
						+ util.format("hex", val) + " (RMS)");
				}
				break;
			case 5: // Mode
				state.graphics_ctrl.write_mode	= val & 0x03;
				state.graphics_ctrl.read_mode	= (val >> 3) & 0x01;
				state.graphics_ctrl.odd_even	= (val >> 4) & 0x01;
				state.graphics_ctrl.shift_reg	= (val >> 5) & 0x03;

				if (trace) {
					util.debug(" :: I/O write: 0x3CF: mode reg:"
						+ " value = " + util.format("hex", val));
				}
				if (state.graphics_ctrl.odd_even) {
					if (trace) { util.debug(" -> graphics_ctrl.odd_even = 1"); }
				}
				if (state.graphics_ctrl.shift_reg) {
					if (trace) { util.debug(" -> graphics_ctrl.shift_reg = 1"); }
				}
				break;
			case 6: // Miscellaneous
				prev_graphics_alpha = state.graphics_ctrl.graphics_alpha;
				prev_chain_odd_even = state.graphics_ctrl.chain_odd_even;
				prev_memory_mapping = state.graphics_ctrl.memory_mapping;

				state.graphics_ctrl.graphics_alpha = val & 0x01;
				state.graphics_ctrl.chain_odd_even = (val >> 1) & 0x01;
				state.graphics_ctrl.memory_mapping = (val >> 2) & 0x03;

				if (trace) {
					util.debug(" :: Miscellaneous:");
					util.debug(" -> memory_mapping set to ",
						+ state.graphics_ctrl.memory_mapping);
					util.debug(" -> graphics mode set to ",
						+ state.graphics_ctrl.graphics_alpha);
					util.debug(" -> odd_even mode set to ",
						+ state.graphics_ctrl.odd_even);
					util.debug(" :: I/O write: 0x3cf: misc reg: value = "
						+ util.format("hex", val));
				}

				if ( prev_memory_mapping
						!= state.graphics_ctrl.memory_mapping ) {
					needs_update = true;
				}
				if ( prev_graphics_alpha
						!= state.graphics_ctrl.graphics_alpha ) {
					needs_update = true;
					old_iHeight = 0;
				}
				break;
			case 7: // Color Don't Care
				state.graphics_ctrl.color_dont_care = val & 0x0F;
				break;
			case 8: // Bit Mask
				state.graphics_ctrl.bitmask = val;
				break;
			default:
				// [Bochs] ???
				if (trace) {
					util.debug(" :: I/O write: 0x3CF: index "
						+ state.graphics_ctrl.index + " unhandled");
				}
			}
			break;

		case 0x03B4: // CRTC Index Register (monochrome emulation modes)
		case 0x03D4: // CRTC Index Register (color emulation modes)
			state.CRTC.address = val & 0x7F;
			if (state.CRTC.address > 0x18) {
				if (trace) {
					util.debug(" :: I/O write: invalid CRTC register "
						+ util.format("hex", state.CRTC.address) + " selected");
				}
			}
			break;

		case 0x03B5: // CRTC Registers (monochrome emulation modes)
		case 0x03D5: // CRTC Registers (color emulation modes)
			if (state.CRTC.address > 0x18) {
				if (trace) {
					util.debug(" :: I/O write: invalid CRTC register "
						+ util.format("hex", state.CRTC.address) + " ignored");
				}
				return;
			}
			if (state.CRTC.write_protect && (state.CRTC.address < 0x08)) {
				if (state.CRTC.address == 0x07) {
					state.CRTC.reg[ state.CRTC.address ] &= ~0x10;
					state.CRTC.reg[ state.CRTC.address ] |= (val & 0x10);
					state.line_compare &= 0x2ff;
					if (state.CRTC.reg[ 0x07 ] & 0x10) {
						state.line_compare |= 0x100;
					}
					needs_update = true;
					break;
				} else {
					return;
				}
			}
			if (val != state.CRTC.reg[ state.CRTC.address ]) {
				state.CRTC.reg[ state.CRTC.address ] = val;
				switch (state.CRTC.address) {
				case 0x07:
					state.vertical_display_end &= 0xFF;
					if (state.CRTC.reg[ 0x07 ] & 0x02) {
						state.vertical_display_end |= 0x100;
					}
					if (state.CRTC.reg[ 0x07 ] & 0x40) {
						state.vertical_display_end |= 0x200;
					}
					state.line_compare &= 0x2FF;
					if (state.CRTC.reg[ 0x07 ] & 0x10) {
						state.line_compare |= 0x100;
					}
					needs_update = true;
					break;
				case 0x08:
					// Vertical PEL panning change
					needs_update = true;
					break;
				case 0x09:
					state.y_doublescan = ((val & 0x9F) > 0);
					state.line_compare &= 0x1FF;
					if (state.CRTC.reg[ 0x09 ] & 0x40) {
						state.line_compare |= 0x200;
					}
					charmap_update = 1;
					needs_update = true;
					break;
				case 0x0A:
				case 0x0B:
				case 0x0E:
				case 0x0F:
					// Cursor size / location change
					state.vga_mem_updated = true;
					break;
				case 0x0C:
				case 0x0D:
					// Start address change
					if (state.graphics_ctrl.graphics_alpha) {
						needs_update = true;
					} else {
						state.vga_mem_updated = true;
					}
					break;
				case 0x11:
					state.CRTC.write_protect = ((state.CRTC.reg[ 0x11 ] & 0x80) > 0);
					break;
				case 0x12:
					state.vertical_display_end &= 0x300;
					state.vertical_display_end |= state.CRTC.reg[ 0x12 ];
					break;
				case 0x13:
				case 0x14:
				case 0x17:
					/** TODO: VBE **/

					// Line offset change
					state.line_offset = state.CRTC.reg[ 0x13 ] << 1;
					if (state.CRTC.reg[ 0x14 ] & 0x40) {
						state.line_offset <<= 2;
					} else if ((state.CRTC.reg[ 0x17 ] & 0x40) == 0) {
						state.line_offset <<= 1;
					}
					needs_update = true;
					break;
				case 0x18:
					state.line_compare &= 0x300;
					state.line_compare |= state.CRTC.reg[ 0x18 ];
					needs_update = true;
					break;
				}
			}
			break;

		case 0x03DA: // Feature Control (color emulation modes)
			if (trace) {
				util.debug(" :: I/O write: 0x3DA: ignoring:"
					+ " feature ctrl & vert sync");
			}
			break;

		default:
		case 0x03C1: // [Bochs] ???
			util.problem(" :: Unsupported write, address="
				+ util.format("hex", addr) + "!");
			return 0;
		}

		if (charmap_update) {
			if (trace) { util.warning("set_text_charmap()"); }
			//bx_gui->set_text_charmap(
			//	& state.memory[0x20000 + state.charmap_address]);
			state.vga_mem_updated = true;
		}
		if (needs_update) {
			// Mark all video as updated so the changes will go through
			device.redrawArea(0, 0, old_iWidth, old_iHeight);
		}
	}

	// VGA device's I/O memory read operations' handler routine
	function memoryReadHandler(addrA20, len, arg) {
		var idx, val = memoryRead(arg, addrA20);
		// Start from 1 because of 1st read above
		for (idx = 1 ; idx < len ; ++idx) {
			val |= memoryRead(arg, addrA20 + idx) << (8 * idx);
		}
		return val;
	}
	// Handles 8-bit reads: see memoryReadHandler() for how multi-byte
	//	values are dispatched to this function
	function memoryRead(device, addrA20) {
		var machine = device.machine
			, state = device.state
			, bufVRAM = device.bufVRAM
			, offset = 0x00000000
//Bit32u offset;
//  Bit8u *plane0, *plane1, *plane2, *plane3;
			, color_compare = 0x00, color_dont_care = 0x00
			, latch0 = 0x00, latch1 = 0x00, latch2 = 0x00, latch3 = 0x00
			, retval = 0x00;

		/** TODO: VBE **/

		if (trace) {
			util.info("VGA memoryRead() :: 8-bit read from "
				+ util.format("hex", addrA20));
		}
//#if defined(VGA_TRACE_FEATURE)
//  BX_DEBUG(("8-bit memory read from 0x%08x", addr));
//#endif

/*#ifdef __OS2__

#if BX_PLUGINS
#error Fix the code for plugins
#endif

  if (bx_options.videomode == BX_VIDEO_DIRECT)
  {
     char value;
     value = devices->mem->video[addr-0xA0000];
     return value;
  }
#endif*/

		// Check address is in bounds according to current memory mapping
		//	(mapping changes depending on the video mode)
		switch (state.graphics_ctrl.memory_mapping) {
		case 1: // 0xA0000 -> 0xAFFFF
			if (addrA20 > 0xAFFFF) { return 0xff; }
			offset = addrA20 & 0xFFFF;
			break;
		case 2: // 0xB0000 -> 0xB7FFF
			if ((addrA20 < 0xB0000) || (addrA20 > 0xB7FFF)) { return 0xff; }
			offset = addrA20 & 0x7FFF;
			break;
		case 3: // 0xB8000 -> 0xBFFFF
			if (addrA20 < 0xB8000) { return 0xff; }
			offset = addrA20 & 0x7FFF;
			break;
		default: // 0xA0000 -> 0xBFFFF
			offset = addrA20 & 0x1FFFF;
		}

		if (state.sequencer.chain_four) {
			// Mode 13h: 320 x 200 256 color mode: chained pixel representation
			return bufVRAM[ (offset & ~0x03) + (offset % 4)*65536 ];
		}

		/** TODO: VBE **/

		//plane0 = &state.memory[0<<16];
		//plane1 = &state.memory[1<<16];
		//plane2 = &state.memory[2<<16];
		//plane3 = &state.memory[3<<16];

		// Addr between 0xA0000 and 0xAFFFF
		switch (state.graphics_ctrl.read_mode) {
		case 0: // Read mode 0
			state.graphics_ctrl.latch[ 0 ] = bufVRAM[ offset ];
			state.graphics_ctrl.latch[ 1 ] = bufVRAM[ (1<<16) + offset ];
			state.graphics_ctrl.latch[ 2 ] = bufVRAM[ (2<<16) + offset ];
			state.graphics_ctrl.latch[ 3 ] = bufVRAM[ (3<<16) + offset ];
			return state.graphics_ctrl.latch[state.graphics_ctrl.read_map_select];
			break;
		case 1: // Read mode 1
			color_compare   = state.graphics_ctrl.color_compare & 0x0f;
			color_dont_care = state.graphics_ctrl.color_dont_care & 0x0f;
			latch0 = state.graphics_ctrl.latch[ 0 ] = bufVRAM[ offset ];
			latch1 = state.graphics_ctrl.latch[ 1 ] = bufVRAM[ (1<<16) + offset ];
			latch2 = state.graphics_ctrl.latch[ 2 ] = bufVRAM[ (2<<16) + offset ];
			latch3 = state.graphics_ctrl.latch[ 3 ] = bufVRAM[ (3<<16) + offset ];

			latch0 ^= ccdat[ color_compare ][ 0 ];
			latch1 ^= ccdat[ color_compare ][ 1 ];
			latch2 ^= ccdat[ color_compare ][ 2 ];
			latch3 ^= ccdat[ color_compare ][ 3 ];

			latch0 &= ccdat[ color_dont_care ][ 0 ];
			latch1 &= ccdat[ color_dont_care ][ 1 ];
			latch2 &= ccdat[ color_dont_care ][ 2 ];
			latch3 &= ccdat[ color_dont_care ][ 3 ];

			retval = ~(latch0 | latch1 | latch2 | latch3);

			return retval;
		default:
			return 0;
		}
	}
	// VGA device's I/O memory write operations' handler routine
	function memoryWriteHandler(addrA20, val, len, arg) {
		var idx;
		for (idx = 0 ; idx < len ; ++idx) {
			memoryWrite(arg, addrA20 + idx
				, (val >> (8 * idx)) & 0xFF);
		}
	}
	// Handles 8-bit writes: see memoryWriteHandler() for how multi-byte
	//	values are dispatched to this function
	function memoryWrite(device, addrA20, val) {
		var machine = device.machine
			, state = device.state
			, bufVRAM = device.bufVRAM
			, offset = 0x00000000
			, new_val = new Array(4)
			, start_addr;
			//Bit8u *plane0, *plane1, *plane2, *plane3;

		/** TODO: VBE **/

		if (trace) {
			util.info("VGA memoryWrite() :: 8-bit write to "
				+ util.format("hex", addrA20) + " = " + util.format("hex", val));
		}

		//if (val === "?".charCodeAt(0)) {
		//	debugger;
		//}

		//if (val === "/".charCodeAt(0)) { debugger; }

		/** TODO: OS/2 **/

		// Check address is in bounds according to current memory mapping
		//	(mapping changes depending on the video mode)
		switch (state.graphics_ctrl.memory_mapping) {
		case 1: // 0xA0000 -> 0xAFFFF
			if ((addrA20 < 0xA0000) || (addrA20 > 0xAFFFF)) { return; }
			offset = addrA20 - 0xA0000;
			break;
		case 2: // 0xB0000 -> 0xB7FFF
			if ((addrA20 < 0xB0000) || (addrA20 > 0xB7FFF)) { return; }
			offset = addrA20 - 0xB0000;
			break;
		case 3: // 0xB8000 -> 0xBFFFF
			if ((addrA20 < 0xB8000) || (addrA20 > 0xBFFFF)) { return; }
			offset = addrA20 - 0xB8000;
			break;
		default: // 0xA0000 -> 0xBFFFF
			if ((addrA20 < 0xA0000) || (addrA20 > 0xBFFFF)) { return; }
			offset = addrA20 - 0xA0000;
		}

		start_addr = (state.CRTC.reg[0x0c] << 8) | state.CRTC.reg[0x0d];

		if (state.graphics_ctrl.graphics_alpha) {
			util.panic("VGA memoryWrite() :: Gfx mode not implemented yet");
		}

		/** Address between 0xA0000 and 0xAFFFF **/

		/** TODO: VBE **/

		//plane0 = &state.memory[0<<16];
		//plane1 = &state.memory[1<<16];
		//plane2 = &state.memory[2<<16];
		//plane3 = &state.memory[3<<16];

		var i;
		switch (state.graphics_ctrl.write_mode) {
		case 0: /* write mode 0 */
			{
			/*const Bit8u*/var bitmask = state.graphics_ctrl.bitmask;
			/*const Bit8u*/var set_reset = state.graphics_ctrl.set_reset;
			/*const Bit8u*/var enable_set_reset = state.graphics_ctrl.enable_set_reset;
			/* perform rotate on CPU data in case its needed */
			if (state.graphics_ctrl.data_rotate) {
				val = (val >> state.graphics_ctrl.data_rotate) |
				(val << (8 - state.graphics_ctrl.data_rotate));
			}
			new_val[0] = state.graphics_ctrl.latch[0] & ~bitmask;
			new_val[1] = state.graphics_ctrl.latch[1] & ~bitmask;
			new_val[2] = state.graphics_ctrl.latch[2] & ~bitmask;
			new_val[3] = state.graphics_ctrl.latch[3] & ~bitmask;
			switch (state.graphics_ctrl.raster_op) {
			case 0: // replace
				new_val[0] |= ((enable_set_reset & 1)
				? ((set_reset & 1) ? bitmask : 0)
				: (val & bitmask));
				new_val[1] |= ((enable_set_reset & 2)
				? ((set_reset & 2) ? bitmask : 0)
				: (val & bitmask));
				new_val[2] |= ((enable_set_reset & 4)
				? ((set_reset & 4) ? bitmask : 0)
				: (val & bitmask));
				new_val[3] |= ((enable_set_reset & 8)
				? ((set_reset & 8) ? bitmask : 0)
				: (val & bitmask));
				break;
			case 1: // AND
				new_val[0] |= ((enable_set_reset & 1)
				? ((set_reset & 1)
				? (state.graphics_ctrl.latch[0] & bitmask)
				: 0)
				: (val & state.graphics_ctrl.latch[0]) & bitmask);
				new_val[1] |= ((enable_set_reset & 2)
				? ((set_reset & 2)
				? (state.graphics_ctrl.latch[1] & bitmask)
				: 0)
				: (val & state.graphics_ctrl.latch[1]) & bitmask);
				new_val[2] |= ((enable_set_reset & 4)
				? ((set_reset & 4)
				? (state.graphics_ctrl.latch[2] & bitmask)
				: 0)
				: (val & state.graphics_ctrl.latch[2]) & bitmask);
				new_val[3] |= ((enable_set_reset & 8)
				? ((set_reset & 8)
				? (state.graphics_ctrl.latch[3] & bitmask)
				: 0)
				: (val & state.graphics_ctrl.latch[3]) & bitmask);
				break;
			case 2: // OR
				new_val[0]
				|= ((enable_set_reset & 1)
				? ((set_reset & 1)
				? bitmask
				: (state.graphics_ctrl.latch[0] & bitmask))
				: ((val | state.graphics_ctrl.latch[0]) & bitmask));
				new_val[1]
				|= ((enable_set_reset & 2)
				? ((set_reset & 2)
				? bitmask
				: (state.graphics_ctrl.latch[1] & bitmask))
				: ((val | state.graphics_ctrl.latch[1]) & bitmask));
				new_val[2]
				|= ((enable_set_reset & 4)
				? ((set_reset & 4)
				? bitmask
				: (state.graphics_ctrl.latch[2] & bitmask))
				: ((val | state.graphics_ctrl.latch[2]) & bitmask));
				new_val[3]
				|= ((enable_set_reset & 8)
				? ((set_reset & 8)
				? bitmask
				: (state.graphics_ctrl.latch[3] & bitmask))
				: ((val | state.graphics_ctrl.latch[3]) & bitmask));
				break;
			case 3: // XOR
				new_val[0]
				|= ((enable_set_reset & 1)
				? ((set_reset & 1)
				? (~state.graphics_ctrl.latch[0] & bitmask)
				: (state.graphics_ctrl.latch[0] & bitmask))
				: (val ^ state.graphics_ctrl.latch[0]) & bitmask);
				new_val[1]
				|= ((enable_set_reset & 2)
				? ((set_reset & 2)
				? (~state.graphics_ctrl.latch[1] & bitmask)
				: (state.graphics_ctrl.latch[1] & bitmask))
				: (val ^ state.graphics_ctrl.latch[1]) & bitmask);
				new_val[2]
				|= ((enable_set_reset & 4)
				? ((set_reset & 4)
				? (~state.graphics_ctrl.latch[2] & bitmask)
				: (state.graphics_ctrl.latch[2] & bitmask))
				: (val ^ state.graphics_ctrl.latch[2]) & bitmask);
				new_val[3]
				|= ((enable_set_reset & 8)
				? ((set_reset & 8)
				? (~state.graphics_ctrl.latch[3] & bitmask)
				: (state.graphics_ctrl.latch[3] & bitmask))
				: (val ^ state.graphics_ctrl.latch[3]) & bitmask);
				break;
			default:
				util.panic("VGA memoryWrite() :: Write mode 0: op = ",
					+ state.graphics_ctrl.raster_op);
			}
			}
			break;
		case 1: // Write mode 1
			for (i = 0 ; i < 4 ; i++) {
				new_val[ i ] = state.graphics_ctrl.latch[ i ];
			}
			break;
		case 2: // Write mode 2
			{
			/*const Bit8u*/var bitmask = state.graphics_ctrl.bitmask;

			new_val[0] = state.graphics_ctrl.latch[0] & ~bitmask;
			new_val[1] = state.graphics_ctrl.latch[1] & ~bitmask;
			new_val[2] = state.graphics_ctrl.latch[2] & ~bitmask;
			new_val[3] = state.graphics_ctrl.latch[3] & ~bitmask;
			switch (state.graphics_ctrl.raster_op) {
			case 0: // write
				new_val[0] |= (val & 1) ? bitmask : 0;
				new_val[1] |= (val & 2) ? bitmask : 0;
				new_val[2] |= (val & 4) ? bitmask : 0;
				new_val[3] |= (val & 8) ? bitmask : 0;
				break;
			case 1: // AND
				new_val[0] |= (val & 1)
				? (state.graphics_ctrl.latch[0] & bitmask)
				: 0;
				new_val[1] |= (val & 2)
				? (state.graphics_ctrl.latch[1] & bitmask)
				: 0;
				new_val[2] |= (val & 4)
				? (state.graphics_ctrl.latch[2] & bitmask)
				: 0;
				new_val[3] |= (val & 8)
				? (state.graphics_ctrl.latch[3] & bitmask)
				: 0;
				break;
			case 2: // OR
				new_val[0] |= (val & 1)
				? bitmask
				: (state.graphics_ctrl.latch[0] & bitmask);
				new_val[1] |= (val & 2)
				? bitmask
				: (state.graphics_ctrl.latch[1] & bitmask);
				new_val[2] |= (val & 4)
				? bitmask
				: (state.graphics_ctrl.latch[2] & bitmask);
				new_val[3] |= (val & 8)
				? bitmask
				: (state.graphics_ctrl.latch[3] & bitmask);
				break;
			case 3: // XOR
				new_val[0] |= (val & 1)
				? (~state.graphics_ctrl.latch[0] & bitmask)
				: (state.graphics_ctrl.latch[0] & bitmask);
				new_val[1] |= (val & 2)
				? (~state.graphics_ctrl.latch[1] & bitmask)
				: (state.graphics_ctrl.latch[1] & bitmask);
				new_val[2] |= (val & 4)
				? (~state.graphics_ctrl.latch[2] & bitmask)
				: (state.graphics_ctrl.latch[2] & bitmask);
				new_val[3] |= (val & 8)
				? (~state.graphics_ctrl.latch[3] & bitmask)
				: (state.graphics_ctrl.latch[3] & bitmask);
				break;
			}
			}
			break;
		case 3: // Write mode 3
			{
			/*const Bit8u*/var bitmask = state.graphics_ctrl.bitmask & val;
			/*const Bit8u*/var set_reset = state.graphics_ctrl.set_reset;

			/* perform rotate on CPU data */
			if (state.graphics_ctrl.data_rotate) {
				val = (val >> state.graphics_ctrl.data_rotate) |
				(val << (8 - state.graphics_ctrl.data_rotate));
			}
			new_val[0] = state.graphics_ctrl.latch[0] & ~bitmask;
			new_val[1] = state.graphics_ctrl.latch[1] & ~bitmask;
			new_val[2] = state.graphics_ctrl.latch[2] & ~bitmask;
			new_val[3] = state.graphics_ctrl.latch[3] & ~bitmask;

			val &= bitmask;

			switch (state.graphics_ctrl.raster_op) {
			case 0: // write
				new_val[0] |= (set_reset & 1) ? val : 0;
				new_val[1] |= (set_reset & 2) ? val : 0;
				new_val[2] |= (set_reset & 4) ? val : 0;
				new_val[3] |= (set_reset & 8) ? val : 0;
				break;
			case 1: // AND
				new_val[0] |= ((set_reset & 1) ? val : 0)
				& state.graphics_ctrl.latch[0];
				new_val[1] |= ((set_reset & 2) ? val : 0)
				& state.graphics_ctrl.latch[1];
				new_val[2] |= ((set_reset & 4) ? val : 0)
				& state.graphics_ctrl.latch[2];
				new_val[3] |= ((set_reset & 8) ? val : 0)
				& state.graphics_ctrl.latch[3];
				break;
			case 2: // OR
				new_val[0] |= ((set_reset & 1) ? val : 0)
				| state.graphics_ctrl.latch[0];
				new_val[1] |= ((set_reset & 2) ? val : 0)
				| state.graphics_ctrl.latch[1];
				new_val[2] |= ((set_reset & 4) ? val : 0)
				| state.graphics_ctrl.latch[2];
				new_val[3] |= ((set_reset & 8) ? val : 0)
				| state.graphics_ctrl.latch[3];
				break;
			case 3: // XOR
				new_val[0] |= ((set_reset & 1) ? val : 0)
				^ state.graphics_ctrl.latch[0];
				new_val[1] |= ((set_reset & 2) ? val : 0)
				^ state.graphics_ctrl.latch[1];
				new_val[2] |= ((set_reset & 4) ? val : 0)
				^ state.graphics_ctrl.latch[2];
				new_val[3] |= ((set_reset & 8) ? val : 0)
				^ state.graphics_ctrl.latch[3];
				break;
			}
			}
			break;
		default:
			util.panic("VGA memoryWrite() :: Write mode %u ?",
				+ state.graphics_ctrl.write_mode);
		}

		if (state.sequencer.map_mask & 0x0f) {
			state.vga_mem_updated = true;
			if (state.sequencer.map_mask & 0x01) {
				bufVRAM[offset] = new_val[0];
			}
			if (state.sequencer.map_mask & 0x02) {
				bufVRAM[(1<<16)+offset] = new_val[1];
			}
			if (state.sequencer.map_mask & 0x04) {
				if ((offset & 0xe000) == state.charmap_address) {
					//bx_gui->set_text_charbyte((offset & 0x1fff), new_val[2]);
					//if (trace) { util.warning("set_text_charbyte()"); }

					// TODO: Get rid of this check & replace w/default
					//       (as for .textUpdate())
					if (device.setTextCharByte) {
						device.setTextCharByte((offset & 0x1fff), new_val[ 2 ]);
					}
				}
				bufVRAM[(2<<16)+offset] = new_val[2];
			}
			if (state.sequencer.map_mask & 0x08) {
				bufVRAM[(3<<16)+offset] = new_val[3];
			}
			var x_tileno, y_tileno;

			if (state.graphics_ctrl.shift_reg == 2) {
				offset -= start_addr;
				x_tileno = (offset % state.line_offset) * 4 / (X_TILESIZE / 2);
				if (state.y_doublescan) {
					y_tileno = (offset / state.line_offset) / (Y_TILESIZE / 2);
				} else {
					y_tileno = (offset / state.line_offset) / Y_TILESIZE;
				}
				device.setTileUpdated(x_tileno >>> 0, y_tileno >>> 0, 1);
			} else {
				if (state.line_compare < state.vertical_display_end) {
					if (state.line_offset > 0) {
						if (state.x_dotclockdiv2) {
							x_tileno = (offset % state.line_offset) / (X_TILESIZE / 16);
						} else {
							x_tileno = (offset % state.line_offset) / (X_TILESIZE / 8);
						}
						if (state.y_doublescan) {
							y_tileno = ((offset / state.line_offset) * 2 + state.line_compare + 1) / Y_TILESIZE;
						} else {
							y_tileno = ((offset / state.line_offset) + state.line_compare + 1) / Y_TILESIZE;
						}
						device.setTileUpdated(x_tileno >>> 0, y_tileno >>> 0, 1);
					}
				}
				if (offset >= start_addr) {
					offset -= start_addr;
					if (state.line_offset > 0) {
						if (state.x_dotclockdiv2) {
							x_tileno = (offset % state.line_offset) / (X_TILESIZE / 16);
						} else {
							x_tileno = (offset % state.line_offset) / (X_TILESIZE / 8);
						}
						if (state.y_doublescan) {
							y_tileno = (offset / state.line_offset) / (Y_TILESIZE / 2);
						} else {
							y_tileno = (offset / state.line_offset) / Y_TILESIZE;
						}
						device.setTileUpdated(x_tileno >>> 0, y_tileno >>> 0, 1);
					}
				}
			}
		}
	}

	// Periodic timer handler (see VGA.initSystemTimer())
	//	Based on [bx_vga_c::timer_handler]
	function handleTimer(ticksNow) {
		this.update();
	}
	/* ====== /Private ====== */

	// Exports
	return VGA;
});
