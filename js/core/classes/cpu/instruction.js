/*
 *  jemul8 - JavaScript x86 Emulator
 *  Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *
 * MODULE: x86 Instruction class support
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
    "../decoder",
    "./operand"
], function (
    util,
    Decoder,
    Operand
) {
    "use strict";

    // x86 Instruction (eg. MOV, CMP) class constructor
    function Instruction(name, offset, addressSizeAttr, operandSizeAttr) {
        //util.assert(this && (this instanceof Instruction)
        //    , "Instruction ctor() :: error - not called properly"
        //);

        // Mnemonic / name of Instruction
        this.name = name;
        // Absolute offset address of Instruction
        this.offset = offset;
        this.operand1 = null;
        this.operand2 = null;
        this.operand3 = null;
        // Length of Instruction in bytes
        this.lenBytes = 0;

        // Repeat prefix for String Instructions (eg. MOVS, LODS, CMPS, SCAS)
        this.repeat = "";

        this.segreg = null;

        // Address-size attribute
        this.addressSizeAttr = addressSizeAttr;
        // Operand-size attribute
        this.operandSizeAttr = operandSizeAttr;
    }
    util.extend(Instruction, {
        // Create an Instruction object by disassembling machine code
        decode: function (decoder, read, offset, addressSizeAttr, operandSizeAttr) {
            //util.assert(decoder && (decoder instanceof Decoder)
            //    , "Instruction.decode() :: 'decoder' must be a Decoder object"
            //);

            var segregOverride = null,
                repeat = "", // REPNE etc.
            // Store start byte offset of instruction: will be needed later
                offsetStart = offset,
                byt,
                bytModRM,
                mod,
                nnn,
                rm,
                dataOpcode,
                insn;

            /* ====== Process any prefixes ====== */
            // (NB: see experiment results (at top) for why
            //    this is the optimum loop construct here.)
