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
    "js/core/classes/decoder"
], function (
    util,
    EventEmitter,
    LegacyDecoder
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

        this.legacyDecoder = new LegacyDecoder();
        this.opcodeMap = null;
        this.partials = null;
    }

    util.inherit(Decoder).from(EventEmitter);

    util.extend(Decoder.prototype, {
        bindCPU: function (cpu) {
            var decoder = this;

            util.extend(decoder.legacyDecoder, {
                ES: cpu.es,
                CS: cpu.cs,
                SS: cpu.ss,
                DS: cpu.ds,
                FS: cpu.fs,
                GS: cpu.gs,

                AL: cpu.al,
                AH: cpu.ah,
                CL: cpu.cl,
                CH: cpu.ch,
                BL: cpu.bl,
                BH: cpu.bh,
                DL: cpu.dl,
                DH: cpu.dh,

                AX: cpu.ax,
                EAX: cpu.eax,
                CX: cpu.cx,
                ECX: cpu.ecx,
                BX: cpu.bx,
                EBX: cpu.ebx,
                DX: cpu.dx,
                EDX: cpu.edx,
                SP: cpu.sp,
                ESP: cpu.esp,
                BP: cpu.bp,
                EBP: cpu.ebp,
                SI: cpu.si,
                ESI: cpu.esi,
                DI: cpu.di,
                EDI: cpu.edi,

                CR0: cpu.cr0,
                CR1: cpu.cr1,
                CR2: cpu.cr2,
                CR3: cpu.cr3,
                CR4: cpu.cr4
            });
        },

        decode: function (view, offset, is32Bit) {
            /*jshint bitwise: false */
            var byt,
                decoder = this,
                decoderState = {
                    view: view,
                    offset: offset
                },
                legacyDecoder = decoder.legacyDecoder,
                instruction = {
                    addressSizeAttr: is32Bit,
                    operandSizeAttr: is32Bit,
                    repeat: "",
                    segreg: legacyDecoder.DS
                },
                opcodeData;

getPrefixes:
            while (true) {
                // Read next byte of code - may be an opcode or a prefix
                byt = view.getUint8(decoderState.offset++);

                // Prefixes
                switch (byt) {
                // 2-byte opcode escape
                case 0x0F:
                    byt = 0x100 | view.getUint8(decoderState.offset++);
                    break getPrefixes;
                // Segment overrides
                case 0x26:
                    instruction.segreg = legacyDecoder.ES;
                    break;
                case 0x2E:
                    instruction.segreg = legacyDecoder.CS;
                    break;
                case 0x36:
                    instruction.segreg = legacyDecoder.SS;
                    break;
                case 0x3E:
                    instruction.segreg = legacyDecoder.DS;
                    break;
                case 0x64:
                    instruction.segreg = legacyDecoder.FS;
                    break;
                case 0x65:
                    instruction.segreg = legacyDecoder.GS;
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
                    break getPrefixes;
                }
            }

            opcodeData = decoder.opcodeMap[byt];

            // Decode any operands
            opcodeData.decodeFor(instruction, decoderState);

            instruction.length = decoderState.offset - offset;
            instruction.opcodeData = opcodeData;

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
                cr4: legacyDecoder.CR4
            };
        },

        init: function () {
            function read(decoderState, size) {
                var result;

                if (size === 1) {
                    result = decoderState.view.getUint8(decoderState.offset);
                } else if (size === 2) {
                    result = decoderState.view.getUint16(decoderState.offset, true);
                } else if (size === 4) {
                    result = decoderState.view.getUint32(decoderState.offset, true);
                }

                decoderState.offset += size;

                return result;
            }

            function readDisplacement(operand, size, decoderState) {
                // Use of a displacement implies a memory pointer
                operand.isPointer = true;

                operand.displacement = read(decoderState, size);
                operand.displacementSize = size;
            }

            var decoder = this,
                legacyDecoder = decoder.legacyDecoder,
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

                                operand.scale = scale;
                                operand.reg = legacyDecoder.hsh_size_regOrdinals[ addressSize ][ index ];
                                operand.reg2 = legacyDecoder.hsh_size_regOrdinals[ addressSize ][ base ];

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
                        var modRM = decoderState.view.getUint8(decoderState.offset++);

                        instruction.modRM = {
                            mod: modRM >>> 6,          // Mod field is first 2 bits
                            nnn: (modRM >>> 3) & 0x07, // Reg field is second 3 bits (Reg 2)
                            rm: modRM & 0x07           // Register/Memory field is last 3 bits (Reg 1)
                        };
                    },
                    "opcodeExtension": function (instruction) {
                        throw "Unsupported. Will only be called when we know opcode extension is needed.";
                    },
                    "read": read,
                    "decodeDisplacement": function (operand, decoderState) {
                        readDisplacement(operand, operand.addressSize, decoderState);
                    },
                    "useDSSI": function (operand) {
                        operand.reg = operand.addressSize === 4 ? registers.esi : registers.si;
                    },
                    "useESDI": function (operand) {
                        operand.segreg = registers.es;
                        operand.reg = operand.addressSize === 4 ? registers.edi : registers.di;
                    }
                },
                registers,
                usesOpcodeExtensionInNNN = {
                    // Immediate Grp 1 (1A)
                    0x80: true,
                    0x81: true,
                    0x82: true,
                    0x83: true

                    // FIXME
                };

            decoder.opcodeMap = opcodeMap;
            decoder.partials = partials;

            registers = decoder.getRegisters();

            decoder.emit("pre init", {
                partials: partials
            });

            // Translate legacy decoder table into faster version
            util.each(LegacyDecoder.arr_mapOpcodes, function (data, opcode) {
                var hasModRM = LegacyDecoder.opcodeHasModRM32[opcode],
                    opcodeData = {
                        "MASKS": MASKS,
                        "legacyDecoder": legacyDecoder,
                        "name": data[0],
                        "partials": partials,
                        "registers": registers
                    },
                    parts = [];

                if (hasModRM) {
                    parts.push("this.partials.getModRM(instruction, decoderState);");
                }

                // Handle opcode extensions (with NNN field of ModR/M)
                if (usesOpcodeExtensionInNNN[opcode]) {
                    parts.push("this.partials.opcodeExtension(instruction);");
                }

                // Loop through the operands for this instruction
                util.each(data[1], function (attributes, index) {
                    /*jshint bitwise: false, multistr: true */

                    var addrMethodCode,
                        addrMethod,
                        highImmediateExpression = "0",
                        highImmediateSizeExpression = "0",
                        immediateExpression = "0",
                        immediateSizeExpression = "0",
                        isPointerExpression = "false",
                        isRelativeJumpExpression = "false",
                        operandMaskExpression = "instruction.operandSizeAttr ? " + MASKS[4] + " : " + MASKS[2],
                        operandSizeExpression = "instruction.operandSizeAttr ? 4 : 2",
                        operandParts = [],
                        register1Expression = "null",
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
                            operandSizeExpression = "this.operand" + (index + 1) + "SizeLookup[instruction.operandSizeAttr & 1]";
                            operandMaskExpression = "this.MASKS[this.operand" + (index + 1) + "SizeLookup[instruction.operandSizeAttr & 1]]";

                            // AddressingMethod stored in high byte (for speed we leave the AddressingMethod shifted
                            //  left by 8 bits, so that we do not need to shift right here before doing a table lookup)
                            //  TODO: This is confusing - why not just "= attrs >>> 8" with
                            //      opcode_data.js: hsh[C] = "CONTROL" -> hsh[C >>> 8] = "CONTROL" ?
                            //  (test whether ">>>" is faster than "&")
                            addrMethodCode = attributes & 0xFF00;
                            /* ============ Determine addressing method from AddressMethodCode ============ */
                            // Operand addresses a register to be decoded using ModR/M Reg field
                            addrMethod = LegacyDecoder.hsh_addrmethodRegister[addrMethodCode];

                            if (addrMethod !== undefined) {
                                typeExpression = "'" + addrMethod + "'";

                                // Segment register
                                if (addrMethod === "SEGMENT") {
                                    register1Expression = "this.legacyDecoder.hsh_regOrdinals_Segment[instruction.modRM.nnn]";
                                } else if (addrMethod === "CONTROL") {
                                    register1Expression = "this.legacyDecoder.hsh_regOrdinals_Control[instruction.modRM.nnn]";
                                } else {
                                    register1Expression = "this.legacyDecoder.hsh_size_regOrdinals[" + operandSizeExpression + "][instruction.modRM.nnn]";
                                }
                            // Use a fast switch to decide how to proceed
                            } else {
                                switch (addrMethodCode) {
                                // No ModR/M byte used, Immediate data to be read
                                case 0x0100: //"A":
                                // Immediate data to be read
                                case 0x0900: //"I":
                                    // 48-bit or 64-bit: split into 2 dwords
                                    /*if (size > 4) {
                                        immediateExpression = "this.partials.read(decoderState, 4)"
                                        immediateSizeExpression = "4";
                                        highImmediateExpression = "this.partials.read(decoderState, (" + operandSizeExpression + ") - 4)";
                                        highImmediateSizeExpression = "(" + operandSizeExpression + ") - 4";
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
                                    }*/
                                    immediateExpression = "this.partials.read(decoderState, " + operandSizeExpression + ")";
                                    immediateSizeExpression = operandSizeExpression;
                                    break;
                                // Instruction contains relative offset, to be added to EIP
                                case 0x0A00: //"J":
                                    immediateExpression = "this.partials.read(decoderState, " + operandSizeExpression + ")";
                                    immediateSizeExpression = operandSizeExpression;

                                    isRelativeJumpExpression = "true";
                                    break;
                                // No ModR/M byte, offset coded as word or dword
                                //  (dep. on operand-size attr)
                                case 0x0F00: //"O":
                                    operandParts.push("this.partials.decodeDisplacement(instruction.operand" + (index + 1) + ", decoderState);");
                                    break;
                                case 0x0500: //"E": // ModR/M byte follows opcode, specifies operand (either general register or memory address)
                                case 0x0D00: //"M": // ModR/M byte may only refer to memory
                                case 0x1200: //"R": // ModR/M byte may only refer to general purpose reg (mod = general register)
                                    operandParts.push("this.partials.decodeModRM(instruction, instruction.operand" + (index + 1) + ", decoderState);");
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
                                    typeExpression = "'GENERAL'";
                                    // DS may be overridden for string operations...
                                    //  (set as default)
                                    operandParts.push("this.partials.useDSSI(instruction.operand" + (index + 1) + ");");
                                    isPointerExpression = "true";
                                    break;
                                // Memory, addressed by ES:DI register pair
                                case 0x1900: //"Y":
                                    typeExpression = "'GENERAL'";
                                    // ... but ES may not
                                    operandParts.push("this.partials.useESDI(instruction.operand" + (index + 1) + ");");
                                    isPointerExpression = "true";
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
                            immediateExpression = attributes & 0x00ff;
                            immediateSizeExpression = "1";
                            operandSizeExpression = "1";
                            operandMaskExpression = "0xff";
                        }
                    // Flag indicates a general purpose register (eg. AX, AH, AL)
                    //  or segment register (eg. CS, DS, SS)
                    } else {
                        // 32-bit, depending on operand-size attribute
                        if (attributes.length === 3) {
                            register1Expression = operandSizeExpression + " === 4 ? this.registers." + attributes.toLowerCase() + " : this.registers." + attributes.toLowerCase().substr(1);
                        } else {
                            register1Expression = "this.registers." + attributes.toLowerCase();
                        }

                        operandMaskExpression = "this.MASKS[" + register1Expression + ".size]";
                        typeExpression = "'GENERAL'";
                    }

                    parts.push("instruction.operand" + (index + 1) + " = {\
    // Instruction this Operand belongs to\n\
    insn: instruction,\n\
    // Offset (in bytes) of this Operand in memory\n\
    offset: decoderState.offset,\n\
\n\
    addressSize: instruction.addressSizeAttr ? 4 : 2,\n\
    addressMask: instruction.addressSizeAttr ? 0xffffffff : 0xffff,\n\
    size: " + operandSizeExpression + ", // May change further down\n\
    mask: " + operandMaskExpression + ",\n\
\n\
    // Scale, Index & Base registers used (if applicable)\n\
    scale: 1,\n\
    reg: " + register1Expression + ",\n\
    reg2: null,\n\
\n\
    // Usually will be null, meaning use instruction's segreg,\n\
    //  but some (eg. string) operations may need ES: for operand 2\n\
    segreg: instruction.segreg,\n\
\n\
    // Immediate/scalar number value of operand (if applicable) -\n\
    //  NOT for storing memory addresses (use displacement for that)\n\
    //  (Mutex'd with .displacement)\n\
    immed: " + immediateExpression + ",\n\
    immedSize: " + immediateSizeExpression + ",\n\
    highImmed: " + highImmediateExpression + ",\n\
    highImmedSize: " + highImmediateSizeExpression + ",\n\
\n\
    // Displacement / operand's Memory Pointer address in bytes (if applicable)\n\
    //  (Mutex'd with .immed)\n\
    displacement: 0,\n\
    displacementSize: 0,\n\
    // Type of operand's value (Immediate data, General register, MMX register etc.)\n\
    type: " + typeExpression + ",\n\
    // Whether operand represents a memory pointer\n\
    isPointer: " + isPointerExpression + ",\n\
\n\
    isRelativeJump: " + isRelativeJumpExpression + "\n\
};");

                    [].push.apply(parts, operandParts);

                    decoder.emit("init operand", {
                        addSet: function (propertyName, expression) {
                            parts.push("instruction.operand" + (index + 1) + "." + propertyName + " = " + expression + ";");
                        }
                    });
                });

                util.extend(opcodeData, {
                    /*jshint evil: true */
                    decodeFor: new Function("instruction, decoderState", parts.join("\n"))
                });

                opcodeMap[opcode] = opcodeData;
            });

            decoder.emit("post init", {
                opcodeMap: opcodeMap
            });
        }
    });

    return Decoder;
});
