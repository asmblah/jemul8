/*
 * jemul8 - JavaScript x86 Emulator
 *
 * MODULE: Segment Descriptor (selected by Selector) class support
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
	"../../util"
], function (
	util
) {
    "use strict";

	// Segment Descriptor class constructor
	function Descriptor() {
		util.assert(this && (this instanceof Descriptor),
			"Descriptor constructor :: error - not called properly");

		// ACCESS_INVALID, ACCESS_VALID_CACHE,
		//  ACCESS_ROK or ACCESS_WOK
		this.accessType = util.ACCESS_INVALID;

		// Is segment present (in memory,
		//  ie. not out on mass storage device) or not?
		this.present = false;

		// Descriptor Privilege Level (0 -> 3)
		this.dpl = 0;

		// True = data/code segment, false = system/gate
		this.segment = false;

		// One of util.DESC_* constants, depends on ".segment" type
		this.type = 0;

		/* ==== Segment Descriptor fields ==== */
		// Base address: 286 = 24-bits, 386 = 32-bits
		this.base = 0;
		// (From Bochs) for efficiency, this contrived field is set to:
		// - "limit" for byte granular
		// - "(limit << 12) | 0xFFF" for page granular seg's
		this.limitScaled = 0xFFFF;
		// Page granularity bit: 0 = byte, 1 = 4K (page)
		this.use4KPages = false;
		// Operand & Address-size defaults:
		// - true = 32-bit operand-size & address-size by default
		// - false = 16-bit operand-size & address-size by default
		// (where "by default" means when not overridden by prefix byte)
		this.default32BitSize = false;
		// One extra bit, free for OS/programmer use
		this.available = 0;
		/* ==== /Segment Descriptor fields ==== */

		/* ==== Gate fields ==== */
		// 5 bits (0 ... 31) - no. of words/dwords to copy
		//  from caller's stack to called procedure's stack
		this.paramCount = 0;
		this.destSelector = 0;
		this.destOffset = 0;
		/* ==== /Gate fields ==== */

		/* ==== Task Gate fields ==== */
		// TSS segment selector
		this.tssSelector = 0;
		/* ==== /Task Gate fields ==== */
	}
	util.extend(Descriptor, {
		// Parse a raw segment descriptor
		parse: function (raw) {
			var descriptor = new Descriptor();
			return descriptor.parse(raw);
		}
	});
	util.extend(Descriptor.prototype, {
		// Reconstruct raw value of descriptor from components
		getValue: function () {
			//return this.rpl
			//	| (this.table << 2)
			//	| (this.index << 3);
		},
		// Parse raw descriptor & load into descriptor
		parse: function (raw) {
			var ARByte,
				limit,
				// High & low dwords of 64-bit raw descriptor
				dword1 = raw.dword1,
				dword2 = raw.dword2;

			// Access Rights byte
			ARByte       = dword2 >> 8;
			this.present = (ARByte >> 7) & 0x1;
			this.dpl     = (ARByte >> 5) & 0x3;
			this.segment = (ARByte >> 4) & 0x1;
			this.type    = (ARByte & 0xF);
			this.accessType = util.ACCESS_INVALID; // Start out invalid

			// Data/code segment descriptors
			if (this.segment) {
				limit = (dword1 & 0xFFFF) | (dword2 & 0x000F0000);

				this.base             = ((dword1 >>> 16) | ((dword2 & 0xFF) << 16)) >>> 0;
				this.use4KPages       = (dword2 & 0x00800000) > 0;
				this.default32BitSize = (dword2 & 0x00400000) > 0;
				this.available        = (dword2 & 0x00100000) > 0;
				this.base             = (this.base | (dword2 & 0xFF000000)) >>> 0;

				if (this.use4KPages) {
					this.limitScaled = ((limit << 12) | 0xFFF) >>> 0;
				} else {
					this.limitScaled = limit >>> 0;
				}

				this.accessType = util.ACCESS_VALID_CACHE;
			// System & gate segment descriptors
			} else {
				switch (this.type) {
				case util.DESC_286_CALL_GATE:
				case util.DESC_286_INTERRUPT_GATE:
				case util.DESC_286_TRAP_GATE:
					// param count only used for call gate
					this.param_count   = dword2 & 0x1F;
					this.destSelector = dword1 >> 16;
					this.destOffset   = dword1 & 0xFFFF;
					this.accessType = util.ACCESS_VALID_CACHE;
					break;

				case util.DESC_386_CALL_GATE:
				case util.DESC_386_INTERRUPT_GATE:
				case util.DESC_386_TRAP_GATE:
					// param count only used for call gate
					this.param_count   = dword2 & 0x1f;
					this.dest_selector = dword1 >> 16;
					this.dest_offset   = (dword2 & 0xffff0000) |
						(dword1 & 0x0000ffff);
					this.accessType = util.ACCESS_VALID_CACHE;
					break;

				case util.DESC_TASK_GATE:
					this.tssSelector = dword1 >> 16;
					this.accessType = util.ACCESS_VALID_CACHE;
					break;

				case util.DESC_SYS_SEGMENT_LDT:
				case util.DESC_SYS_SEGMENT_AVAIL_286_TSS:
				case util.DESC_SYS_SEGMENT_BUSY_286_TSS:
				case util.DESC_SYS_SEGMENT_AVAIL_386_TSS:
				case util.DESC_SYS_SEGMENT_BUSY_386_TSS:
					limit = (dword1 & 0xFFFF) | (dword2 & 0x000F0000);
					this.base  = (dword1 >> 16)
						| ((dword2 & 0xff) << 16)
						| (dword2 & 0xff000000);
					this.use4KPages = (dword2 & 0x00800000) > 0;
					this.default32BitSize = (dword2 & 0x00400000) > 0;
					this.available = (dword2 & 0x00100000) > 0;

					if (this.use4KPages) {
						// Push 12 1-bits on to multiply by size of pages (4K)
						this.limitScaled = ((limit << 12) | 0xFFF) >>> 0;
					} else {
						this.limitScaled = limit >>> 0;
					}
					this.accessType = util.ACCESS_VALID_CACHE;
					break;
				// Reserved
				default:
					this.accessType = util.ACCESS_INVALID;
				}
			}

			return this;
		},
		// Is segment's descriptor valid or not
		isValid: function () {
			return this.accessType !== util.ACCESS_INVALID;
		},
		// Is the descriptor pointing to a code/data segment?
		isSegment: function () {
			return this.segment;
		},
		// Is the segment present (resident in memory) or not?
		isPresent: function () {
			return this.present;
		},
		isCodeSegment: function () {
			return (this.type >> 3) & 0x1;
		},
		isCodeSegmentConforming: function () {
			return (this.type >> 2) & 0x1;
		},
		isCodeSegmentNonConforming: function () {
			return !this.isCodeSegmentConforming();
		},
		isCodeSegmentReadable: function () {
			return (this.type >> 1) & 0x1;
		},
		isDataSegment: function () {
			return !this.isCodeSegment();
		},
		isDataSegmentExpandDown: function () {
			return (this.type >> 2) & 0x1;
		},
		isDataSegmentWriteable: function () {
			return (this.type >> 1) & 0x1;
		},
		isSegmentAccessed: function () {
			return this.type & 0x1;
		},
		// Build/extract Access Rights byte for descriptor
		getARByte: function () {
			return this.type
				| (this.segment << 4)
				| (this.dpl << 5)
				| (this.present << 7);
		},
		// Update descriptor's Access Rights fields
		setARByte: function (val) {
			this.present = (val >> 7) & 0x01;
			this.dpl = (val >> 5) & 0x03;
			this.segment = (val >> 4) & 0x01;
			this.type = val & 0x0F;

			return this;
		},
		// Segment has been accessed: set bit (see DESC_*_ACCESSED constants)
		segmentAccessed: function () {
			this.type |= 1;
		}
	});

	// Exports
	return Descriptor;
});
