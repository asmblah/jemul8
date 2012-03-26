/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: CPU Instruction Operand support
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("cpu/operand", function ( $ ) { "use strict";
	var jemul8 = this.data("jemul8");
	
	// CPU Instruction Operand ( eg. dest or src ) class constructor
	function Operand( insn, offset, bytOpcode, nameMapFlags
					, reg_segment, fieldMod, fieldReg, fieldRM ) {
		/* ==== Guards ==== */
		//jemul8.assert(this && (this instanceof Operand), "Operand ctor ::"
		//	+ " error - constructor not called properly");
		/* ==== /Guards ==== */
		
		var machine = insn.machine, cpu = machine.cpu
			, CS = cpu.CS
			, accessorCode = cpu.accessorCode
			, addrMethodCode
			, addrMethod
			, displacement
			, length = 2
			, typeCode;
		
		// Parent Instruction of this Operand
		this.insn = insn;
		// Offset ( in bytes ) of this Operand in memory
		this.offset = offset;
		
		this.length = length; // (May be changed further down)
		//this.mask = generateMask(length); // Must change if length changes
		
		// Register used ( if applicable )
		this.reg = null;
		this.reg2 = null;
		// Immediate/scalar number value of operand ( if applicable ) -
		//	NOT for storing memory addresses ( use displacement for that )
		//	( Mutex'd with .displacement )
		this.immed = 0;
		// Register holding effective Segment of operand's pointer address ( if applicable )
		this.reg_segment = reg_segment;
		// Displacement / operand's Memory Pointer address in bytes ( if applicable )
		//	( Mutex'd with .immed )
		this.displacement = 0;
		// Type of operand's value ( Immediate data, General register, MMX register etc. )
		this.type = null;
		// Whether operand represents a memory pointer
		this.isPointer = false;
		
		// pre-extract values for possible flags
		//	( NB:	- these fields don't apply to all opcodes)
		//		- sign flag applies to immediate data. )
		// TODO: only read these when needed
		//flgDirection = flgSign = ((bytOpcode & 0x02) >> 1);
		//flgOperandSize = !(bytOpcode & 0x01);
				
				//if ( insn.offset === 1040493 ) { debugger; }
		
		// Normal operand descriptor
		if ( typeof nameMapFlags === "number" ) {
			/* ============ Determine size ( in bytes ) of operand from TypeCode ============ */
			// Not a constant unless high byte is 0x1B (common case)
			//	(this is an extension condition used by jemul8
			//	for const operand val eg. ROL AX 1, see opcode_data.js)
			if ( (nameMapFlags & 0xFF00) !== 0x1B00 ) {
				// TypeCode stored in low byte
				typeCode = nameMapFlags & 0xFF;
				
				// Look up TypeCode to determine operand size in bytes
				if ( (length = cpu.hsh_size_operand[ typeCode ])
						=== undefined ) {
					jemul8.problem("Invalid operand flags :: '"
						+ nameMapFlags + "'");
				}
				
				// Some flags indicate different size if operand-size attribute
				//	is set (NB: Currently, jemul8 uses the operand-size
				//	attribute for ONLY this purpose here - is this correct???)
				if ( insn.sizeOperand === 4 && (
						typeCode in cpu.hsh_flgDependsOnOperandSizeAttr) ) {
					length *= 2;
				}
				// Size has been recalculated; update
				this.length = length;
				//this.mask = generateMask(length);
				
				// AddressingMethod stored in high byte (for speed we leave the AddressingMethod shifted
				//	left by 8 bits, so that we do not need to shift right here before doing a table lookup)
				//	TODO: This is confusing - why not just "= nameMapFlags >> 8" with
				//		opcode_data.js: hsh[C] = "CONTROL" -> hsh[C >> 8] = "CONTROL" ?
				//	( test whether ">>" is faster than "&" )
				addrMethodCode = nameMapFlags & 0xFF00;
				/* ============ Determine addressing method from AddressMethodCode ============ */
				// Operand addresses a register to be decoded using ModR/M Reg field
				if ( (addrMethod
						= cpu.hsh_addrmethodRegister[ addrMethodCode ])
						!== undefined ) {
					this.setType(addrMethod);
					
					// We are going to use ModR/M byte (previously decoded), so skip past it
					if ( !insn.skippedModRM ) { insn.skippedModRM = true; ++this.offset; }
					
					// Byte register
					if ( length === 1 ) {
						this.reg = cpu.hsh_regOrdinals_Byte[ fieldReg ];
					// Word or Segment register
					} else if ( length === 2 ) {
						if ( addrMethod == "GENERAL" ) {
							this.reg = cpu.hsh_regOrdinals_Word[ fieldReg ];
						} else if ( addrMethod == "SEGMENT" ) {
							this.reg = cpu.hsh_regOrdinals_Segment[ fieldReg ];
						}
					// Dword register
					} else {
						this.reg = cpu.hsh_regOrdinals_Dword[ fieldReg ];
					}
				// Use a fast switch to decide how to proceed
				} else {
					switch ( addrMethodCode ) {
					// No ModR/M byte used, Immediate data to be read
					case 0x0100: //"A":
						this.setImmediate(CS.readSegment(this.offset, length));
						//this.setSegment(CS.readSegment(this.offset + len, len));
						// Move offset pointer past the 2 values just read
						this.offset += length; // * 2;
						break;
					// Immediate data to be read
					case 0x0900: //"I":
						this.setImmediate(CS.readSegment(this.offset, length));
						// Move offset pointer past the value just read
						this.offset += length;
						break;
					// Instruction contains relative offset, to be added to EIP
					case 0x0A00: //"J":
						this.setImmediate(CS.readSegment(this.offset, length));
						// Move offset pointer past the value just read
						this.offset += length;
						break;
					// No ModR/M byte, offset coded as word or dword
					//	(dep. on operand-size attr)
					case 0x0F00: //"O":
						this.setDisplacement(CS.readSegment(this.offset
							, insn.sizeOperand));
						// Move offset pointer past the value just read
						this.offset += insn.sizeOperand;
						break;
					case 0x0500: //"E":	// ModR/M byte follows opcode, specifies operand (either general register or memory address)
					case 0x0D00: //"M":	// ModR/M byte may only refer to memory
					case 0x1200: //"R":	// ModR/M byte may only refer to general purpose reg (mod = general register)
						// We are going to use ModR/M byte ( previously decoded ), so skip past it
						if ( !insn.skippedModRM ) { insn.skippedModRM = true; ++this.offset; }
						
						// Mod field represents that RM indicates just a general register
						if ( fieldMod === 0x03 ) {
							this.setType("GENERAL");
							/* // Byte register
							if ( length === 1 ) {
								this.reg = cpu.hsh_regOrdinals_Byte[ fieldRM ];
							// Word register
							} else if ( length === 2 ) {
								this.reg = cpu.hsh_regOrdinals_Word[ fieldRM ];
							// Dword register
							} else if ( length === 4 ) {
								this.reg = cpu.hsh_regOrdinals_Dword[ fieldRM ];
							} */
							this.reg = cpu.hsh_size_regOrdinals
								[ length ][ fieldRM ];
							this.setSegment();
							return;	// Done!
						}
						
						// 32-bit addressing mode
						if ( 0 ) {
							jemul8.problem("No 32-bit support yet.");
						// 16-bit addressing mode
						} else {
							this.setIsPointer(true);
							
							// Derive Base & Index registers to use from RM field ( eg. [BX+SI] )
							this.reg = cpu.hsh_regOrdinals_Base[ fieldRM ];
							this.reg2 = cpu.hsh_regOrdinals_Index[ fieldRM ];
							
							if ( fieldMod == 0x00 ) {
								// Derive Segment Register to use from RM field ( if not overridden )
								if ( !this.reg_segment ) {
									this.reg_segment = cpu.hsh_regOrdinals_Segment_Mod00RM06[ fieldRM ];
								}
								// Fixed memory addressing is available ( a WORD displacement ) if arbitrary combination [ mod=00, reg=BP/EBP ]
								//	NB: this obviously means that there is no simple way to access memory given by the BP register.
								//	so an assembler would use a zero displacement ( eg. [BP+00h] ) for that particular operand.
								if ( fieldRM === 0x06 ) {
									// Not using (E)BP ( see above notes )
									this.reg = null;
									
									displacement = CS.readSegment(this.offset, 2);
									// Sign-extend the displacement ( allows negative address displacements )
									this.setDisplacement(displacement >> 15 ? displacement - 0x10000 : displacement);
									// Move offset pointer past the displacement just read
									this.offset += 2;
									
									//this.length = 2;
									//this.mask = (1 << this.length * 8) - 1;
									/*this.reg = cpu.BP;*/ this.setSegment(); /*this.reg = null;*/
									return;	// Done!
								}
								this.setType("GENERAL");
								this.length = this.reg.len;
								//this.mask = generateMask(this.length);
								this.setSegment();
								return;	// Done!
							}
							this.setType("GENERAL");
							
							//this.length = this.reg.len;
							//this.mask = generateMask(this.length);
							
							// Derive Segment Register to use from RM field ( uses different map from the one above ) ( if not overridden )
							if ( !this.reg_segment ) {
								this.reg_segment = cpu.hsh_regOrdinals_Segment_Mod01or10RM06[ fieldRM ];
							}
							// 8-bit / 1-byte displacement ( memory address is reg1 + byte-size displacement )
							if ( fieldMod === 0x01 ) {
								var displacement = CS.readSegment(this.offset, 1);
								this.setDisplacement(displacement >> 7 ? displacement - 0x100 : displacement);
								// Move offset pointer past the displacement just read
								++this.offset;
								
								//this.length = 1;
								//this.mask = generateMask(this.length);
								this.setSegment();
								return;	// Done!
							}
							// 16-bit / 2-byte displacement ( memory address is reg1 + word-size displacement )
							if ( fieldMod === 0x02 ) {
								var displacement = CS.readSegment(this.offset, 2);
								this.setDisplacement(displacement >> 15 ? displacement - 0x10000 : displacement);
								// Move offset pointer past the displacement just read
								this.offset += 2;
								
								//this.length = 2;
								//this.mask = generateMask(this.length);
								this.setSegment();
								return;	// Done!
							}
						}
						break;
					// ModR/M byte follows opcode, specifies operand ( either MMX register or memory address )
					case 0x1100: //"Q":
						jemul8.problem("MMX registers unsupported");
						break;
					// ModR/M byte follows opcode, specifies operand ( either SIMD floating-point register or memory address )
					case 0x1700: //"W":
						jemul8.problem("SIMD registers unsupported");
						break;
					// Memory, addressed by DS:SI register pair
					case 0x1800: //"X":
						this.setType("GENERAL");
						this.reg_segment = cpu.DS;
						this.reg = cpu.SI;
						this.setIsPointer(true);
						break;
					// Memory, addressed by ES:DI register pair
					case 0x1900: //"Y":
						this.setType("GENERAL");
						this.reg_segment = cpu.ES;
						this.reg = cpu.DI;
						this.setIsPointer(true);
						break;
					// EFLAGS register
					case 0x0600: //"F":
						break;
					default:
						jemul8.problem("Invalid AddressingMethodCode '" + addrMethodCode + "'.");
					}
				}
				/* ============ /Determine addressing method from AddressMethodCode ============ */
			// Operand flags indicate a constant value
			} else {
				// Only low-byte holds constant, zero out higher bits
				this.setImmediate(nameMapFlags & 0x00FF);
				this.length = 1;
				//this.mask = generateMask(this.length);
			}
			/* ============ /Determine size ( in bytes ) of operand from TypeCode ============ */
		// Flag indicates a general purpose register ( eg. AX, AH, AL )
		//	or segment register ( eg. CS, DS, SS )
		} else if ( this.reg = cpu.hsh_reg[ nameMapFlags ] ) {
			this.setType("GENERAL");
			this.length = this.reg.len;
			//this.mask = generateMask(this.length);
		// Flag indicates a 16-bit general purpose register ( eg. AX, SI )
		} else if ( insn.sizeOperand === 2 && (this.reg = cpu.hsh_reg[ nameMapFlags.substr(1) ]) ) {
			this.setType("GENERAL");
			this.length = this.reg.len;
			//this.mask = generateMask(this.length);
		// Flag indicates a 32-bit general purpose register ( eg. EAX, ESI )
		} else if ( insn.sizeOperand === 4 && (this.reg = cpu.hsh_reg[ nameMapFlags.toUpperCase() ]) ) {
			this.setType("GENERAL");
			this.length = this.reg.len;
			//this.mask = generateMask(this.length);
		}
		this.setSegment();
	}
	
	// Polymorphic, based on type
	Operand.prototype.write = null;
	// Polymorphic, based on type
	Operand.prototype.read = null;
	
	Operand.prototype.setImmediate = function ( immed ) {
		this.setType("IMMEDIATE");
		
		this.immed = immed;
	};
	Operand.prototype.getImmediate = function () {
		return this.immed;
	};
	// Determine the effective segment, if not already set
	Operand.prototype.setSegment = function () {
		if ( this.length === 0 ) { debugger; }
		
		var cpu = this.insn.machine.cpu;
		// [Intel] The default segment register is SS for the effective
		//	addresses containing a BP index, DS for other effective addresses
		if ( this.isPointer && this.reg_segment === null ) {
			this.reg_segment = (this.reg !== cpu.BP && this.reg !== cpu.EBP
				&& this.reg !== cpu.SP && this.reg !== cpu.ESP) ? cpu.DS : cpu.SS;
		}
	};
	// Return effective Segment
	//	TODO: remove this, always set Operand.reg_segment
	//	(already uses DS/SS as default, why does this exist!?)
	Operand.prototype.getSegment = function () {
		// A Segment Register has been specified for this Operand
		if ( this.reg_segment ) {
			return this.reg_segment.get();
		// DS is the default Segment Register
		} else {
			return this.insn.machine.cpu.DS.get();
		}
	};
	Operand.prototype.setDisplacement = function ( displacement ) {
		// Operand specifies a Register + Displacement
		if ( this.reg ) {
			this.setType("GENERAL");
		// Operand specifies only a Displacement; direct address
		} else {
			this.setType("MEM_DISPLACEMENT");
		}
		// Use of a displacement implies this is a memory pointer
		this.setIsPointer(true);
		this.displacement = displacement;
	};
	Operand.prototype.setType = function ( type ) {
		this.type = type;
		
		if ( this.isPointer ) {
			this.read = hsh_func_operandRead_WithPointer[ this.type ];
			this.write = hsh_func_operandWrite_WithPointer[ this.type ];
		} else {
			this.read = hsh_func_operandRead_NonPointer[ this.type ];
			this.write = hsh_func_operandWrite_NonPointer[ this.type ];
		}
	};
	Operand.prototype.setIsPointer = function ( isPointer ) {
		this.isPointer = isPointer;
		
		if ( isPointer ) {
			this.read = hsh_func_operandRead_WithPointer[ this.type ];
			this.write = hsh_func_operandWrite_WithPointer[ this.type ];
		} else {
			this.read = hsh_func_operandRead_NonPointer[ this.type ];
			this.write = hsh_func_operandWrite_NonPointer[ this.type ];
		}
	};
	// Returns a human-readable ASM-format representation of the operand's data
	Operand.prototype.getASMText = function () {
		/* ==== Malloc ==== */
		var text;
		/* ==== /Malloc ==== */
		switch ( this.type ) {
		case "IMMEDIATE":
			text = this.getImmediate().toString(16).toUpperCase() + "h";
			// Surround with square brackets to indicate memory pointer
			if ( this.isPointer ) { text = (this.reg_segment ? this.reg_segment.name + ":" : "DS:") + "[" + text + "]"; }
			return text;
		case "MEM_DISPLACEMENT":
			text = this.displacement.toString(16).toUpperCase() + "h";
			if ( this.reg ) { text = this.reg.name + "+" + text; }
			// Surround with square brackets to indicate memory pointer
			text = (this.reg_segment ? this.reg_segment.name + ":" : "DS:") + "[" + text + "]";
			return text;
		case "CONTROL":
		case "DEBUG":
		case "GENERAL":
		case "MMX":
		case "SEGMENT":
		case "SIMD":
			text = this.reg.name;
			if ( this.reg2 ) { text += "+" + this.reg2.name; }
			if ( this.displacement ) { text += "+" + this.displacement.toString(16).toUpperCase() + "h"; }
			// Surround with square brackets to indicate memory pointer
			if ( this.isPointer ) { text = (this.reg_segment ? this.reg_segment.name + ":" : "DS:") + "[" + text + "]"; }
			return text;
		}
	};
	// TODO: this switch should not be needed - use polymorphism to use a different
	//	version of this function depending on the type
	Operand.prototype.getPointerAddress = function () {
		switch ( this.type ) {
		case "GENERAL":
		case "SEGMENT":
			return /*(this.getSegment() << 4) + */this.reg.get() + (this.reg2 ? this.reg2.get() : 0) + this.displacement;
		case "MEM_DISPLACEMENT":
			return /*(this.getSegment() << 4) + */this.displacement;
		default:
			jemul8.problem("getPointerAddress ::"
				+ " Cannot determine address offset component from type.");
		}
	};
	Operand.prototype.signExtend = function ( sizeTo ) {
		return this.insn.machine.cpu.signExtend(this.read(), this.length
			, sizeTo || this.insn.sizeOperand);
	};
	
	var hsh_func_operandRead_NonPointer = {};
	var hsh_func_operandRead_WithPointer = {};
	var hsh_func_operandWrite_NonPointer = {};
	var hsh_func_operandWrite_WithPointer = {};
	
	hsh_func_operandRead_NonPointer.SEGMENT = hsh_func_operandRead_NonPointer.GENERAL = function () {
		var res = this.reg.get();
		return res;
	};
	hsh_func_operandRead_NonPointer.IMMEDIATE = function () {
		var res = this.getImmediate();
		return res;
	};
	/*hsh_func_operandRead_WithPointer.SEGMENT = */hsh_func_operandRead_WithPointer.GENERAL = function () {
		//var res = this.insn.machine.cpu.accessorRead.readBytes((this.getSegment() << 4) + ((this.reg.get() + (this.reg2 ? this.reg2.get() : 0) + this.displacement) /* * this.insn.sizeAddress*/), this.insn.sizeOperand);
		var res = this.reg_segment.readSegment(
			(this.reg.get() + (this.reg2 ? this.reg2.get() : 0)
				+ this.displacement)
			, this.insn.sizeOperand);
		return res;
	};
	// Direct memory address/displacement; no register involved
	hsh_func_operandRead_WithPointer.MEM_DISPLACEMENT = function () {
		//var res = this.insn.machine.cpu.accessorRead.readBytes((this.getSegment() << 4) + (this.displacement /* * this.insn.sizeAddress*/), this.insn.sizeOperand);
		var res = this.reg_segment.readSegment(
			this.displacement
			, this.insn.sizeOperand);
		return res;
	};
	
	hsh_func_operandWrite_NonPointer.SEGMENT = hsh_func_operandWrite_NonPointer.GENERAL = function ( val ) {
		if ( val > this.insn.mask_sizeOperand ) { debugger; }
		
		// TODO: why mask? Surely val must already be no larger than operand-size?
		this.reg.set(val & this.insn.mask_sizeOperand);
	};
	hsh_func_operandWrite_WithPointer.SEGMENT = hsh_func_operandWrite_WithPointer.GENERAL = function ( val ) {
		if ( (val > this.insn.mask_sizeOperand) && !this.isPointer ) { debugger; }
		
		//this.insn.machine.cpu.accessorRead.writeBytes((this.getSegment() << 4) + ((this.reg.get() + this.displacement) /* * this.insn.sizeAddress*/), val & this.insn.mask_sizeOperand, this.insn.sizeOperand);
		this.reg_segment.writeSegment(
			(this.reg.get() // + (this.reg2 ? this.reg2.get() : 0)
				+ this.displacement)
			, val & this.insn.mask_sizeOperand
			, this.insn.sizeOperand);
	};
	// Direct Memory Address/displacement; no register involved
	hsh_func_operandWrite_WithPointer.MEM_DISPLACEMENT = function ( val ) {
		if ( val > this.insn.mask_sizeOperand ) { debugger; }
		
		//this.insn.machine.cpu.accessorRead.writeBytes((this.getSegment() << 4) + (this.displacement /* * this.insn.sizeAddress*/), val & this.insn.mask_sizeOperand, this.insn.sizeOperand);
		this.reg_segment.writeSegment(
			this.displacement
			, val & this.insn.mask_sizeOperand
			, this.insn.sizeOperand);
	};
	
	// Exports
	jemul8.Operand = Operand;
});
