/*
 * jemul8 - JavaScript x86 Emulator
 *
 * MODULE: x86 Instruction Operand class support
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
	"../decoder"
], function (
	util,
	Decoder
) {
    "use strict";

	// x86 Instruction Operand (eg. dest or src) class constructor
	function Operand(insn, offset) {
		//util.assert(this && (this instanceof Operand)
		//	, "Operand ctor :: error - constructor not called properly"
		//);

		// Instruction this Operand belongs to
		this.insn = insn;
		// Offset (in bytes) of this Operand in memory
		this.offset = offset;

		this.addressSize = 0;
		this.addressMask = 0;
		this.size = 0; // May change further down
		this.mask = 0;

		// Scale, Index & Base registers used (if applicable)
		this.reg = null;
		this.reg2 = null;

		// Usually will be null, meaning use instruction's segreg,
		//  but some (eg. string) operations may need ES: for operand 2
		this.segreg = null;

		// Immediate/scalar number value of operand (if applicable) -
		//	NOT for storing memory addresses (use displacement for that)
		//	(Mutex'd with .displacement)
		this.immed = 0;
		this.immedSize = 0;
        this.highImmed = 0;
		this.highImmedSize = 0;

		// Displacement / operand's Memory Pointer address in bytes (if applicable)
		//	(Mutex'd with .immed)
		this.displacement = 0;
		this.displacementSize = 0;
		// Type of operand's value (Immediate data, General register, MMX register etc.)
		this.type = null;
		// Whether operand represents a memory pointer
		this.isPointer = false;

		this.isRelativeJump = false;
	}

	util.extend(Operand, {
		// Create an Operand object by disassembling machine code
		decode: function (decoder, insn, read, offset, attrs, mod, nnn, rm) {
			// Create new Operand object
            var operand = new Operand(insn, offset);
			var addrMethodCode;
			var addrMethod;
			var addressSize = insn.addressSizeAttr ? 4 : 2;
			var size = insn.operandSizeAttr ? 4 : 2;
			var displacement;
			var typeCode;

			// Defaults
			operand.addressSize = addressSize;
			operand.addressMask = util.generateMask(addressSize);
			operand.size = size;
			operand.mask = util.generateMask(size);

			// Normal operand descriptor
			if (typeof attrs === "number") {
				/* ============ Determine size (in bytes) of operand from TypeCode ============ */
				// Not a constant unless high byte is 0x1B (common case)
				//	(this is an extension condition used by jemul8
				//	for const operand val eg. ROL AX 1, see opcode_data.js)
				if ((attrs & 0xFF00) !== 0x1B00) {
					// TypeCode stored in low byte
					typeCode = attrs & 0xFF;

					// Look up TypeCode to determine operand size in bytes
					if ( !(size = Decoder.hsh_size_operand
						[ typeCode ][ insn.operandSizeAttr & 1 ])
					) {
						util.problem("Invalid operand flags :: '"
							+ attrs + "'");
					}

					// Size has been recalculated; update
					operand.size = size;
					operand.mask = util.generateMask(size);

					// AddressingMethod stored in high byte (for speed we leave the AddressingMethod shifted
					//	left by 8 bits, so that we do not need to shift right here before doing a table lookup)
					//	TODO: This is confusing - why not just "= attrs >> 8" with
					//		opcode_data.js: hsh[C] = "CONTROL" -> hsh[C >> 8] = "CONTROL" ?
					//	(test whether ">>" is faster than "&")
					addrMethodCode = attrs & 0xFF00;
					/* ============ Determine addressing method from AddressMethodCode ============ */
					// Operand addresses a register to be decoded using ModR/M Reg field
					if ( (addrMethod
							= Decoder.hsh_addrmethodRegister[ addrMethodCode ])
							!== undefined ) {
						operand.type = addrMethod;

						// Segment register
						if (addrMethod === "SEGMENT") {
							operand.reg = decoder.hsh_regOrdinals_Segment[ nnn ];
						} else if (addrMethod === "CONTROL") {
							operand.reg = decoder.hsh_regOrdinals_Control[ nnn ];
						} else {
							operand.reg = decoder.hsh_size_regOrdinals[ size ][ nnn ];
						}
					// Use a fast switch to decide how to proceed
					} else {
						switch (addrMethodCode) {
						// No ModR/M byte used, Immediate data to be read
						case 0x0100: //"A":
						// Immediate data to be read
						case 0x0900: //"I":
                            // 48-bit or 64-bit: split into 2 dwords
                            if (size > 4) {
                                operand.setImmediate(read(operand.offset, 4), 4);
                                operand.highImmed = read(operand.offset + 4, size - 4);
                                operand.highImmedSize = size - 4;
                                // Move offset pointer past the value just read
                                operand.offset += size;
                            // Always sign-extend 8-bit immediates in operand2
                            } else if (size === 1 && insn.operand1) {
                                size = insn.operand1.size;
                                operand.size = size;
                                operand.setImmediate(util.signExtend(
                                    read(operand.offset, 1)
                                    , 1
                                    , size
                                ), size);
                                // Move offset pointer past the value just read
                                operand.offset += 1;
                            } else {
                                operand.setImmediate(read(operand.offset, size), size);
                                // Move offset pointer past the value just read
                                operand.offset += size;
                            }
							break;
						// Instruction contains relative offset, to be added to EIP
						case 0x0A00: //"J":
							operand.setImmediate(read(operand.offset, size), size);
							// Move offset pointer past the value just read
							operand.offset += size;

							operand.isRelativeJump = true;
							break;
						// No ModR/M byte, offset coded as word or dword
						//	(dep. on operand-size attr)
						case 0x0F00: //"O":
							operand.setDisplacement(read(operand.offset
								, addressSize), addressSize);
							// Move offset pointer past the value just read
							operand.offset += addressSize;
							break;
						case 0x0500: //"E":	// ModR/M byte follows opcode, specifies operand (either general register or memory address)
						case 0x0D00: //"M":	// ModR/M byte may only refer to memory
						case 0x1200: //"R":	// ModR/M byte may only refer to general purpose reg (mod = general register)
							// Mod field represents that RM indicates just a general register
							if (mod === 0x03) {
								operand.type = "GENERAL";

								operand.reg = decoder.hsh_size_regOrdinals
									[ size ][ rm ];

								return operand;	// Done!
							}

							// Otherwise must be memory pointer
							operand.isPointer = true;

							// Default base register
							operand.reg = decoder.hsh_size_regOrdinals[ addressSize ][ rm ];

							// 32-bit addressing modes: note that mod === 0x03
							//  is handled above
							if (addressSize == 4) {
								// No SIB byte
								if (rm !== 4) {
									if (mod === 0x00) {
										if (rm === 5) {
											operand.reg = null;
											operand.setDisplacement(read(operand.offset, 4), 4);
											// Move offset pointer past the displacement just read
											operand.offset += 4;
										}
										// mod==00b, rm!=4, rm!=5
										return operand; // Done!
									}
									insn.segreg = decoder.segreg_mod1or2_base32[ rm ];
								// mod!=11b, rm==4, SIB byte follows
								} else {
									util.panic("No SIB support yet.");
								}

								if (mod === 0x01) {
									// 8-bit displacement, sign-extended to 32-bit
									operand.setDisplacement(read(operand.offset, 1), 1);
									// Move offset pointer past the displacement just read
									++operand.offset;
									return operand; // Done!
								}

								// mod = 10b
								operand.setDisplacement(read(operand.offset, 4), 4);
								// Move offset pointer past the displacement just read
								operand.offset += 4;
								return operand; // Done!
							// 16-bit addressing mode
							} else {
								// Derive Base & Index registers to use from RM field (eg. [BX+SI])
								operand.reg = decoder.hsh_regOrdinals_Base[ rm ];
								operand.reg2 = decoder.hsh_regOrdinals_Index[ rm ];

								if (mod == 0x00) {
									// Derive Segment Register to use from RM field
									insn.segreg = decoder.hsh_regOrdinals_Segment_Mod00RM16[ rm ];

									// Fixed memory addressing is available (a WORD displacement)
                                    //  if arbitrary combination [ mod=00, reg=BP/EBP ]
									//	NB: this obviously means that there is no simple way
                                    //  to access memory given by the BP register,
									//	so an assembler would use a zero displacement
                                    //  (eg. [BP+00h]) for that particular operand.
									if (rm === 0x06) {
										// Not using (E)BP (see above notes)
										operand.reg = null;

										operand.setDisplacement(read(operand.offset, 2), 2);
										// Move offset pointer past the displacement just read
										operand.offset += 2;

										return operand;	// Done!
									}
									operand.type = "GENERAL";

									return operand;	// Done!
								}
								operand.type = "GENERAL";

								// Derive Segment Register to use from RM field
								//  (uses different map from the one above)
								insn.segreg = decoder.hsh_regOrdinals_Segment_Mod01or10RM16[ rm ];

								// 8-bit / 1-byte displacement (memory address is reg1 + byte-size displacement)
								if (mod === 0x01) {
									operand.setDisplacement(read(operand.offset, 1), 1);
									// Move offset pointer past the displacement just read
									++operand.offset;

									return operand;	// Done!
								}

								// 16-bit / 2-byte displacement (memory address is reg1 + word-size displacement)
								//  (mod === 0x02)
								operand.setDisplacement(read(operand.offset, 2), 2);
								// Move offset pointer past the displacement just read
								operand.offset += 2;

								return operand;	// Done!
							}
							break;
						// ModR/M byte follows opcode, specifies operand (either MMX register or memory address)
						case 0x1100: //"Q":
							util.problem("MMX registers unsupported");
							break;
						// ModR/M byte follows opcode, specifies operand (either SIMD floating-point register or memory address)
						case 0x1700: //"W":
							util.problem("SIMD registers unsupported");
							break;
						// Memory, addressed by DS:SI register pair
						case 0x1800: //"X":
							operand.type = "GENERAL";
							// DS may be overridden for string operations...
							//  (set as default)
							operand.reg = decoder.SI;
							operand.isPointer = true;
							break;
						// Memory, addressed by ES:DI register pair
						case 0x1900: //"Y":
							operand.type = "GENERAL";
							// ... but ES may not
							operand.segreg = decoder.ES;
							operand.reg = decoder.DI;
							operand.isPointer = true;
							break;
						// (E)FLAGS register
						case 0x0600: //"F":
							break;
						default:
							util.problem("Unsupported AddressingMethodCode '" + addrMethodCode + "'.");
						}
					}
					/* ============ /Determine addressing method from AddressMethodCode ============ */
				// Operand flags indicate a constant value
				} else {
					// Only low-byte holds constant, zero out higher bits
					operand.setImmediate(attrs & 0x00FF, 1);
					operand.size = 1;
					operand.mask = 0xFF;
				}
				/* ============ /Determine size (in bytes) of operand from TypeCode ============ */
			// Flag indicates a general purpose register (eg. AX, AH, AL)
			//	or segment register (eg. CS, DS, SS)
			} else if (operand.reg = decoder[ attrs ]) {
				operand.type = "GENERAL";
				operand.size = operand.reg.size;
				operand.mask = util.generateMask(operand.size);
			// Flag indicates a 16-bit general purpose register (eg. AX, SI)
			} else if (size === 2 && (operand.reg = decoder[ attrs.substr(1) ])) {
				operand.type = "GENERAL";
				operand.size = operand.reg.size;
				operand.mask = util.generateMask(operand.size);
			// Flag indicates a 32-bit general purpose register (eg. EAX, ESI)
			} else if (size === 4 && (operand.reg = decoder[ attrs.toUpperCase() ])) {
				operand.type = "GENERAL";
				operand.size = operand.reg.size;
				operand.mask = util.generateMask(operand.size);
			}

			return operand;
		}
	});

	// Alias
	Operand.disassemble = Operand.decode;

	util.extend(Operand.prototype, {
		setImmediate: function (immed, size) {
			this.type = "IMMEDIATE";

			this.immed = immed;
			this.immedSize = size;
		}, getImmediate: function () {
			return this.immed;
		// TODO: Sign-extend displacements here, instead of storing
		//       size of displacement to extend later
		}, setDisplacement: function (displacement, size) {
			// Operand specifies a Register + Displacement
			if (this.reg) {
				this.type = "GENERAL";
			// Operand specifies only a Displacement; direct address
			} else {
				this.type = "MEM_DISPLACEMENT";
			}
			// Use of a displacement implies this is a memory pointer
			this.isPointer = true;
			this.displacement = displacement;
			this.displacementSize = size;
		}, getDisplacement: function () {
			return util.signExtend(
				this.displacement
				, this.displacementSize
				, this.addressSize
			);
		// Returns a human-readable ASM-format representation of the operand's data
		}, toASM: function () {
			var asm = "";

			if (this.immedSize) {
				if (asm) { asm += "+"; }
				asm += util.sprintf(
					"%0" + (this.immedSize * 2) + "Xh"
					, this.immed
				);
			}
			if (this.reg) {
				if (asm) { asm += "+"; }
				asm += this.reg.getName();
			}
			if (this.reg2) {
				if (asm) { asm += "+"; }
				asm += this.reg2.getName();
			}
			if (this.displacementSize) {
				if (asm) { asm += "+"; }
				asm += util.sprintf(
					"%0" + (this.displacementSize * 2) + "Xh"
					, this.displacement
				);
			}

			// Surround with square brackets to indicate memory pointer
			if (this.isPointer) {
				asm = util.sprintf(
					"%s:[%s]", this.getSegReg().getName(), asm
				);
				// Indicate operand-size at the address
				asm = (this.size === 1 ? "b," : this.size === 2 ? "w," : "d,") + asm;
			}
			return asm;
		// Calculate effective address of operand (only valid
		//  for operands addressing memory)
		}, getPointerAddress: function (offset) {
			return (
				(this.reg ? this.reg.get() : 0)
				+ (this.reg2 ? this.reg2.get() : 0)
				+ (offset || 0)
				+ this.getDisplacement()
			) & this.addressMask;
		// Sign-extend operand value (usually to operand1's size)
		}, signExtend: function (to) {
			return util.signExtend(
				this.read(), this.size
				, to || this.insn.operand1.size
			);
		// Get effective Segment Register for this operand
		//  (usually set on the Instruction, but string operations
		//  use ES: for destination segment)
		}, getSegReg: function () {
			return this.segreg || this.insn.getSegReg();

        // Accessors: lazily set polymorphically on first use
		}, read: function (offset, size) {
            this.read = this.isPointer ? readWithPointer : readNonPointer;
            return this.read(offset, size);
        }, write: function (val, offset, size) {
            this.write = this.isPointer ? writeWithPointer : writeNonPointer;
            this.write(val, offset, size);
        }
	});

    // Accessors: see Operand.read() & Operand.write()
	function readWithPointer(offset, size) {
        return this.getSegReg().readSegment(
            this.getPointerAddress(offset)
            , size || this.size
        );
    }
    function readNonPointer(offset, size) {
        // NB: Immediate value will be zero
        //     if none specified in instruction
        return this.getImmediate()
            + (this.reg ? this.reg.get() : 0);
    }
	function writeWithPointer(val, offset, size) {
        this.getSegReg().writeSegment(
            this.getPointerAddress(offset)
            , val & this.mask
            , size || this.size
        );
    }
    function writeNonPointer(val, offset, size) {
        // NB: Must be to a register
        this.reg.set(val & this.mask);
    }

	// Exports
	return Operand;
});
