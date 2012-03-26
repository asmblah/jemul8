/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *	
 *	MODULE: CPU Instruction Operand support
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("cpu/operand", function ( $ ) { "use strict";
	var jemul8 = this.data("jemul8");
	
	// CPU Instruction Operand ( eg. dest or src ) class constructor
	function Operand( insn, offset, nameMapFlags
					, reg_segment, mod, nnn, rm, hasModRM ) {
		/* ==== Guards ==== */
		//jemul8.assert(this && (this instanceof Operand), "Operand ctor ::"
		//	+ " error - constructor not called properly");
		/* ==== /Guards ==== */
		
		var machine = insn.machine, cpu = machine.cpu
			, CS = cpu.CS
			, addrMethodCode
			, addrMethod
			, addressSize = insn.addressSizeAttr ? 4 : 2
			, size = insn.operandSizeAttr ? 4 : 2
			, displacement
			, typeCode;
		
		// Parent Instruction of this Operand
		this.insn = insn;
		// Offset ( in bytes ) of this Operand in memory
		this.offset = offset;
		
		this.addressSize = addressSize;
		this.addressMask = jemul8.generateMask(this.addressSize);
		this.size = size; // May change further down
		this.mask = jemul8.generateMask(size);
		
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
		this.displacementSize = 0;
		// Type of operand's value ( Immediate data, General register, MMX register etc. )
		this.type = null;
		// Whether operand represents a memory pointer
		this.isPointer = false;
		
		/*debugger;
		var cpu = insn.machine.cpu;
		if ( hasModRM ) {
			// MOVs with CRx and DRx always use register ops and ignore the mod field.
			//if ( (b1 & ~3) == 0x120 ) {
			//	mod = 0xc0;
			//}
			
			if ( mod == 0xc0 ) { // mod == 11b
				//i->assertModC0();
				//i->setRm(rm);
				//return;
			}
			
			// 32-bit addressing modes
			if ( 0 ) {
				//
			// 16-bit addressing modes, mod==11b handled above
			} else {
				//i->ResolveModrm = &BX_CPU_C::BxResolve16BaseIndex;
				//i->setSibBase(Resolve16BaseReg[rm]);
				//i->setSibIndex(Resolve16IndexReg[rm]);
				// Derive Base & Index registers to use from RM field ( eg. [BX+SI] )
				this.reg = cpu.hsh_regOrdinals_Base[ rm ];
				this.reg2 = cpu.hsh_regOrdinals_Index[ rm ];
				if ( mod == 0x00 ) { // mod == 00b
					this.reg_segment = cpu.hsh_regOrdinals_Segment_Mod00RM16[ rm ];
					if ( rm == 6 ) {
						//i->setSibBase(BX_NIL_REGISTER);
						this.reg = null;
						
						//i->modRMForm.displ16u = FetchWORD(iptr);
						//iptr += 2;
						this.displacement = CS.readSegment(this.offset, 2);
						this.offset += 2;
					}
					this.setSegment();
					return;
				}
				this.reg_segment = cpu.hsh_regOrdinals_Segment_Mod01or10RM16[ rm ];
				if ( mod == 0x40 ) { // mod == 01b
					// 8 sign extended to 16
					//i->modRMForm.displ16u = (Bit8s) *iptr++;
					this.displacement = CS.readSegment(this.offset, 1);
					if ( this.displacement >> 7 ) { this.displacement |= 0xFF00; }
					++this.offset;
					
					this.setSegment();
					return;
				}
				// (mod == 0x80)      mod == 10b
				//i->modRMForm.displ16u = FetchWORD(iptr);
				//iptr += 2;
				this.displacement = CS.readSegment(this.offset, 2);
				this.offset += 2;
			}
			this.setSegment();
			return;
		}*/
		
		// Normal operand descriptor
		if ( typeof nameMapFlags === "number" ) {
			/* ============ Determine size ( in bytes ) of operand from TypeCode ============ */
			// Not a constant unless high byte is 0x1B (common case)
			//	(this is an extension condition used by jemul8
			//	for const operand val eg. ROL AX 1, see opcode_data.js)
			if ( (nameMapFlags & 0xFF00) !== 0x1B00 ) {
				// TypeCode stored in low byte
				typeCode = nameMapFlags & 0xFF;
				//debugger;
				// Look up TypeCode to determine operand size in bytes
				if ( !(size = cpu.hsh_size_operand
					[ typeCode ][ insn.operandSizeAttr & 1 ])
				) {
					jemul8.problem("Invalid operand flags :: '"
						+ nameMapFlags + "'");
				}
				
				// Some flags indicate different size if operand-size attribute
				//	is set (NB: Currently, jemul8 uses the operand-size
				//	attribute for ONLY this purpose here - is this correct???)
				//if ( insn.sizeOperand === 4 && (
				//		typeCode in cpu.hsh_flgDependsOnOperandSizeAttr) ) {
				//	length *= 2;
				//}
				// Size has been recalculated; update
				this.size = size;
				this.mask = jemul8.generateMask(size);
				//this.addressMask = jemul8.generateMask(this.addressSize);
				
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
					
					// Byte register
					if ( size === 1 ) {
						this.reg = cpu.hsh_regOrdinals_Byte[ nnn ];
					// Word or Segment register
					} else if ( size === 2 ) {
						if ( addrMethod == "GENERAL" ) {
							this.reg = cpu.hsh_regOrdinals_Word[ nnn ];
						} else if ( addrMethod == "SEGMENT" ) {
							this.reg = cpu.hsh_regOrdinals_Segment[ nnn ];
						}
					// Dword register
					} else {
						this.reg = cpu.hsh_regOrdinals_Dword[ nnn ];
					}
				// Use a fast switch to decide how to proceed
				} else {
					switch ( addrMethodCode ) {
					// No ModR/M byte used, Immediate data to be read
					case 0x0100: //"A":
						this.setImmediate(CS.readSegment(this.offset, size));
						//this.setSegment(CS.readSegment(this.offset + len, len));
						// Move offset pointer past the 2 values just read
						this.offset += size; // * 2;
						break;
					// Immediate data to be read
					case 0x0900: //"I":
						this.setImmediate(CS.readSegment(this.offset, size));
						// Move offset pointer past the value just read
						this.offset += size;
						break;
					// Instruction contains relative offset, to be added to EIP
					case 0x0A00: //"J":
						this.setImmediate(CS.readSegment(this.offset, size));
						// Move offset pointer past the value just read
						this.offset += size;
						break;
					// No ModR/M byte, offset coded as word or dword
					//	(dep. on operand-size attr)
					case 0x0F00: //"O":
						this.setDisplacement(CS.readSegment(this.offset
							, addressSize), addressSize);
						// Move offset pointer past the value just read
						this.offset += addressSize;
						break;
					case 0x0500: //"E":	// ModR/M byte follows opcode, specifies operand (either general register or memory address)
					case 0x0D00: //"M":	// ModR/M byte may only refer to memory
					case 0x1200: //"R":	// ModR/M byte may only refer to general purpose reg (mod = general register)
						// Mod field represents that RM indicates just a general register
						if ( mod === 0x03 ) {
							this.setType("GENERAL");
							
							this.reg = cpu.hsh_size_regOrdinals
								[ size ][ rm ];
							//this.size = this.reg.len;
							//this.mask = jemul8.generateMask(this.size);
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
							this.reg = cpu.hsh_regOrdinals_Base[ rm ];
							this.reg2 = cpu.hsh_regOrdinals_Index[ rm ];
							
							if ( mod == 0x00 ) {
								// Derive Segment Register to use from RM field ( if not overridden )
								if ( !this.reg_segment ) {
									this.reg_segment = cpu.hsh_regOrdinals_Segment_Mod00RM16[ rm ];
								}
								// Fixed memory addressing is available ( a WORD displacement ) if arbitrary combination [ mod=00, reg=BP/EBP ]
								//	NB: this obviously means that there is no simple way to access memory given by the BP register.
								//	so an assembler would use a zero displacement ( eg. [BP+00h] ) for that particular operand.
								if ( rm === 0x06 ) {
									// Not using (E)BP ( see above notes )
									this.reg = null;
									
									displacement = CS.readSegment(this.offset, 2);
									// Sign-extend the displacement ( allows negative address displacements )
									this.setDisplacement(displacement, 2/* >> 15 ? displacement - 0x10000 : displacement*/);
									// Move offset pointer past the displacement just read
									this.offset += 2;
									
									//this.addressSize = addressSize = 2;
									//this.addressMask = 0xFFFF;
									
									this.setSegment();
									return;	// Done!
								}
								this.setType("GENERAL");
								//this.size = this.reg.len;
								//this.mask = jemul8.generateMask(this.size);
								this.setSegment();
								return;	// Done!
							}
							this.setType("GENERAL");
							
							// Derive Segment Register to use from RM field ( uses different map from the one above ) ( if not overridden )
							if ( !this.reg_segment ) {
								this.reg_segment = cpu.hsh_regOrdinals_Segment_Mod01or10RM16[ rm ];
							}
							// 8-bit / 1-byte displacement ( memory address is reg1 + byte-size displacement )
							if ( mod === 0x01 ) {
								var displacement = CS.readSegment(this.offset, 1);
								this.setDisplacement(displacement, 1/* >> 7 ? displacement - 0x100 : displacement*/);
								// Move offset pointer past the displacement just read
								++this.offset;
								
								//this.addressSize = addressSize = 1;
								//this.addressMask = 0xFF;
								
								this.setSegment();
								return;	// Done!
							}
							// 16-bit / 2-byte displacement ( memory address is reg1 + word-size displacement )
							//if ( mod === 0x02 ) {
								var displacement = CS.readSegment(this.offset, 2);
								this.setDisplacement(displacement, 2/* >> 15 ? displacement - 0x10000 : displacement*/);
								// Move offset pointer past the displacement just read
								this.offset += 2;
								
								//this.addressSize = addressSize = 2;
								//this.addressMask = 0xFFFF;
								
								this.setSegment();
								return;	// Done!
							//}
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
						// DS may be overridden for string operations...
						if ( !this.reg_segment ) {
							this.reg_segment = cpu.DS;
						}
						this.reg = cpu.SI;
						this.setIsPointer(true);
						break;
					// Memory, addressed by ES:DI register pair
					case 0x1900: //"Y":
						this.setType("GENERAL");
						// ... but ES may not
						this.reg_segment = cpu.ES;
						this.reg = cpu.DI;
						this.setIsPointer(true);
						break;
					// EFLAGS register
					case 0x0600: //"F":
						break;
					default:
						jemul8.problem("Unsupported AddressingMethodCode '" + addrMethodCode + "'.");
					}
				}
				/* ============ /Determine addressing method from AddressMethodCode ============ */
			// Operand flags indicate a constant value
			} else {
				// Only low-byte holds constant, zero out higher bits
				this.setImmediate(nameMapFlags & 0x00FF);
				this.size = 1;
				this.mask = 0xFF;
			}
			/* ============ /Determine size ( in bytes ) of operand from TypeCode ============ */
		// Flag indicates a general purpose register ( eg. AX, AH, AL )
		//	or segment register ( eg. CS, DS, SS )
		} else if ( this.reg = cpu.hsh_reg[ nameMapFlags ] ) {
			this.setType("GENERAL");
			this.size = this.reg.len;
			this.mask = jemul8.generateMask(this.size);
		// Flag indicates a 16-bit general purpose register ( eg. AX, SI )
		} else if ( size === 2 && (this.reg = cpu.hsh_reg[ nameMapFlags.substr(1) ]) ) {
			this.setType("GENERAL");
			this.size = this.reg.len;
			this.mask = jemul8.generateMask(this.size);
		// Flag indicates a 32-bit general purpose register ( eg. EAX, ESI )
		} else if ( size === 4 && (this.reg = cpu.hsh_reg[ nameMapFlags.toUpperCase() ]) ) {
			this.setType("GENERAL");
			this.size = this.reg.len;
			this.mask = jemul8.generateMask(this.size);
		}
		this.setSegment();
	}
	
	// Polymorphic, based on type
	Operand.prototype.write = null;
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
	Operand.prototype.setDisplacement = function ( displacement, size ) {
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
		this.displacementSize = size;
	};
	Operand.prototype.getDisplacement = function () {
		return this.insn.machine.cpu.signExtend(
			this.displacement
			, this.displacementSize
			, this.addressSize
		);
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
	// TODO: this switch should not be needed - use polymorphism to use
	//  a different version of this function depending on the type
	Operand.prototype.getPointerAddress = function () {
		switch ( this.type ) {
		case "GENERAL":
		case "SEGMENT":
			return (this.reg.get() + (this.reg2 ? this.reg2.get() : 0)
				+ this.getDisplacement()) & this.addressMask;
		case "MEM_DISPLACEMENT":
			return this.displacement;
		default:
			jemul8.problem("getPointerAddress ::"
				+ " Cannot determine address offset component from type.");
		}
	};
	Operand.prototype.signExtend = function ( sizeTo ) {
		return this.insn.machine.cpu.signExtend(
			this.read(), this.size
			// TODO: Always sign-extend to op1's size?
			, sizeTo || this.insn.operand1.size
		);
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
		var res = this.reg_segment.readSegment(
			(this.reg.get() + (this.reg2 ? this.reg2.get() : 0)
				+ this.getDisplacement()) & this.addressMask
			, this.size);
		return res;
	};
	// Direct memory address/displacement; no register involved
	hsh_func_operandRead_WithPointer.MEM_DISPLACEMENT = function () {
		var res = this.reg_segment.readSegment(
			// Displacement is direct, so no masking required
			//  as it must be unsigned
			this.displacement
			, this.size);
		return res;
	};
	
	hsh_func_operandWrite_NonPointer.SEGMENT = hsh_func_operandWrite_NonPointer.GENERAL = function ( val ) {
		//if ( val > this.insn.mask_sizeOperand ) { debugger; }
		
		// TODO: why mask? Surely val must already be no larger than operand-size?
		this.reg.set(val & this.mask);
	};
	hsh_func_operandWrite_WithPointer.SEGMENT = hsh_func_operandWrite_WithPointer.GENERAL = function ( val ) {
		//if ( (val > this.insn.mask_sizeOperand) && !this.isPointer ) { debugger; }
		
		this.reg_segment.writeSegment(
			(this.reg.get() + (this.reg2 ? this.reg2.get() : 0)
				+ this.getDisplacement()) & this.addressMask
			, val & this.mask
			, this.size);
	};
	// Direct Memory Address/displacement; no register involved
	hsh_func_operandWrite_WithPointer.MEM_DISPLACEMENT = function ( val ) {
		//if ( val > this.insn.mask_sizeOperand ) { debugger; }
		
		this.reg_segment.writeSegment(
			// Displacement is direct, so no masking required
			//  as it must be unsigned
			this.displacement
			, val & this.mask
			, this.size);
	};
	
	// Exports
	jemul8.Operand = Operand;
});
