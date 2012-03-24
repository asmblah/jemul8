/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *	
 *	MODULE: Memory (RAM) <-> Northbridge support
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("memory/buffer", function ( $ ) { "use strict";
	var jemul8 = this.data("jemul8")
		, Memory = jemul8.Memory;
	
	// DataView method emulators for legacy Arrays
	var accessors = {
		getUint8: function ( offset, littleEndian ) {
			return this[ offset ];
		}, getUint16: function ( offset, littleEndian ) {
			return (this[ offset + 1 ] << 8) | (this[ offset ]);
		}, getUint32: function ( offset, littleEndian ) {
			return (this[ offset + 3 ] << 24)
					| (this[ offset + 2 ] << 16)
					| (this[ offset + 1 ] << 8)
					| (this[ offset ]);
		}, setUint8: function ( offset, val, littleEndian ) {
			this[ offset ] = val;
		}, setUint16: function ( offset, val, littleEndian ) {
			this[ offset ] = val & 0xFF;
			this[ offset + 1 ] = (val >> 8) & 0xFF;
		}, setUint32: function ( offset, val, littleEndian ) {
			this[ offset ] = val & 0xFF;
			this[ offset + 1 ] = (val >> 8) & 0xFF;
			this[ offset + 2 ] = (val >> 16) & 0xFF;
			this[ offset + 3 ] = (val >> 24) & 0xFF;
		}
	};
	
	// Allocates a multi-byte capable memory buffer for data storage
	jemul8.createBuffer = function ( len ) {
		var mem;
		// Ultra-modern, fast Typed Arrays support (faster)
		if ( jemul8.support.typedArrays ) {
			return new ArrayBuffer( len );
		/** TODO: Support ImageData for slightly older browsers
			(off Canvas context) **/
		// Legacy native Arrays support (slower)
		} else {
			mem = new Array( len );
			
			// Emulate DataView accessor functions for legacy Arrays
			//  (these are NOT to be used in time-critical areas!)
			$.extend(mem, accessors);
			
			// Zero-out all bytes in memory (otherwise they will be undefined)
			for ( var i = 0 ; i < len ; ++i ) {
				mem[ i ] = 0x00;
			}
			return mem;
		}
	};
	// Wraps an ArrayBuffer with a Uint8Array view
	jemul8.wrapByteBuffer = function ( buf ) {
		// Wrapping only applies where there is ArrayBuffer support
		if ( !jemul8.support.typedArrays ) { return buf; }
		
		return new Uint8Array( buf );
	};
	// Wraps an ArrayBuffer with the most optimised view
	//	suitable & available for being multibyte-capable
	//	(ie. supporting .getUint8()/.getUint16()/.getUint32())
	jemul8.wrapMultibyteBuffer = function ( buf ) {
		// Wrapping only applies where there is ArrayBuffer support
		if ( !jemul8.support.typedArrays ) { return buf; }
		
		// If eg. buffer will be mapped for direct guest access
		//	in /classes/memory.js, DataView should be faster
		//	for reading multi-byte values
		return new
			(jemul8.support.typedDataView ? DataView : Uint8Array)
			( buf );
	};
	// Helper for easily creating Uint8Array-wrapped buffers
	jemul8.createByteBuffer = function ( len ) {
		return this.wrapByteBuffer(this.createBuffer(len));
	};
	// For wiping a buffer
	jemul8.zeroBuffer = function ( buf, offset, len ) {
		jemul8.setBuffer(buf, offset, 0, len);
	};
	// For setting multiple elements in a buffer
	jemul8.setBuffer = function ( buf, offset, val, len ) {
		// TODO: Support "val" properly
		if ( val !== 0 ) { error(); }
		
		var idx, bufLen = jemul8.getBufferLength(buf), oldLen;
		// Zero from start of buffer by default
		if ( offset === undefined ) { offset = 0; }
		// Zero to end of buffer by default
		if ( len === undefined ) { len = bufLen - offset; }
		
		if ( jemul8.support.typedArrays ) {
			new Uint8Array( buf ).set(new Uint8Array( len ), offset);
		} else {
			// Optimised case: wiping to end of buffer
			if ( len === bufLen - offset ) {
				// Wipe the data by destroying all elements above offset,
				//  then restore the length - remember that "undefined"
				//	will be the value of each element, not a zero!!!
				oldLen = buf.length;
				buf.length = offset;
				buf.length = oldLen;
			// Slower case - need to iterate
			} else {
				for ( idx = offset, end = len - offset ; idx < end ; ++idx ) {
					buf[ idx ] = val;
				}
			}
		}
	};
	jemul8.getBufferLength = function ( buf ) {
		return ("byteLength" in buf) ? buf.byteLength : buf.length;
	};
	jemul8.getBuffer = function ( buf ) {
		return buf.buffer || buf;
	};
	// C/C++ memcpy()-esque method for memory buffers
	jemul8.copyBuffer
	= function ( bufFrom, offsetFrom, bufTo, offsetTo, len ) {
		if ( (offsetFrom + len) > jemul8.getBufferLength(bufFrom) ) {
			jemul8.panic("jemul8.copyBuffer() :: Error - offset+len"
				+ " tries to copy past end of source buffer");
			return 0;
		}
		if ( (offsetTo + len) > jemul8.getBufferLength(bufTo) ) {
			jemul8.panic("jemul8.copyBuffer() :: Error - offset+len"
				+ " tries to copy past end of dest buffer");
			return 0;
		}
		bufFrom = jemul8.getBuffer(bufFrom);
		bufTo = jemul8.getBuffer(bufTo);
		
		// Perform the copy
		if ( jemul8.support.typedArrays ) {
			new Uint8Array( bufTo )
				.set(new Uint8Array( bufFrom, offsetFrom, len ), offsetTo);
		} else {
			var i, j, end;
			for ( i = offsetFrom, j = offsetTo, end = i + len
				; i < end ; ++i, ++j
			) {
				bufTo[ j ] = bufFrom[ i ];
			}
		}
		
		return len; // Return total no. of bytes copied
	};
});
