/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: Memory (RAM) <-> Northbridge support
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("memory/buffer", function ( $ ) { "use strict";
	var jemul8 = this.data("jemul8")
		, Memory = jemul8.Memory;
	
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
			// Zero-out all bytes in memory (otherwise they will be undefined)
			//for ( var i = 0 ; i < len ; ++i ) {
			//	mem[ i ] = 0x00;
			//}
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
	jemul8.zeroBuffer = function ( buf ) {
		var len;
		if ( jemul8.support.typedArrays ) {
			new Uint8Array( buf ).set(new Uint8Array( buf.byteLength ) );
		} else {
			// Wipe the data by emptying the array,
			//	then restore the length (remember that "undefined"
			//	will be the value of each element, not a zero!!!)
			len = buf.length;
			buf.length = 0;
			buf.length = len;
		}
	};
	jemul8.getBufferLength = function ( buf ) {
		return ("byteLength" in buf) ? buf.byteLength: buf.length;
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
			return;
		}
		if ( (offsetTo + len) > jemul8.getBufferLength(bufTo) ) {
			jemul8.panic("jemul8.copyBuffer() :: Error - offset+len"
				+ " tries to copy past end of dest buffer");
			return;
		}
		bufFrom = jemul8.getBuffer(bufFrom);
		bufTo = jemul8.getBuffer(bufTo);
		// Perform the copy
		new Uint8Array( bufTo )
			.set(new Uint8Array( bufFrom, offsetFrom, len ), offsetTo);
	};
});
