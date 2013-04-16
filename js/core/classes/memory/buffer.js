/*
 * jemul8 - JavaScript x86 Emulator
 *
 * MODULE: Data buffer support
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

	var DataViewClass = typeof DataView !== "undefined" ? DataView : null
	// NB: These are NOT the same as DataViewClass.prototype below
	, arrayAccessors = {
		getUint8: function (offset, littleEndian) {
			return this[ offset ];
		}, getUint16: function (offset, littleEndian) {
			return (this[ offset + 1 ] << 8)
				| (this[ offset ]);
		}, getUint32: function (offset, littleEndian) {
			return (this[ offset + 3 ] << 24)
				| (this[ offset + 2 ] << 16)
				| (this[ offset + 1 ] << 8)
				| (this[ offset ]);
		}, setUint8: function (offset, val, littleEndian) {
			this[ offset ] = val;
		}, setUint16: function (offset, val, littleEndian) {
			this[ offset ] = val & 0xFF;
			this[ offset + 1 ] = (val >> 8) & 0xFF;
		}, setUint32: function (offset, val, littleEndian) {
			this[ offset ] = val & 0xFF;
			this[ offset + 1 ] = (val >> 8) & 0xFF;
			this[ offset + 2 ] = (val >> 16) & 0xFF;
			this[ offset + 3 ] = (val >> 24) & 0xFF;
		}
	};

	// Buffer static class
	function Buffer() {
		util.problem("Buffer is static-only!");
	}

	// Emulate DataView if no native support available
	// - Unfortunately, this adds some overhead to access
	//   as the .byteView lookup must be performed
	if (util.support.typedArrays && !DataViewClass) {
		DataViewClass = function (buffer) {
			this.buffer = Buffer.getBuffer(buffer);
			this.byteView = new Uint8Array(this.buffer);
			this.byteLength = this.buffer.byteLength || this.buffer.length || 0;
		};
		// NB: Typed Arrays must be aligned for access,
		//     it is probably quicker to stick with these Array-style accessors
		util.extend(DataViewClass.prototype, {
			getUint8: function (offset, littleEndian) {
				return this.byteView[ offset ];
			}, getUint16: function (offset, littleEndian) {
				return (this.byteView[ offset + 1 ] << 8)
					| (this.byteView[ offset ]);
			}, getUint32: function (offset, littleEndian) {
				return (this.byteView[ offset + 3 ] << 24)
					| (this.byteView[ offset + 2 ] << 16)
					| (this.byteView[ offset + 1 ] << 8)
					| (this.byteView[ offset ]);
			}, setUint8: function (offset, val, littleEndian) {
				this.byteView[ offset ] = val;
			}, setUint16: function (offset, val, littleEndian) {
				this.byteView[ offset ] = val & 0xFF;
				this.byteView[ offset + 1 ] = (val >> 8) & 0xFF;
			}, setUint32: function (offset, val, littleEndian) {
				this.byteView[ offset ] = val & 0xFF;
				this.byteView[ offset + 1 ] = (val >> 8) & 0xFF;
				this.byteView[ offset + 2 ] = (val >> 16) & 0xFF;
				this.byteView[ offset + 3 ] = (val >> 24) & 0xFF;
			}
		});
	}

	// Allocates a multi-byte capable memory buffer for data storage
	Buffer.createBuffer = function (len) {
		var buf;
		// Ultra-modern, fast Typed Arrays support (faster)
		if (util.support.typedArrays) {
			return new ArrayBuffer(len);
		/** TODO: Support ImageData for slightly older browsers
			(off Canvas context) **/
		// Legacy native Arrays support (slower)
		} else {
			buf = new Array(len);

			// Zero-out all bytes in memory (otherwise they will be undefined)
			for (var i = 0 ; i < len ; ++i) {
				buf[ i ] = 0x00;
			}
			return buf;
		}
	};
	// Wraps an ArrayBuffer with a Uint8Array view
	Buffer.wrapByteBuffer = function (buf) {
		// Wrapping only applies where there is ArrayBuffer support
		if (!util.support.typedArrays) { return buf; }

		return new Uint8Array(buf);
	};
	// Wraps an ArrayBuffer with the most optimised view
	//	suitable & available for being multibyte-capable
	//	(ie. supporting .getUint8()/.getUint16()/.getUint32())
	Buffer.wrapMultibyteBuffer = function (buf) {
		// Native ArrayBuffers support: use DataView if possible
		if (util.support.typedArrays) {
			return new DataViewClass(buf);
		}

		// Only Arrays support: just augment DataView accessors on
		util.extend(buf, arrayAccessors);
		return buf;
	};
	// Helper for easily creating Uint8Array-wrapped buffers
	Buffer.createByteBuffer = function (len) {
		return this.wrapByteBuffer(this.createBuffer(len));
	};
	// For wiping a buffer
	Buffer.zeroBuffer = function (buf, offset, len) {
		Buffer.setBuffer(buf, offset, 0, len);
	};
	// For setting multiple elements in a buffer
	Buffer.setBuffer = function (buf, offset, val, len) {
		// TODO: Support "val" properly
		if (val !== 0) { error(); }

		var idx, bufLen = Buffer.getBufferLength(buf), oldLen;
		// Zero from start of buffer by default
		if (offset === undefined) { offset = 0; }
		// Zero to end of buffer by default
		if (len === undefined) { len = bufLen - offset; }

		if (util.support.typedArrays) {
			new Uint8Array(buf).set(new Uint8Array(len), offset);
		} else {
			// Optimised case: wiping to end of buffer
			if (len === bufLen - offset) {
				// Wipe the data by destroying all elements above offset,
				//  then restore the length - remember that "undefined"
				//	will be the value of each element, not a zero!!!
				oldLen = buf.length;
				buf.length = offset;
				buf.length = oldLen;
			// Slower case - need to iterate
			} else {
				for (idx = offset, end = len - offset ; idx < end ; ++idx) {
					buf[ idx ] = val;
				}
			}
		}
	};
	Buffer.getBufferLength = function (buf) {
		return ("byteLength" in buf) ? buf.byteLength : buf.length;
	};
	Buffer.getBuffer = function (buf) {
		return buf.buffer || buf;
	};
	// C/C++ memcpy()-esque method for memory buffers
	Buffer.copy = function (bufFrom, offsetFrom, bufTo, offsetTo, len) {
		if ((offsetFrom + len) > Buffer.getBufferLength(bufFrom)) {
			util.warning("Buffer.copy() :: offset+len"
				+ " tries to copy past end of source buffer");
			//return 0;
			len -= (offsetFrom + len) - Buffer.getBufferLength(bufFrom);
			if (len < 0) {
				return 0;
			}
		}
		if ((offsetTo + len) > Buffer.getBufferLength(bufTo)) {
			util.panic("Buffer.copy() :: Error - offset+len"
				+ " tries to copy past end of dest buffer");
			return 0;
		}
		bufFrom = Buffer.getBuffer(bufFrom);
		bufTo = Buffer.getBuffer(bufTo);

		// Perform the copy
		if (util.support.typedArrays) {
			new Uint8Array(bufTo)
				.set(new Uint8Array(bufFrom, offsetFrom, len), offsetTo);
		} else {
			// TODO: Use [].splice.apply(...) to optimise
			//       copying between legacy Arrays
			var i, j, end;
			for ( i = offsetFrom, j = offsetTo, end = i + len
				; i < end ; ++i, ++j
			) {
				bufTo[ j ] = bufFrom[ i ];
			}
		}

		return len; // Return total no. of bytes copied
	};

	return Buffer;
});
