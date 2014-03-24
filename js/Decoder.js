/**
 * jemul8 - JavaScript x86 Emulator
 * http://jemul8.com/
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*global define */
define([
    "js/util",
    "js/EventEmitter",
    "js/Decoder/Instruction",
    "js/core/classes/decoder",
    "js/Decoder/Operand"
], function (
    util,
    EventEmitter,
    Instruction,
    LegacyDecoder,
    Operand
) {
    "use strict";

    var MASKS = {
        1: util.generateMask(1),
        2: util.generateMask(2),
        4: util.generateMask(4),
        6: util.generateMask(6)
    };

    function Decoder() {
        EventEmitter.call(this);

        this.legacyDecoder = null;
        this.opcodeExtensionMap = null;
        this.opcodeMap = null;
        this.partials = null;
    }

    util.inherit(Decoder).from(EventEmitter);

    util.extend(Decoder.prototype, {
        bindCPU: function (cpu) {
            var decoder = this,
                registers = cpu.getRegisters();

            if (decoder.legacyDecoder) {
                throw new Error("Decoder.bindCPU() :: Already inited");
            }

            decoder.legacyDecoder = new LegacyDecoder({
                ES: registers.es,
                CS: registers.cs,
                SS: registers.ss,
                DS: registers.ds,
                FS: registers.fs,
                GS: registers.gs,

                AL: registers.al,
                AH: registers.ah,
                CL: registers.cl,
                CH: registers.ch,
                BL: registers.bl,
                BH: registers.bh,
                DL: registers.dl,
                DH: registers.dh,

                AX: registers.ax,
                EAX: registers.eax,
                CX: registers.cx,
                ECX: registers.ecx,
                BX: registers.bx,
                EBX: registers.ebx,
                DX: registers.dx,
                EDX: registers.edx,
                SP: registers.sp,
                ESP: registers.esp,
                BP: registers.bp,
                EBP: registers.ebp,
                SI: registers.si,
                ESI: registers.esi,
                DI: registers.di,
                EDI: registers.edi,

                CR0: registers.cr0,
                CR1: registers.cr1,
                CR2: registers.cr2,
                CR3: registers.cr3,
                CR4: registers.cr4,

                DR0: registers.dr0,
                DR1: registers.dr1,
                DR2: registers.dr2,
                DR3: registers.dr3,
                DR4: registers.dr4,
                DR5: registers.dr5,
                DR6: registers.dr6,
                DR7: registers.dr7
            });
        },

        decode: function (byteView, offset, is32Bit) {
            /*jshint bitwise: false */
            var byt,
                decoder = this,
                decoderState = {
                    byteView: byteView,
                    offset: offset
                },
                getNextPrefixByte = true,
                legacyDecoder = decoder.legacyDecoder,
                instruction = new Instruction(is32Bit, is32Bit, "", legacyDecoder.DS),
                opcodeData,
                segregOverride = null;

            while (getNextPrefixByte) {
                // Read next byte of code - may be an opcode or a prefix
                byt = byteView[decoderState.offset++];

                // Prefixes
                switch (byt) {
                // 2-byte opcode escape
                case 0x0F:
                    byt = 0x100 | byteView[decoderState.offset++];
                    getNextPrefixByte = false;
                    break;
                // Segment overrides
                case 0x26:
                    segregOverride = legacyDecoder.ES;
                    break;
                case 0x2E:
                    segregOverride = legacyDecoder.CS;
                    break;
                case 0x36:
                    segregOverride = legacyDecoder.SS;
                    break;
                case 0x3E:
                    segregOverride = legacyDecoder.DS;
                    break;
                case 0x64:
                    segregOverride = legacyDecoder.FS;
                    break;
                case 0x65:
                    segregOverride = legacyDecoder.GS;
                    break;
                // Operand-Size Attribute
                case 0x66:
                    instruction.operandSizeAttr = !instruction.operandSizeAttr;
                    break;
                // Address-Size Attribute
                case 0x67:
                    instruction.addressSizeAttr = !instruction.addressSizeAttr;
                    break;
                // Assert LOCK# Signal
                /*
                 *    In multiprocessor environments, this ensures
                 *    exclusive use of any memory for the instruction
                 *    it precedes. Ensures atomic operations.
                 *    (For now we have no multiprocessor support,
                 *    so can safely be ignored.)
                 */
                case 0xF0:
                    break;
                // REPNE - String repeat operation
                case 0xF2:
                    instruction.repeat = "#REPNE";
                    break;
                // REP - String repeat operation
                case 0xF3:
                    instruction.repeat = "#REP/REPE";
                    break;
                // Immediately exit prefix loop when we encounter
                //    a non-prefix byte
                default:
                    getNextPrefixByte = false;
                }
            }

            opcodeData = decoder.opcodeMap[byt];

            // Decode any operands
            opcodeData.decodeFor(instruction, decoderState);

            if (segregOverride) {
                instruction.segreg = segregOverride;
            }

            instruction.length = decoderState.offset - offset;

            return instruction;
        },

        getRegisters: function () {
            var legacyDecoder = this.legacyDecoder;

            return {
                eax: legacyDecoder.EAX,
                ax: legacyDecoder.AX,
                al: legacyDecoder.AL,
                ah: legacyDecoder.AH,

                ecx: legacyDecoder.ECX,
                cx: legacyDecoder.CX,
                cl: legacyDecoder.CL,
                ch: legacyDecoder.CH,

                ebx: legacyDecoder.EBX,
                bx: legacyDecoder.BX,
                bl: legacyDecoder.BL,
                bh: legacyDecoder.BH,

                edx: legacyDecoder.EDX,
                dx: legacyDecoder.DX,
                dl: legacyDecoder.DL,
                dh: legacyDecoder.DH,

                ebp: legacyDecoder.EBP,
                bp: legacyDecoder.BP,

                edi: legacyDecoder.EDI,
                di: legacyDecoder.DI,

                esi: legacyDecoder.ESI,
                si: legacyDecoder.SI,

                esp: legacyDecoder.ESP,
                sp: legacyDecoder.SP,

                eip: legacyDecoder.EIP,
                ip: legacyDecoder.IP,

                cs: legacyDecoder.CS,
                ds: legacyDecoder.DS,
                es: legacyDecoder.ES,
                fs: legacyDecoder.FS,
                gs: legacyDecoder.GS,
                ss: legacyDecoder.SS,

                cr0: legacyDecoder.CR0,
                cr1: legacyDecoder.CR1,
                cr2: legacyDecoder.CR2,
                cr3: legacyDecoder.CR3,
                cr4: legacyDecoder.CR4,

                dr0: legacyDecoder.DR0,
                dr1: legacyDecoder.DR1,
                dr2: legacyDecoder.DR2,
                dr3: legacyDecoder.DR3,
                dr4: legacyDecoder.DR4,
                dr5: legacyDecoder.DR5,
                dr6: legacyDecoder.DR6,
                dr7: legacyDecoder.DR7
            };
        },

        init: function init() {
            function read(decoderState, size) {
                /*jshint bitwise: false */
                var result;

                if (size === 1) {
                    result = decoderState.byteView[decoderState.offset];
                } else if (size === 2) {
                    result = decoderState.byteView[decoderState.offset] |
                        (decoderState.byteView[decoderState.offset + 1] << 8);
                } else if (size === 4) {
                    result = decoderState.byteView[decoderState.offset] |
                        (decoderState.byteView[decoderState.offset + 1] << 8) |
                        (decoderState.byteView[decoderState.offset + 2] << 16) |
                        (decoderState.byteView[decoderState.offset + 3] << 24);
                }

                decoderState.offset += size;

                return result;
            }

            function readDisplacement(operand, size, decoderState) {
                // Use of a displacement implies a memory pointer
                operand.isPointer = true;

                operand.displacement = util.signExtend(read(decoderState, size), size, operand.addressSize);
                operand.displacementSize = operand.addressSize;
            }

            var decoder = this,
                legacyDecoder = decoder.legacyDecoder || (decoder.legacyDecoder = new LegacyDecoder()),
                opcodeExtensionMap = {},
                opcodeMap = {},
                partials = {
                    "decodeModRM": function (instruction, operand, decoderState) {
                        /*jshint bitwise: false */
                        var addressSize = operand.addressSize,
                            base,
                            index,
                            modRM = instruction.modRM,
                            mod = modRM.mod,
                            rm = modRM.rm,
                            scale,
                            sib;

                        // Mod field represents that RM indicates just a general register
                        if (mod === 0x03) {
                            operand.type = "GENERAL";

                            operand.reg = legacyDecoder.hsh_size_regOrdinals[operand.size][rm];

                            return; // Done!
                        }

                        // Otherwise must be memory pointer
                        operand.isPointer = true;

                        // Default base register
                        operand.reg = legacyDecoder.hsh_size_regOrdinals[ addressSize ][ rm ];

                        // 32-bit addressing modes: note that mod === 0x03
                        //  is handled above
                        if (addressSize === 4) {
                            // No SIB byte
                            if (rm !== 4) {
                                if (mod === 0x00) {
                                    if (rm === 5) {
                                        operand.reg = null;
                                        readDisplacement(operand, 4, decoderState);
                                    }
                                    // mod==00b, rm!=4, rm!=5
                                    return; // Done!
                                }
                                instruction.segreg = legacyDecoder.segreg_mod1or2_base32[ rm ];
                            // mod!=11b, rm==4, SIB byte follows
                            } else {
                                sib = read(decoderState, 1);

                                scale = Math.pow(2, (sib >>> 6));
                                index = (sib >>> 3) & 7;
                                base = sib & 7;

                                if (index !== 4) {
                                    operand.reg2 = legacyDecoder.hsh_size_regOrdinals[ addressSize ][ base ];
                                }

                                operand.scale = scale;
                                operand.reg = legacyDecoder.hsh_size_regOrdinals[ addressSize ][ index ];

                                if (mod === 0x00) {
                                    instruction.segreg = legacyDecoder.segreg_mod0_base32[ base ];

                                    if (base === 5) {
                                        operand.reg2 = null;

                                        // mod = 10b
                                        readDisplacement(operand, 4, decoderState);
                                    }

                                    return; // Done!
                                } else {
                                    instruction.segreg = legacyDecoder.segreg_mod1or2_base32[ base ];
                                }
                            }

                            if (mod === 0x01) {
                                // 8-bit displacement, sign-extended to 32-bit
                                readDisplacement(operand, 1, decoderState);
                                return; // Done!
                            }

                            // mod = 10b
                            readDisplacement(operand, 4, decoderState);
                            return; // Done!
                        // 16-bit addressing mode
                        } else {
                            // Derive Base & Index registers to use from RM field (eg. [BX+SI])
                            operand.reg = legacyDecoder.hsh_regOrdinals_Base[ rm ];
                            operand.reg2 = legacyDecoder.hsh_regOrdinals_Index[ rm ];

                            if (mod === 0x00) {
                                // Derive Segment Register to use from RM field
                                instruction.segreg = legacyDecoder.hsh_regOrdinals_Segment_Mod00RM16[ rm ];

                                // Fixed memory addressing is available (a WORD displacement)
                                //  if arbitrary combination [ mod=00, reg=BP/EBP ]
                                //  NB: this obviously means that there is no simple way
                                //  to access memory given by the BP register,
                                //  so an assembler would use a zero displacement
                                //  (eg. [BP+00h]) for that particular operand.
                                if (rm === 0x06) {
                                    // Not using (E)BP (see above notes)
                                    operand.reg = null;

                                    readDisplacement(operand, 2, decoderState);

                                    return; // Done!
                                }
                                operand.type = "GENERAL";

                                return; // Done!
                            }
                            operand.type = "GENERAL";

                            // Derive Segment Register to use from RM field
                            //  (uses different map from the one above)
                            instruction.segreg = legacyDecoder.hsh_regOrdinals_Segment_Mod01or10RM16[ rm ];

                            // 8-bit / 1-byte displacement (memory address is reg1 + byte-size displacement)
                            if (mod === 0x01) {
                                readDisplacement(operand, 1, decoderState);

                                return; // Done!
                            }

                            // 16-bit / 2-byte displacement (memory address is reg1 + word-size displacement)
                            //  (mod === 0x02)
                            readDisplacement(operand, 2, decoderState);

                            return; // Done!
                        }
                    },
                    "getModRM": function (instruction, decoderState) {
                        /*jshint bitwise: false */
                        var modRM = decoderState.byteView[decoderState.offset++];

                        instruction.modRM = {
                            mod: modRM >>> 6,          // Mod field is first 2 bits
                            nnn: (modRM >>> 3) & 0x07, // Reg field is second 3 bits (Reg 2)
                            rm: modRM & 0x07           // Register/Memory field is last 3 bits (Reg 1)
                        };
                    },
                    "read": read,
                    "decodeDisplacement": function (operand, decoderState) {
                        readDisplacement(operand, operand.addressSize, decoderState);
                    },
                    "signExtend": util.signExtend,
                    "useDSSI": function (operand) {
                        operand.reg = operand.addressSize === 4 ? registers.esi : registers.si;
                    },
                    "useESDI": function (operand) {
                        operand.segreg = registers.es;
                        operand.reg = operand.addressSize === 4 ? registers.edi : registers.di;
                    },
                    "Operand": Operand
                },
                registers,
                usesOpcodeExtensionInNNN = [
                    // Immediate Grp 1 (1A)
                    0x80,
                    0x81,
                    0x82,
                    0x83,

                    0xc0,
                    0xc1,

                    0xc6,
                    0xc7,

                    0xd0,
                    0xd1,
                    0xd2,
                    0xd3,

                    0xf6,
                    0xf7,

                    0xfe,
                    0xff,

                    0x100,
                    0x101,
                    0x1ba,
                    0x1c7
                ];

            decoder.opcodeExtensionMap = opcodeExtensionMap;
            decoder.opcodeMap = opcodeMap;
            decoder.partials = partials;

            registers = decoder.getRegisters();

            decoder.emit("pre init", {
                partials: partials
            });

            function createOpcodeData(data, opcode) {
                var hasModRM = LegacyDecoder.opcodeHasModRM32[opcode],
                    name = data[0],
                    opcodeData = {
                        "MASKS": MASKS,
                        "legacyDecoder": legacyDecoder,
                        "name": name,
                        "partials": partials,
                        "registers": registers
                    },
                    parts = [
                        "var partials = this.partials;"
                    ];

                if (hasModRM) {
                    parts.push("partials.getModRM(instruction, decoderState);");
                }

                // Loop through the operands for this instruction
                util.each(data[1], function (attributes, index) {
                    /*jshint bitwise: false, multistr: true */

                    var addrMethodCode,
                        highImmediateExpression = "0",
                        highImmediateSizeExpression = "0",
                        immediateExpression = "0",
                        immediateSizeExpression = "0",
                        isPointerExpression = "false",
                        isRelativeJumpExpression = "false",
                        operandMaskExpression = "instruction.operandSizeAttr ? " + MASKS[4] + " : " + MASKS[2],
                        operandSizeExpression = "instruction.operandSizeAttr ? 4 : 2",
                        operandSizeLookup,
                        operandParts = [],
                        register1Expression = "null",
                        staticOperandSize,
                        typeCode,
                        typeExpression = "null";

                    // Normal operand descriptor
                    if (typeof attributes === "number") {
                        /* ============ Determine size (in bytes) of operand from TypeCode ============ */
                        // Not a constant unless high byte is 0x1B (common case)
                        //  (this is an extension condition used by jemul8
                        //  for const operand val eg. ROL AX 1, see opcode_data.js)
                        if ((attributes & 0xFF00) !== 0x1B00) {
                            // TypeCode stored in low byte
                            typeCode = attributes & 0xFF;

                            // Look up TypeCode to determine operand size in bytes
                            opcodeData["operand" + (index + 1) + "SizeLookup"] = LegacyDecoder.hsh_size_operand[typeCode];
                            operandSizeExpression = "this.operand" + (index + 1) + "SizeLookup[instruction.operandSizeAttr ? '1' : '0']";
                            operandMaskExpression = "this.MASKS[this.operand" + (index + 1) + "SizeLookup[instruction.operandSizeAttr ? '1' : '0']]";

                            // AddressingMethod stored in high byte (for speed we leave the AddressingMethod shifted
                            //  left by 8 bits, so that we do not need to shift right here before doing a table lookup)
                            //  TODO: This is confusing - why not just "= attrs >>> 8" with
                            //      opcode_data.js: hsh[C] = "CONTROL" -> hsh[C >>> 8] = "CONTROL" ?
                            //  (test whether ">>>" is faster than "&")
                            addrMethodCode = attributes & 0xFF00;

                            // Determine addressing method from AddressMethodCode
                            switch (addrMethodCode) {
                            case 0x0300: //"C": // Operand addresses a Control register to be decoded using ModR/M Reg field
                                register1Expression = "this.legacyDecoder.hsh_regOrdinals_Control[instruction.modRM.nnn]";
                                break;
                            case 0x0400: //"D": // Operand addresses a Debug register to be decoded using ModR/M Reg field
                                register1Expression = "this.legacyDecoder.hsh_regOrdinals_Debug[instruction.modRM.nnn]";
                                break;
                            case 0x0700: //"G": // Operand addresses a General register to be decoded using ModR/M Reg field
                                register1Expression = "this.legacyDecoder.hsh_size_regOrdinals[operandSizeExpression][instruction.modRM.nnn]";
                                break;
                            // No ModR/M byte used, Immediate data to be read
                            case 0x0100: //"A":
                            // Immediate data to be read
                            case 0x0900: //"I":
                                operandSizeLookup = LegacyDecoder.hsh_size_operand[typeCode];

                                // Handle 48-bit or 64-bit immediates by splitting into 2 dwords
                                highImmediateExpression = "(operandSizeExpression > 4 ? partials.read(decoderState, operandSizeExpression - 4) : 0)";
                                highImmediateSizeExpression = "(operandSizeExpression > 4 ? operandSizeExpression - 4 : 0)";

                                immediateExpression = "partials.read(decoderState, operandSizeExpression > 4 ? 4 : operandSizeExpression)";

                                // Operand size can be known statically for some type codes
                                if (operandSizeLookup[0] === operandSizeLookup[1] && index > 0) {
                                    staticOperandSize = operandSizeLookup[0];
                                    immediateExpression = "partials.signExtend(" + immediateExpression + ", " + staticOperandSize + ", instruction.operand1.size)";
                                    immediateSizeExpression = "instruction.operand1.size";
                                } else {
                                    immediateSizeExpression = "(operandSizeExpression > 4 ? 4 : operandSizeExpression)";
                                }

                                break;
                            // Instruction contains relative offset, to be added to EIP
                            case 0x0A00: //"J":
                                immediateExpression = "partials.read(decoderState, operandSizeExpression)";
                                immediateSizeExpression = "operandSizeExpression";

                                isRelativeJumpExpression = "true";
                                break;
                            // No ModR/M byte, offset coded as word or dword
                            //  (dep. on operand-size attr)
                            case 0x0F00: //"O":
                                operandParts.push("partials.decodeDisplacement(instruction.operand" + (index + 1) + ", decoderState);");
                                break;
                            case 0x0500: //"E": // ModR/M byte follows opcode, specifies operand (either general register or memory address)
                            case 0x0D00: //"M": // ModR/M byte may only refer to memory
                            case 0x1200: //"R": // ModR/M byte may only refer to general purpose reg (mod = general register)
                                operandParts.push("partials.decodeModRM(instruction, instruction.operand" + (index + 1) + ", decoderState);");
                                break;
                            // ModR/M byte follows opcode, specifies operand (either MMX register or memory address)
                            case 0x1100: //"Q":
                                operandParts.push("throw new Error('MMX registers not supported yet');");
                                break;
                            case 0x1300: //"S": // Operand addresses a Segment register to be decoded using ModR/M Reg field
                                register1Expression = "this.legacyDecoder.hsh_regOrdinals_Segment[instruction.modRM.nnn]";
                                break;
                            case 0x1600: //"V": The reg field of the ModR/M byte selects a packed SIMD floating-point register
                                operandParts.push("throw new Error('SIMD registers not supported yet');");
                                break;
                            // ModR/M byte follows opcode, specifies operand (either SIMD floating-point register or memory address)
                            case 0x1700: //"W":
                                operandParts.push("throw new Error('SIMD registers not supported yet');");
                                break;
                            // Memory, addressed by DS:SI register pair
                            case 0x1800: //"X":
                                typeExpression = "'GENERAL'";
                                // DS may be overridden for string operations...
                                //  (set as default)
                                operandParts.push("partials.useDSSI(instruction.operand" + (index + 1) + ");");
                                isPointerExpression = "true";
                                break;
                            // Memory, addressed by ES:DI register pair
                            case 0x1900: //"Y":
                                typeExpression = "'GENERAL'";
                                // ... but ES may not
                                operandParts.push("partials.useESDI(instruction.operand" + (index + 1) + ");");
                                isPointerExpression = "true";
                                break;
                            // (E)FLAGS register
                            case 0x0600: //"F":
                                break;
                            default:
                                util.problem("Unsupported AddressingMethodCode '" + addrMethodCode + "'.");
                            }
                        // Operand flags indicate a constant value
                        } else {
                            // Only low-byte holds constant, zero out higher bits
                            immediateExpression = attributes & 0x00ff;
                            immediateSizeExpression = "1";
                            operandSizeExpression = "1";
                            operandMaskExpression = "0xff";
                        }

                        parts.push("var operandSizeExpression = " + operandSizeExpression + ";");
                        parts.push("var operandMaskExpression = " + operandMaskExpression + ";");
                        parts.push("var register1Expression = " + register1Expression + ";");
                    // Flag indicates a general purpose register (eg. AX, AH, AL)
                    //  or segment register (eg. CS, DS, SS)
                    } else {
                        // 32-bit, depending on operand-size attribute
                        if (attributes.length === 3) {
                            register1Expression = "instruction.operandSizeAttr ? this.registers." + attributes.toLowerCase() + " : this.registers." + attributes.toLowerCase().substr(1);
                        } else {
                            register1Expression = "this.registers." + attributes.toLowerCase();
                        }

                        operandSizeExpression = "register1Expression.getSize()";
                        operandMaskExpression = "register1Expression.getMask()";
                        typeExpression = "'GENERAL'";

                        parts.push("var register1Expression = " + register1Expression + ";");
                        parts.push("var operandSizeExpression = " + operandSizeExpression + ";");
                        parts.push("var operandMaskExpression = " + operandMaskExpression + ";");
                    }



                    parts.push("instruction.operand" + (index + 1) + " = new partials.Operand(\
    // Instruction this Operand belongs to\n\
    /*insn: */instruction,\n\
    // Offset (in bytes) of this Operand in memory\n\
    /*offset: */decoderState.offset,\n\
\n\
    /*addressSize: */instruction.addressSizeAttr ? 4 : 2,\n\
    /*addressMask: */instruction.addressSizeAttr ? 0xffffffff : 0xffff,\n\
    /*size: */operandSizeExpression, // May change further down\n\
    /*mask: */operandMaskExpression,\n\
\n\
    // Scale, Index & Base registers used (if applicable)\n\
    /*scale: */1,\n\
    /*reg: */register1Expression,\n\
    /*reg2: */null,\n\
\n\
    // Immediate/scalar number value of operand (if applicable) -\n\
    //  NOT for storing memory addresses (use displacement for that)\n\
    //  (Mutex'd with .displacement)\n\
    /*immed: */" + immediateExpression + ",\n\
    /*immedSize: */" + immediateSizeExpression + ",\n\
    /*highImmed: */" + highImmediateExpression + ",\n\
    /*highImmedSize: */" + highImmediateSizeExpression + ",\n\
\n\
    // Displacement / operand's Memory Pointer address in bytes (if applicable)\n\
    //  (Mutex'd with .immed)\n\
    /*displacement: */0,\n\
    /*displacementSize: */0,\n\
    // Type of operand's value (Immediate data, General register, MMX register etc.)\n\
    /*type: */" + typeExpression + ",\n\
    // Whether operand represents a memory pointer\n\
    /*isPointer: */" + isPointerExpression + ",\n\
\n\
    /*isRelativeJump: */" + isRelativeJumpExpression + "\n\
);");

                    [].push.apply(parts, operandParts);

                    decoder.emit("init operand", {
                        addSet: function (propertyName, expression) {
                            parts.push("instruction.operand" + (index + 1) + "." + propertyName + " = " + expression + ";");
                        }
                    });
                });

                parts.push("instruction.opcodeData = this;");
                parts.push("instruction.execute = this.execute;");

                if (!/^\w+$/.test(name)) {
                    name = "Unknown";
                }

                /*jshint evil: true */
                opcodeData.decodeFor = new Function("return (function Decode" + name + "(instruction, decoderState) {" + parts.join("\n") + "});")();

                return opcodeData;
            }

            // Translate legacy decoder table into faster version
            util.each(LegacyDecoder.arr_mapOpcodes, function translateOpcodeData(data, opcode) {
                opcodeMap[opcode] = createOpcodeData(data, opcode);
            });

            util.each(LegacyDecoder.arr_mapOpcodeExtensions, function translateOpcodeExtensionData(data, opcode) {
                opcodeExtensionMap[opcode] = createOpcodeData(data, opcode);
            });

            // Handle opcode extensions (with NNN field of ModR/M)
            util.each(usesOpcodeExtensionInNNN, function (opcode) {
                var opcodeData = {
                        decodeFor: function decodeForOpcodeExtension(instruction, decoderState) {
                            /*jshint bitwise: false */
                            var opcodeExtensionData;

                            // Use the ModR/M byte's NNN field as opcode extension
                            partials.getModRM(instruction, decoderState);
                            opcodeExtensionData = opcodeExtensionMap[(opcode << 3) | instruction.modRM.nnn];

                            // Decode any operands
                            opcodeExtensionData.decodeFor(instruction, decoderState);
                        }
                    };

                opcodeMap[opcode] = opcodeData;
            });

            decoder.emit("post init", {
                opcodeExtensionMap: opcodeExtensionMap,
                opcodeMap: opcodeMap
            });
        }
    });

    return Decoder;
});