get_prefixes:
            while (true) {
                // Read next byte of code - may be an opcode or a prefix
                byt = read(offset++, 1);

                // Prefixes
                switch (byt) {
                // 2-byte opcode escape
                case 0x0F:
                    byt = 0x100 | read(offset++, 1);
                    break get_prefixes;

                // Segment overrides
                case 0x26: segregOverride = decoder.ES; break;
                case 0x2E: segregOverride = decoder.CS; break;
                case 0x36: segregOverride = decoder.SS; break;
                case 0x3E: segregOverride = decoder.DS; break;
                case 0x64: segregOverride = decoder.FS; break;
                case 0x65: segregOverride = decoder.GS; break;

                // Operand-Size Attribute
                // FIXME: In 32-bit mode, these would do the reverse...
                //        (but we should have a diff. FDE routine for that)
                case 0x66: operandSizeAttr = !operandSizeAttr; break;
                // Address-Size Attribute
                case 0x67: /*debugger; */addressSizeAttr = !addressSizeAttr; break;
                // Assert LOCK# Signal
                /*
                 *    In multiprocessor environments, this ensures
                 *    exclusive use of any memory for the instruction
                 *    it precedes. Ensures atomic operations.
                 *    (For now we have no multiprocessor support,
                 *    so can safely be ignored.)
                 */
                case 0xF0: break;
                // REPNE - String repeat operation
                case 0xF2: repeat = "#REPNE"; break;
                // REP - String repeat operation
                case 0xF3: repeat = "#REP/REPE"; break;
                // Immediately exit prefix loop when we encounter
                //    a non-prefix byte
                default:
                    break get_prefixes;
                }
            }
            /* ====== /Process any prefixes ====== */

            // Decode ModR/M byte
            if (Decoder.opcodeHasModRM32[byt]) {
                bytModRM = read(offset++, 1);
                //mod = bytModRM & 0xC0;                // Mod field is first 2 bits (but leave unshifted)
                mod = bytModRM >> 6;          // Mod field is first 2 bits
                nnn = (bytModRM >> 3) & 0x07; // Reg field is second 3 bits (Reg 2)
                rm = bytModRM & 0x07;         // Register/Memory field is last 3 bits (Reg 1)
            } else {
                mod = nnn = rm = 0;
            }

            // By default, assume Opcode is a 1-byte unextended; if not found in table,
            //    check Extensions table, using ModR/M Reg field as an Opcode Extension field (bits)
            dataOpcode = Decoder.arr_mapOpcodes[byt];
            if (!dataOpcode) {
                dataOpcode = Decoder.arr_mapOpcodeExtensions[(byt << 3) | nnn];
            }

            // Create new Instruction object
            insn = new Instruction(
                dataOpcode[0], // (For now) Instruction's name/mnemonic
                offsetStart,
                addressSizeAttr,
                operandSizeAttr
            );

            // Usually DS:[...] segment is used
            insn.segreg = decoder.DS;

            // If repeat prefix was used for a string operation,
            //    store it against the Instruction
            insn.repeat = repeat;

            // Instruction has operand(s) - (one or none
            //    of dest & src (possibly a third eg. for IMUL),
            //    these may be swapped with direction bit
            //    if present & applicable)
            if (dataOpcode.length > 1) {
                // (already determined it must exist)
                insn.operand1 = Operand.decode(
                    decoder,
                    insn,             // Give Operand a reference to its parent Instruction
                    read,
                    offset,           // Offset of Operand's first byte
                    dataOpcode[1][0], // Flags text for opcode from table
                    mod,
                    nnn,
                    rm
                );
                // Get offset after finishing decode (move past Operand's bytes)
                offset = insn.operand1.offset;

                setSegment(decoder, insn, insn.operand1);

                // Check whether Instruction uses a second Operand
                if (dataOpcode[1].length > 1) {
                    insn.operand2 = Operand.decode(
                        decoder,
                        insn,             // Give Operand a reference to its parent Instruction
                        read,
                        offset,           // Offset of Operand's first byte
                        dataOpcode[1][1], // Flags text for opcode from table
                        mod,
                        nnn,
                        rm
                    );
                    // Get offset after finishing decode (move past Operand's bytes)
                    offset = insn.operand2.offset;

                    if (insn.segreg === decoder.DS) {
                        setSegment(decoder, insn, insn.operand2);
                    }

                    // Check whether Instruction uses a third Operand
                    if (dataOpcode[1].length > 2) {
                        insn.operand3 = Operand.decode(
                            decoder,
                            insn,             // Give Operand a reference to its parent Instruction
                            read,
                            offset,           // Offset of Operand's first byte
                            dataOpcode[1][2], // Flags text for opcode from table
                            mod,
                            nnn,
                            rm
                        );
                        // Get offset after finishing decode (move past Operand's bytes)
                        offset = insn.operand3.offset;

                        if (insn.segreg === decoder.DS) {
                            setSegment(decoder, insn, insn.operand3);
                        }
                    }
                }
            }

            // Apply Segment Register override if present
            if (segregOverride !== null) { insn.segreg = segregOverride; }

            // Calculate length of Instruction in bytes
            insn.lenBytes = offset - offsetStart;

            return insn;
        },
        // Create an Instruction object by parsing x86 Assembly
        fromASM: function (asm) {
            util.panic("Instruction.fromASM() :: Not yet implemented");
        }
    });

    // Alias
    Instruction.disassemble = Instruction.decode;

    // Generate a human-readable assembly instruction
    //    (useful for debugging etc.)
    util.extend(Instruction.prototype, {
        getName: function () {
            return this.name;
        },
        // Generate x86 Assembly
        toASM: function () {
            var asm = (this.repeat ? this.repeat + " " : "") + this.getName();

            if (this.operand1) {
                asm += " " + this.operand1.toASM();
            }
            if (this.operand2) {
                asm += ", " + this.operand2.toASM();
            }
            if (this.operand3) {
                asm += ", " + this.operand3.toASM();
            }

            return asm;
        },
        // Generate x86 Machine Code
        assemble: function () {
            util.panic("Instruction.assemble() :: Not yet implemented");
        },
        // Override the effective Segment Register
        overrideSegReg: function (segreg) {
            if (segreg && segreg instanceof SegReg) {
                this.segreg = segreg;
            } else {
                util.panic("Instruction.overrideSegReg() :: Invalid segreg");
            }
        },
        // Get the effective Segment Register
        getSegReg: function () {
            return this.segreg;
        },
        // Set the default Operand Size, optionally overriding any prefix
        setOperandSize: function (operandSize, overridePrefix) {
            util.panic("Instruction.setOperandSize() :: Not yet implemented");
        },
        // Set the default Address Size, optionally overriding any prefix
        setAddressSize: function (addressSize, overridePrefix) {
            util.panic("Instruction.setAddressSize() :: Not yet implemented");
        },
        // Get length of instruction (in bytes)
        getLength: function () {
            return this.lenBytes;
        }
    });

    function setSegment(decoder, insn, operand) {
        // [Intel] The default segment register is SS for the effective
        //  addresses containing a BP or SP index, DS for other effective addresses
        if (operand.isPointer && (
                operand.reg === decoder.BP ||
                operand.reg === decoder.EBP ||
                operand.reg === decoder.SP ||
                operand.reg === decoder.ESP
            )) {

            if (insn.segreg !== decoder.SS) {
                debugger;
                util.panic("setSegment() :: Shouldn't be needed");
            }
            // insn.segreg = decoder.SS;
        }
    }

    // Exports
    return Instruction;
});
