/*
 *	jsEmu - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: CPU Instruction Operand support
 */
var mod = new jsEmu.SecondaryModule( function ( jsEmu, machine, motherboard, CPU, FlashBIOSChip, BIOS, DRAM ) {
	// CPU Instruction Operand ( eg. dest or src ) class constructor
	function Operand( offset ) {
		/* ==== Guards ==== */
		jsEmu.Assert(this != self, "Operand constructor :: not called as constructor.");
		/* ==== /Guards ==== */
		
		// Offset ( in bytes ) of this Operand in memory
		this.offset = offset;
		// Register used ( if applicable )
		this.reg = null;
		this.reg2 = null;
		// Size of Operand in bytes ( if applicable )
		//this.sizeBytes = null;
		// Size of Address in bytes ( if applicable )
		//this.sizeBytesAddr = null;
		
		//this.valSignedWrap = null;
		//this.valMaxUnsigned = null;
		// Immediate/scalar number value of operand ( if applicable )
		this.immed = 0;
		// Register holding effective Segment of operand's pointer address ( if applicable )
		this.reg_segment = null;
		// Displacement of operand's pointer address in bytes ( if applicable )
		this.displacement = 0;
		// Type of operand's value ( Immediate data, General register, MMX register etc. )
		this.type = null;
		// Whether operand represents a memory pointer
		this.isPointer = false;
		
		// Store ref to parent Instruction
		this.insnParent = null;
	}
	// Polymorphic, based on type
	Operand.prototype.Write = null;
	// Polymorphic, based on type
	Operand.prototype.Read = null;
	
	Operand.prototype.SetRegister = function ( reg ) {
		this.reg = reg;
		// Store size of register in bytes ( eg. AX is a word/2-byte register )
		//this.sizeBytes = reg.GetSize();
		//this.valMaxUnsigned = (1 << (this.sizeBytes * 8)) - 1;
		//this.valSignedWrap = (1 << (this.sizeBytes * 8));
	};
	Operand.prototype.SetTwinRegisters = function ( reg1, reg2 ) {
		this.reg = reg1;
		this.reg2 = reg2;
		// Store combined size of registers in bytes
		//this.sizeBytes = reg1.GetSize() + reg2.GetSize();
		//this.valSignedWrap = (1 << (this.sizeBytes * 8));
	};
	/*Operand.prototype.SetSize = function ( sizeBytes ) {
		// Store size of operand in bytes ( eg. AX is a word/2-byte register, 0xFF is a one-byte immediate )
		this.sizeBytes = sizeBytes;
		this.valSignedWrap = (1 << (this.sizeBytes * 8));
	};
	Operand.prototype.SetAddressSize = function ( sizeBytes ) {
		// Store size of memory Addresses for this Operand in bytes
		//	TODO: should this be stored against Instruction? For the minute, both Operands store the same value
		this.sizeBytesAddr = sizeBytes;
	};
	Operand.prototype.GetSize = function () {
		return this.sizeBytes;
	};*/
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
		case "IMMEDIATE":
			return (this.GetSegment() << 4) + this.immed + this.displacement;
		default:
			throw new Error( "GetPointerAddress :: Cannot determine address offset component from type." );
		}
	};
	// Decode an operand from machine code bytes
	Operand.prototype.Decode = function ( bytOpcode, nameMapFlags, attr_sizeAddress, attr_sizeOperand, reg_segment, fieldMod, fieldReg, fieldRM, flgSkipModRM ) {
		/* ==== Malloc ==== */
		var addrMethodCode;
		var addrMethod;
		var flgDirection;
		var flgOperandSize;
		var flgSign;
		var reg;
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
		
		this.SetSegmentRegister(reg_segment);
		
		// Flag indicates a general purpose register ( eg. AX, AH, AL )
		//	or segment register ( eg. CS, DS, SS )
		if ( reg = CPU.hsh_reg[nameMapFlags] ) {
			this.SetType("GENERAL");
			this.SetRegister(reg);
		// Flag indicates a 16-bit general purpose register ( eg. AX, SI )
		} else if ( attr_sizeAddress == 2 && (reg = CPU.hsh_reg[nameMapFlags.substr(1)]) ) {
			this.SetType("GENERAL");
			this.SetRegister(reg);
		// Flag indicates a 32-bit general purpose register ( eg. EAX, ESI )
		} else if ( attr_sizeAddress == 4 && (reg = CPU.hsh_reg[nameMapFlags.toUpperCase()]) ) {
			this.SetType("GENERAL");
			this.SetRegister(reg);
		// Normal operand descriptor
		} else {
			/* ============ Determine size ( in bytes ) of operand from TypeCode ============ */
			typeCode = nameMapFlags.charAt(1);
			// Look up TypeCode ( second character of flags text ) to determine operand size in bytes
			if ( (sizeBytes = CPU.hsh_size_operand[typeCode]) !== undefined ) {
				// Some flags indicate size ( in bytes ) should be doubled if operand-size attribute is set
				if ( attr_sizeOperand > 2 && (typeCode in CPU.hsh_flgDependsOnOperandSizeAttr) ) {
					sizeBytes *= 2;
				}
				//this.SetSize(sizeBytes);
				
				addrMethodCode = nameMapFlags.charAt(0);
				/* ============ Determine addressing method from AddressMethodCode ============ */
				// Operand addresses a register to be decoded using ModR/M Reg field
				if ( (addrMethod = CPU.hsh_addrmethodRegister[addrMethodCode]) !== undefined ) {
					this.SetType(addrMethod);
					
					// We are going to use ModR/M byte ( previously decoded ), so skip past it
					if ( flgSkipModRM ) { ++this.offset; }
					
					// Byte register
					if ( sizeBytes == 1 ) {
						this.SetRegister(CPU.arr_regOrdinals_Byte[fieldReg]);
					// Word or Segment register
					} else if ( sizeBytes == 2 ) {
						if ( addrMethod == "GENERAL" ) {
							this.SetRegister(CPU.arr_regOrdinals_Word[fieldReg]);
						} else if ( addrMethod == "SEGMENT" ) {
							this.SetRegister(CPU.arr_regOrdinals_Segment[fieldReg]);
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
						sizeBytes_Value = attr_sizeOperand == 2 ? 2 : 4;
						this.SetType("IMMEDIATE");
						this.SetImmediate(DRAM.ReadBytes(this.offset, sizeBytes_Value));
						this.SetIsPointer(true);
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
								this.SetRegister(CPU.arr_regOrdinals_Byte[fieldRM]);
							// Word register
							} else if ( sizeBytes == 2 ) {
								this.SetRegister(CPU.arr_regOrdinals_Word[fieldRM]);
							}
						// Decode ModR/M byte for 16-bit mode
						} else if ( attr_sizeAddress == 2 ) {
							// Fixed memory addressing is available ( a WORD displacement ) if combination [ mod=00, reg=BP/EBP ]
							if ( fieldMod == 0x00 && fieldRM == 0x06 ) {
								this.SetType("IMMEDIATE");
								this.SetIsPointer(true);
								var displacement = DRAM.ReadBytes(this.offset, 2);
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
								this.SetTwinRegisters(CPU.BX, CPU.SI);
								break;
							case 0x01:
								this.SetTwinRegisters(CPU.BX, CPU.DI);
								break;
							case 0x02:
								this.SetTwinRegisters(CPU.BP, CPU.SI);
								break;
							case 0x03:
								this.SetTwinRegisters(CPU.BP, CPU.DI);
								break;
							case 0x04:
								this.SetRegister(CPU.SI);
								break;
							case 0x05:
								this.SetRegister(CPU.DI);
								break;
							case 0x06:
								this.SetRegister(CPU.BP);
								break;
							case 0x07:
								this.SetRegister(CPU.BX);
								break;
							default:
								this.SetIsPointer(false);
							}
							
							// 8-bit / byte displacement ( memory address is reg1 + byte-size displacement )
							if ( fieldMod == 0x01 ) {
								this.SetIsPointer(true);
								var displacement = DRAM.Read1Byte(this.offset);
								this.SetDisplacement(displacement >> 7 ? displacement - 0x100 : displacement);
								// Move offset pointer past the displacement just read
								++this.offset;
							// 16-bit / byte displacement ( memory address is reg1 + word-size displacement )
							} else if ( fieldMod == 0x02 ) {
								this.SetIsPointer(true);
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
					case "Q":	// ModR/M byte follows opcode, specifies operand ( either MMX register or memory address )
						throw new Error( "MMX registers unsupported" );
						break;
					case "W":	// ModR/M byte follows opcode, specifies operand ( either SIMD floating-point register or memory address )
						throw new Error( "SIMD registers unsupported" );
						break;
					// Memory, addressed by DS:SI register pair
					case "X":
						this.SetType("GENERAL");
						this.SetSegmentRegister(CPU.DS);
						this.SetRegister(CPU.SI);
						this.SetIsPointer(true);
						break;
					// Memory, addressed by ES:DI register pair
					case "Y":
						this.SetType("GENERAL");
						this.SetSegmentRegister(CPU.ES);
						this.SetRegister(CPU.DI);
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
					this.SetImmediate(nameMapFlags);
				// Error; invalid flags... ?!
				} else {
					throw new Error( "Invalid operand flags: '" + nameMapFlags + "'" );
				}
			}
			/* ============ /Determine size ( in bytes ) of operand from TypeCode ============ */
		}
	};
	
	var hsh_func_operandRead_NonPointer = {};
	var hsh_func_operandRead_WithPointer = {};
	var hsh_func_operandWrite_NonPointer = {};
	var hsh_func_operandWrite_WithPointer = {};
	
	hsh_func_operandRead_NonPointer.SEGMENT = hsh_func_operandRead_NonPointer.GENERAL = function () {
		var res = this.reg.Get();
		/* ==== Guards ==== */
		//jsEmu.Assert(res >= 0, "Operand.Read(Non-pointer) :: a negative number was read from a register (should only be in two's complement/positive).");
		/* ==== /Guards ==== */
		return res;
	};
	hsh_func_operandRead_NonPointer.IMMEDIATE = function () {
		var res = this.immed;
		/* ==== Guards ==== */
		//jsEmu.Assert(res >= 0, "Operand.Read(Non-pointer immediate) :: a negative number was read from immediate data (should only be in two's complement/positive).");
		/* ==== /Guards ==== */
		return res;
	};
	hsh_func_operandRead_WithPointer.SEGMENT = hsh_func_operandRead_WithPointer.GENERAL = function () {
		var res = DRAM.ReadBytes((this.GetSegment() << 4) + this.reg.Get() + this.displacement, this.sizeBytes);
		/* ==== Guards ==== */
		//jsEmu.Assert(res >= 0, "Operand.Read(With-pointer) :: a negative number was read from memory (should only be in two's complement/positive).");
		/* ==== /Guards ==== */
		return res;
	};
	hsh_func_operandRead_WithPointer.IMMEDIATE = function () {
		var res = DRAM.ReadBytes((this.GetSegment() << 4) + this.immed, this.sizeBytes);
		/* ==== Guards ==== */
		//jsEmu.Assert(res >= 0, "Operand.Read(With-pointer immediate) :: a negative number was read from memory (should only be in two's complement/positive).");
		/* ==== /Guards ==== */
		return res; 
	};
	
	hsh_func_operandWrite_NonPointer.SEGMENT = hsh_func_operandWrite_NonPointer.GENERAL = function ( val ) {
		/* ==== Guards ==== */
		//jsEmu.Assert(val >= 0, "Operand.Write(Non-pointer) :: tried to write a negative value to a register (hint: use two's complement).");
		/* ==== /Guards ==== */
		this.reg.Set(val);
	};
	hsh_func_operandWrite_WithPointer.SEGMENT = hsh_func_operandWrite_WithPointer.GENERAL = function ( val ) {
		/* ==== Guards ==== */
		//jsEmu.Assert(val >= 0, "Operand.Write(With-pointer) :: tried to write a negative value to memory (hint: use two's complement).");
		/* ==== /Guards ==== */
		DRAM.WriteBytes((this.GetSegment() << 4) + this.reg.Get() + this.displacement, val, this.sizeBytes);
	};
	hsh_func_operandWrite_WithPointer.IMMEDIATE = function ( val ) {
		/* ==== Guards ==== */
		//jsEmu.Assert(val >= 0, "Operand.Write(With-pointer immediate) :: tried to write a negative value to memory (hint: use two's complement).");
		/* ==== /Guards ==== */
		DRAM.WriteBytes((this.GetSegment() << 4) + this.immed, val, this.sizeBytes);
	};
	
	/* ==== Exports ==== */
	jsEmu.Operand = Operand;
	/* ==== /Exports ==== */
});

// Add Module to emulator
jsEmu.AddModule(mod);