/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *	
 *	MODULE: CPU Instruction Operand read/write methods
 */

define([
	"../../util"
], function ( util ) { "use strict";
	
	// OperandAccessor static class constructor
	function OperandAccessor() {
		jemul8.panic("OperandAccessor() is static-only!");
	}
	$.extend(OperandAccessor, {
		readNonPointer: function ( offset, size ) {
			// NB: Immediate value will be zero
			//     if none specified in instruction
			return this.getImmediate()
				+ (this.reg ? this.reg.get() : 0);
		}, readWithPointer: function ( offset, size ) {
			return this.getSegReg().readSegment(
				this.getPointerAddress(offset)
				, size || this.size
			);
		}, writeNonPointer: function ( val, offset, size ) {
			// NB: Must be to a register
			this.reg.set(val & this.mask);
		}, writeWithPointer: function ( val, offset, size ) {
			this.getSegReg().writeSegment(
				this.getPointerAddress(offset)
				, val & this.mask
				, size || this.size
			);
		}
	});
	
	// Exports
	return OperandAccessor;
});
