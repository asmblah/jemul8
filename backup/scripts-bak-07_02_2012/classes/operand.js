/*
 *	jsEmu - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: CPU Instruction Operand support
 */
var mod = new jsEmu.SecondaryModule( function ( jsEmu, machine, motherboard, CPU, FlashBIOSChip, BIOS, DRAM ) {
	
	// CPU Instruction Operand ( eg. dest or src ) class constructor
	function Operand( insn, offset, bytOpcode, nameMapFlags, reg_segment, fieldMod, fieldReg, fieldRM, flgSkipModRM ) {
		/* ==== Guards ==== */
		jsEmu.Assert(this != self, "Operand constructor :: not called as constructor.");
		/* ==== /Guards ==== */
		
		// Parent Instruction of this Operand
		this.insn = insn;
		// Offset ( in bytes ) of this Operand in memory
		this.offset = offset;
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
		
		/* ==== Malloc ==== */
		var addrMethodCode;
		var addrMethod;
		var flgDirection;
		var flgOperandSize;
		var flgSign;
		var sizeBytes;
		var sizeBytes_Value;
		var typeCode;
		/* ==== /Malloc ==== */
		
		// pre-extract values for possible flags
		//	( NB:	- these fields don't apply to all opcodes)
		//		- sign flag applies to immediate data. )
		// TODO: only read these when needed
		//flgDirection = flgSign = ((bytOpcode & 0x02) >> 1);
		//flgOperandSize = !(bytOpcode & 0x01);
		
		// Flag indicates a general purpose register ( eg. AX, AH, AL )
		//	or segment register ( eg. CS, DS, SS )
		if ( this.reg = CPU.hsh_reg[nameMapFlags] ) {
			this.SetType("GENERAL");
		// Flag indicates a 16-bit general purpose register ( eg. AX, SI )
		} else if ( insn.sizeAddress_Bytes == 2 && (this.reg = CPU.hsh_reg[nameMapFlags.substr(1)]) ) {
			this.SetType("GENERAL");
		// Flag indicates a 32-bit general purpose register ( eg. EAX, ESI )
		} else if ( insn.sizeAddress_Bytes == 4 && (this.reg = CPU.hsh_reg[nameMapFlags.toUpperCase()]) ) {
			this.SetType("GENERAL");
		// Normal operand descriptor
		} else {
			/* ============ Determine size ( in bytes ) of operand from TypeCode ============ */
			typeCode = nameMapFlags.charAt(1);
			// Look up TypeCode ( second character of flags text ) to determine operand size in bytes
			if ( (sizeBytes = CPU.hsh_size_operand[typeCode]) !== undefined ) {
				// Some flags indicate diffent size if operand-size attribute is set
				if ( insn.sizeOperand_Bytes > 2 && (typeCode in CPU.hsh_flgDependsOnOperandSizeAttr) ) {
					sizeBytes = CPU.hsh_flgDependsOnOperandSizeAttr[typeCode];
				}
				// Size has been recalculated; store
				insn.sizeOperand_Bytes = sizeBytes;
				
				addrMethodCode = nameMapFlags.charAt(0);
				/* ============ Determine addressing method from AddressMethodCode ============ */
				// Operand addresses a register to be decoded using ModR/M Reg field
				if ( (addrMethod = CPU.hsh_addrmethodRegister[addrMethodCode]) !== undefined ) {
					this.SetType(addrMethod);
					
					// We are going to use ModR/M byte ( previously decoded ), so skip past it
					if ( flgSkipModRM ) { ++this.offset; }
					
					// Byte register
					if ( sizeBytes == 1 ) {
						this.reg = CPU.arr_regOrdinals_Byte[fieldReg];
					// Word or Segment register
					} else if ( sizeBytes == 2 ) {
						if ( addrMethod == "GENERAL" ) {
							this.reg = CPU.arr_regOrdinals_Word[fieldReg];
						} else if ( addrMethod == "SEGMENT" ) {
							this.reg = CPU.arr_regOrdinals_Segment[fieldReg];
						}
					}
				// Use a fast switch to decide how to proceed
				} else {
					switch ( addrMethodCode ) {
					// No ModR/M byte used, Immediate data to be read
					case "A":
						this.SetType("IMMEDIATE");
						this.SetImmediate(DRAM.ReadBytes(this.offset, sizeBytes));
						//this.SetSegment(DRAM.ReadBytes(this.offset + sizeBytes, sizeBytes));
						// Move offset pointer past the 2 values just read
						this.offset += sizeBytes; // * 2;
						break;
					// Immediate data to be read
					case "I":
						this.SetType("IMMEDIATE");
						this.SetImmediate(DRAM.ReadBytes(this.offset, sizeBytes));
						// Move offset pointer past the value just read
						this.offset += sizeBytes;
						break;
					// Instruction contains relative offset, to be added to EIP
					case "J":
						this.SetType("IMMEDIATE");
						this.SetImmediate(DRAM.ReadBytes(this.offset, sizeBytes));
						// Move offset pointer past the value just read
						this.offset += sizeBytes;
						break;
					// No ModR/M byte, offset coded as word or dword (dep. on op size attr)
					case "O":
						// Use operand-size attribute to determine size of Immediate value to extract
						sizeBytes_Value = insn.sizeOperand_Bytes == 2 ? 2 : 4;
						this.SetType("MEM_DISPLACEMENT");
						this.SetDisplacement(DRAM.ReadBytes(this.offset, sizeBytes_Value));
						// Move offset pointer past the value just read
						this.offset += sizeBytes_Value;
						break;
					case "E":	// ModR/M byte follows opcode, specifies operand (either general register or memory address)
					case "M":	// ModR/M byte may only refer to memory
					case "R":	// ModR/M byte may only refer to general purpose reg (mod = general register)
						// We are going to use ModR/M byte ( previously decoded ), so skip past it
						if ( flgSkipModRM ) { ++this.offset; }
						
						// Mod field represents that RM indicates just a general register
						if ( fieldMod === 0x03 ) {
							this.SetType("GENERAL");
							// Byte register
							if ( sizeBytes == 1 ) {
								this.reg = CPU.arr_regOrdinals_Byte[fieldRM];
							// Word register
							} else if ( sizeBytes == 2 ) {
								this.reg = CPU.arr_regOrdinals_Word[fieldRM];
							}
						// Decode ModR/M byte for 16-bit mode
						} else if ( insn.sizeAddress_Bytes == 2 ) {
							// Fixed memory addressing is available ( a WORD displacement ) if arbitrary combination [ mod=00, reg=BP/EBP ]
							//	NB: this obviously means that there is no simple way to access memory given by the BP register.
							//	so an assembler would use a zero displacement ( eg. [BP+00] ) for that particular operand.
							if ( fieldMod == 0x00 && fieldRM == 0x06 ) {
								this.SetType("MEM_DISPLACEMENT");
								var displacement = DRAM.ReadBytes(this.offset, 2);
								// Sign-extend the displacement ( allows negative address displacements )
								this.SetDisplacement(displacement >> 15 ? displacement - 0x10000 : displacement);
								// Move offset pointer past the displacement just read
								this.offset += 2;
								
								return;
							}
							
							this.SetType("GENERAL");
							this.SetIsPointer(true);
							
							// Decode R/M field
							switch ( fieldRM ) {
							case 0x00:
								this.reg = CPU.BX;
								this.reg2 = CPU.SI;
								break;
							case 0x01:
								this.reg = CPU.BX;
								this.reg2 = CPU.DI;
								break;
							case 0x02:
								this.reg = CPU.BP;
								this.reg2 = CPU.SI;
								break;
							case 0x03:
								this.reg = CPU.BP;
								this.reg2 = CPU.DI;
								break;
							case 0x04:
								this.reg = CPU.SI;
								break;
							case 0x05:
								this.reg = CPU.DI;
								break;
							case 0x06:
								this.reg = CPU.BP;
								break;
							case 0x07:
								this.reg = CPU.BX;
								break;
							default:
								this.SetIsPointer(false);
							}
							
							// 8-bit / byte displacement ( memory address is reg1 + byte-size displacement )
							if ( fieldMod == 0x01 ) {
								var displacement = DRAM.Read1Byte(this.offset);
								this.SetDisplacement(displacement >> 7 ? displacement - 0x100 : displacement);
								// Move offset pointer past the displacement just read
								++this.offset;
							// 16-bit / byte displacement ( memory address is reg1 + word-size displacement )
							} else if ( fieldMod == 0x02 ) {
								var displacement = DRAM.ReadBytes(this.offset, 2);
								this.SetDisplacement(displacement >> 15 ? displacement - 0x10000 : displacement);
								// Move offset pointer past the displacement just read
								this.offset += 2;
							}
						// Decode ModR/M byte for 32-bit mode
						} else {
							throw new Error( "No 32bit ModR/M support yet." );
						}
						break;
					// ModR/M byte follows opcode, specifies operand ( either MMX register or memory address )
					case "Q":
						throw new Error( "MMX registers unsupported" );
						break;
					// ModR/M byte follows opcode, specifies operand ( either SIMD floating-point register or memory address )
					case "W":
						throw new Error( "SIMD registers unsupported" );
						break;
					// Memory, addressed by DS:SI register pair
					case "X":
						this.SetType("GENERAL");
						this.SetSegmentRegister(CPU.DS);
						this.reg = CPU.SI;
						this.SetIsPointer(true);
						break;
					// Memory, addressed by ES:DI register pair
					case "Y":
						this.SetType("GENERAL");
						this.SetSegmentRegister(CPU.ES);
						this.reg = CPU.DI;
						this.SetIsPointer(true);
						break;
					// EFLAGS register
					case "F":
						break;
					default:
						throw new Error( "Invalid AddressingMethodCode '" + addrMethodCode + "'." );
					}
				}
				/* ============ /Determine addressing method from AddressMethodCode ============ */
				
			// Operand flags may indicate a constant value
			} else {
				// Constant value is valid
				if ( isFinite(nameMapFlags) ) {
					// Store immediate value
					this.SetType("IMMEDIATE");
					// Should already be a primitive number; no need to convert
					//	( use mul * 1 if needed )
					this.SetImmediate(nameMapFlags);
				// Error; invalid flags... ?!
				} else {
					throw new Error( "Invalid operand flags: '" + nameMapFlags + "'" );
				}
			}
			/* ============ /Determine size ( in bytes ) of operand from TypeCode ============ */
		}
	}
	
	// Polymorphic, based on type
	Operand.prototype.Write = null;
	// Polymorphic, based on type
	Operand.prototype.Read = null;
	
	Operand.prototype.SetImmediate = function ( immed ) {
		this.immed = immed;
	};
	Operand.prototype.GetImmediate = function () {
		return this.immed;
	};
	Operand.prototype.SetSegmentRegister = function ( reg ) {
		this.reg_segment = reg;
	};
	// Return effective Segment
	Operand.prototype.GetSegment = function () {
		// A Segment Register has been specified for this Operand
		if ( this.reg_segment ) {
			return this.reg_segment.Get();
		// DS is the default Segment Register
		} else {
			return CPU.DS.Get();
		}
	};
	Operand.prototype.SetDisplacement = function ( displacement ) {
		// Operand specifies a Register + Displacement
		if ( this.reg ) {
			this.SetType("GENERAL");
		// Operand specifies only a Displacement; direct address
		} else {
			this.SetType("MEM_DISPLACEMENT");
		}
		// Use of a displacement implies this is a memory pointer
		this.SetIsPointer(true);
		this.displacement = displacement;
	};
	Operand.prototype.SetType = function ( type ) {
		this.type = type;
		
		// Default to non-pointer methods ( polymorphic )
		this.Read = hsh_func_operandRead_NonPointer[this.type];
		this.Write = hsh_func_operandWrite_NonPointer[this.type];
	};
	Operand.prototype.SetIsPointer = function ( isPointer ) {
		/* ==== Guards ==== */
		jsEmu.Assert(this.type, "Operand.SetIsPointer :: type must be specified first (eg. GENERAL, SEGMENT, IMMEDIATE).");
		/* ==== /Guards ==== */
		
		this.isPointer = isPointer;
		
		// Change methods to use pointer ones ( polymorphic )
		if ( isPointer ) {
			this.Read = hsh_func_operandRead_WithPointer[this.type];
			this.Write = hsh_func_operandWrite_WithPointer[this.type];
		}
	};
	// Returns a human-readable ASM-format representation of the operand's data
	Operand.prototype.GetASMText = function () {
		/* ==== Malloc ==== */
		var text;
		/* ==== /Malloc ==== */
		switch ( this.type ) {
		case "IMMEDIATE":
			text = this.immed.toString(16).toUpperCase() + "h";
			// Surround with square brackets to indicate memory pointer
			if ( this.isPointer ) { text = (this.reg_segment ? this.reg_segment.name + ":" : "DS:") + "[" + text + "]"; }
			return text;
		case "MEM_DISPLACEMENT":
			text = this.displacement.toString(16).toUpperCase() + "h";
			if ( this.reg ) { text = this.reg.GetName() + "+" + text; }
			// Surround with square brackets to indicate memory pointer
			text = (this.reg_segment ? this.reg_segment.name + ":" : "DS:") + "[" + text + "]";
			return text;
		case "CONTROL":
		case "DEBUG":
		case "GENERAL":
		case "MMX":
		case "SEGMENT":
		case "SIMD":
			text = this.reg.GetName();
			if ( this.reg2 ) { text += "+" + this.reg2.GetName(); }
			if ( this.displacement ) { text += "+" + this.displacement.toString(16).toUpperCase() + "h"; }
			// Surround with square brackets to indicate memory pointer
			if ( this.isPointer ) { text = (this.reg_segment ? this.reg_segment.name + ":" : "DS:") + "[" + text + "]"; }
			return text;
		}
	};
	// TODO: this switch should not be needed - use polymorphism to use a different
	//	version of this function depending on the type
	Operand.prototype.GetPointerAddress = function () {
		switch ( this.type ) {
		case "GENERAL":
		case "SEGMENT":
			return (this.GetSegment() << 4) + this.reg.Get() + this.displacement;
		case "MEM_DISPLACEMENT":
			return (this.GetSegment() << 4) + this.displacement;
		default:
			throw new Error( "GetPointerAddress :: Cannot determine address offset component from type." );
		}
	};
	
	var hsh_func_operandRead_NonPointer = {};
	var hsh_func_operandRead_WithPointer = {};
	var hsh_func_operandWrite_NonPointer = {};
	var hsh_func_operandWrite_WithPointer = {};
	
	hsh_func_operandRead_NonPointer.SEGMENT = hsh_func_operandRead_NonPointer.GENERAL = function () {
		var res = this.reg.Get();
		return res;
	};
	hsh_func_operandRead_NonPointer.IMMEDIATE = function () {
		var res = this.immed;
		return res;
	};
	hsh_func_operandRead_WithPointer.SEGMENT = hsh_func_operandRead_WithPointer.GENERAL = function () {
		var res = DRAM.ReadBytes((this.GetSegment() << 4) + this.reg.Get() + this.displacement, this.insn.sizeAddress_Bytes);
		return res;
	};
	// Direct Memory Address/displacement; no register involved
	hsh_func_operandRead_WithPointer.MEM_DISPLACEMENT = function () {
		var res = DRAM.ReadBytes((this.GetSegment() << 4) + this.displacement, this.insn.sizeAddress_Bytes);
		return res; 
	};
	
	hsh_func_operandWrite_NonPointer.SEGMENT = hsh_func_operandWrite_NonPointer.GENERAL = function ( val ) {
		this.reg.Set(val);
	};
	hsh_func_operandWrite_WithPointer.SEGMENT = hsh_func_operandWrite_WithPointer.GENERAL = function ( val ) {
		DRAM.WriteBytes((this.GetSegment() << 4) + this.reg.Get() + this.displacement, val, this.insn.sizeAddress_Bytes);
	};
	// Direct Memory Address/displacement; no register involved
	hsh_func_operandWrite_WithPointer.MEM_DISPLACEMENT = function ( val ) {
		DRAM.WriteBytes((this.GetSegment() << 4) + this.displacement, val, this.insn.sizeAddress_Bytes);
	};
	
	/* ==== Exports ==== */
	jsEmu.Operand = Operand;
	/* ==== /Exports ==== */
});

// Add Module to emulator
jsEmu.AddModule(mod);