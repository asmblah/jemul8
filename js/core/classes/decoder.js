/*
 *  jemul8 - JavaScript x86 Emulator
 *  Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *
 * MODULE: Decoder class
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
    "../util"
    , "./decoder/register"
    , "./decoder/segreg"
], function (util, Register, SegRegister) {
    "use strict";

    // Decoder class constructor
    function Decoder(regs) {
        var d = this; // For shortening lookup tables below

        // Optionally specify registers to override defaults
        if (regs) {
            util.extend(this, regs);
        }

        /* ==== Ordinal lookups ==== */
        // Indexes in array correspond with ModR/M Reg field
        d.hsh_regOrdinals_Byte = [
            d.AL, d.CL, d.DL, d.BL
            , d.AH, d.CH, d.DH, d.BH
        ];
        d.hsh_regOrdinals_Word = [
            d.AX, d.CX, d.DX, d.BX
            , d.SP, d.BP
            , d.SI, d.DI
        ];
        d.hsh_regOrdinals_Dword = [
            d.EAX, d.ECX, d.EDX, d.EBX
            , d.ESP, d.EBP
            , d.ESI, d.EDI
        ];
        d.hsh_size_regOrdinals = {
            1: d.hsh_regOrdinals_Byte
            , 2: d.hsh_regOrdinals_Word
            , 4: d.hsh_regOrdinals_Dword
        };

        d.hsh_regOrdinals_Segment = [
            d.ES, d.CS, d.SS
            , d.DS, d.FS, d.GS
        ];
        d.hsh_regOrdinals_Control = [
            d.CR0, d.CR1, d.CR2, d.CR3, d.CR4
        ];
        d.hsh_regOrdinals_Segment_Mod00RM16 = [
            d.DS, d.DS, d.SS, d.SS
            , d.DS, d.DS, d.DS, d.DS
        ];
        d.hsh_regOrdinals_Segment_Mod01or10RM16 = [
            d.DS, d.DS, d.SS, d.SS
            , d.DS, d.DS, d.SS, d.DS
        ];
        d.segreg_mod1or2_base32 = [
            d.DS, d.DS, d.DS, d.DS
            , d.SS, d.SS, d.DS, d.DS
        ];
        d.hsh_regOrdinals_Base = [
            d.BX, d.BX, d.BP, d.BP
            , d.SI, d.DI, d.BP, d.BX
        ];
        d.hsh_regOrdinals_Index = [
            d.SI, d.DI, d.SI, d.DI
            , null, null, null, null
        ];
        /* ==== /Ordinal lookups ==== */
    }
    // Minimal x86 registers to use for decoding by default
    util.extend(Decoder.prototype, {
        ES: new SegRegister("ES")
        , CS: new SegRegister("CS")
        , SS: new SegRegister("SS")
        , DS: new SegRegister("DS")
        , FS: new SegRegister("FS")
        , GS: new SegRegister("GS")

        , AL: new Register("AL", 1), AH: new Register("AH", 1)
        , CL: new Register("CL", 1), CH: new Register("CH", 1)
        , DL: new Register("DL", 1), DH: new Register("DH", 1)
        , BL: new Register("BL", 1), BH: new Register("BH", 1)

        , AX: new Register("AX", 2)
        , CX: new Register("CX", 2)
        , DX: new Register("DX", 2)
        , BX: new Register("BX", 2)
        , SP: new Register("SP", 2)
        , BP: new Register("BP", 2)
        , SI: new Register("SI", 2)
        , DI: new Register("DI", 2)

        , EAX: new Register("EAX", 4)
        , ECX: new Register("ECX", 4)
        , EDX: new Register("EDX", 4)
        , EBX: new Register("EBX", 4)
        , ESP: new Register("ESP", 4)
        , EBP: new Register("EBP", 4)
        , ESI: new Register("ESI", 4)
        , EDI: new Register("EDI", 4)

        , CR0: new Register("CR0", 4)
        , CR1: new Register("CR1", 4)
        , CR2: new Register("CR2", 4)
        , CR3: new Register("CR3", 4)
        , CR4: new Register("CR4", 4)
    });

    // NB: all pre-shifted left by 8 bits for simple ORing together
    //  with Operand Types
    var A = 0x0100
        , C = 0x0300
        , D = 0x0400
        , E = 0x0500
        , F = 0x0600
        , G = 0x0700
        , I = 0x0900
        , J = 0x0A00
        , M = 0x0D00
        , N = 0x0E00
        , O = 0x0F00
        , P = 0x1000
        , Q = 0x1100
        , R = 0x1200
        , S = 0x1300
        , T = 0x1400
        , V = 0x1600
        , W = 0x1700
        , X = 0x1800
        , Y = 0x1900
        , Z = 0x1A00
    // Ext; CO used to indicate a constant value in table
        , CO = 0x1B00

    // Operand Types
        , a = 0x01
        , b = 0x02
        , c = 0x03
        , d = 0x04
        , dq = 0x05
        , p = 0x06
        , pi = 0x07
        , ps = 0x08
        , q = 0x09
        , s = 0x0A
        , ss = 0x0B
        , si = 0x0C
        , v = 0x0D
        , w = 0x0E;

    /* ========== Opcode tables ========== */
    // Format: [ <opcode_mnemonic>, <operands> ]
    //  NB: this could be an array, if all elements were unrem'd;
    //  an object should use less memory (Arrays are derived from Object anyway)
    //  - needs further testing.
    Decoder.arr_mapOpcodes = {
        // 0x00
        0x00: ["ADD", [E|b,G|b]],       0x01: ["ADD", [E|v,G|v]],           0x02: ["ADD", [G|b,E|b]],       0x03: ["ADD", [G|v,E|v]],
        0x04: ["ADD", ["AL",I|b]],      0x05: ["ADD", ["eAX",I|v]],         0x06: ["PUSH",["ES"]],          0x07: ["POP",["ES"]],
        0x08: ["OR", [E|b,G|b]],        0x09: ["OR", [E|v,G|v]],            0x0A: ["OR", [G|b,E|b]],        0x0B: ["OR", [G|v,E|v]],
        0x0C: ["OR", ["AL",I|b]],       0x0D: ["OR", ["eAX",I|v]],          0x0E: ["PUSH",["CS"]],          0x0F: ["#ESCAPE"], // 2-byte escape (refer to 2-byte opcode map)
        // 0x01
        0x10: ["ADC", [E|b,G|b]],       0x11: ["ADC", [E|v,G|v]],           0x12: ["ADC", [G|b,E|b]],       0x13: ["ADC", [G|v,E|v]],
        0x14: ["ADC", ["AL",I|b]],      0x15: ["ADC", ["eAX",I|v]],         0x16: ["PUSH",["SS"]],          0x17: ["POP",["SS"]],
        0x18: ["SBB", [E|b,G|b]],       0x19: ["SBB", [E|v,G|v]],           0x1A: ["SBB", [G|b,E|b]],       0x1B: ["SBB", [G|v,E|v]],
        0x1C: ["SBB", ["AL",I|b]],      0x1D: ["SBB", ["eAX",I|v]],         0x1E: ["PUSH",["DS"]],          0x1F: ["POP",["DS"]],
        // 0x02
        0x20: ["AND", [E|b,G|b]],       0x21: ["AND", [E|v,G|v]],           0x22: ["AND", [G|b,E|b]],       0x23: ["AND", [G|v,E|v]],
        0x24: ["AND", ["AL",I|b]],      0x25: ["AND", ["eAX",I|v]],              /* #SEG=ES */              0x27: ["DAA"],
        0x28: ["SUB", [E|b,G|b]],       0x29: ["SUB", [E|v,G|v]],           0x2A: ["SUB", [G|b,E|b]],       0x2B: ["SUB", [G|v,E|v]],
        0x2C: ["SUB", ["AL",I|b]],      0x2D: ["SUB", ["eAX",I|v]],              /* #SEG=CS */              0x2F: ["DAS"],
        // 0x03
        0x30: ["XOR", [E|b,G|b]],       0x31: ["XOR", [E|v,G|v]],           0x32: ["XOR", [G|b,E|b]],       0x33: ["XOR", [G|v,E|v]],   // NB: ([33F6 XOR SI, SI] decoded incorrectly - Intel docs say Gb,Ev - typo?)
        0x34: ["XOR", ["AL",I|b]],      0x35: ["XOR", ["eAX",I|v]],              /* #SEG=SS */              0x37: ["AAA"],
        0x38: ["CMP", [E|b,G|b]],       0x39: ["CMP", [E|v,G|v]],           0x3A: ["CMP", [G|b,E|b]],       0x3B: ["CMP", [G|v,E|v]],
        0x3C: ["CMP", ["AL",I|b]],      0x3D: ["CMP", ["eAX",I|v]],              /* #SEG=DS */               0x3F: ["AAS"],
        // 0x04
        0x40: ["INC", ["eAX"]],         0x41: ["INC", ["eCX"]],             0x42: ["INC", ["eDX"]],         0x43: ["INC", ["eBX"]],
        0x44: ["INC", ["eSP"]],         0x45: ["INC", ["eBP"]],             0x46: ["INC", ["eSI"]],         0x47: ["INC", ["eDI"]],
        0x48: ["DEC", ["eAX"]],         0x49: ["DEC", ["eCX"]],             0x4A: ["DEC", ["eDX"]],         0x4B: ["DEC", ["eBX"]],
        0x4C: ["DEC", ["eSP"]],         0x4D: ["DEC", ["eBP"]],             0x4E: ["DEC", ["eSI"]],         0x4F: ["DEC", ["eDI"]],
        // 0x05
        0x50: ["PUSH", ["eAX"]],        0x51: ["PUSH", ["eCX"]],            0x52: ["PUSH", ["eDX"]],        0x53: ["PUSH", ["eBX"]],
        0x54: ["PUSH", ["eSP"]],        0x55: ["PUSH", ["eBP"]],            0x56: ["PUSH", ["eSI"]],        0x57: ["PUSH", ["eDI"]],
        0x58: ["POP", ["eAX"]],         0x59: ["POP", ["eCX"]],             0x5A: ["POP", ["eDX"]],         0x5B: ["POP", ["eBX"]],
        0x5C: ["POP", ["eSP"]],         0x5D: ["POP", ["eBP"]],             0x5E: ["POP", ["eSI"]],         0x5F: ["POP", ["eDI"]],
        // 0x06
        0x60: ["PUSHA"],                0x61: ["POPA"],                     0x62: ["BOUND", [G|v,M|a]],     0x63: ["ARPL", [E|w,G|w]],
             /* #SEG=FS" */                  /* #SEG=GS */                       /* #OP_SIZE */                  /* #ADDR_SIZE */
        0x68: ["PUSH",[I|v]],           0x69: ["IMUL", [G|v,E|v,I|v]],      0x6A: ["PUSH", [I|b]],          0x6B: ["IMUL", [G|v,E|v,I|b]],
        0x6C: ["INS", [Y|b,"DX"]],      0x6D: ["INS", [Y|v,"DX"]],          0x6E: ["OUTS", ["DX",X|b]],     0x6F: ["OUTS", ["DX",X|v]],
        // 0x07
        0x70: ["JO", [I|b]],            0x71: ["JNO", [I|b]],               0x72: ["JB", [I|b]],            0x73: ["JNB", [I|b]],
        0x74: ["JE", [I|b]],            0x75: ["JNE", [I|b]],               0x76: ["JBE", [I|b]],           0x77: ["JNBE", [I|b]],
        0x78: ["JS", [I|b]],            0x79: ["JNS", [I|b]],               0x7A: ["JP", [I|b]],            0x7B: ["JNP", [I|b]],
        0x7C: ["JL", [I|b]],            0x7D: ["JNL", [I|b]],               0x7E: ["JLE", [I|b]],           0x7F: ["JNLE", [I|b]],
        // 0x08
            // Immediate Group 1 (1A)
             /* #EXT_1 [E|b,I|b]                #EXT_1 [E|v,I|v]                    #EXT_1 [E|v,I|b]                #EXT_1 [E|v,I|b] */
        0x84: ["TEST", [E|b,G|b]],      0x85: ["TEST", [E|v,G|v]],          0x86: ["XCHG", [E|b,G|b]],      0x87: ["XCHG", [E|v,G|v]],
        0x88: ["MOV", [E|b,G|b]],       0x89: ["MOV", [E|v,G|v]],           0x8A: ["MOV", [G|b,E|b]],       0x8B: ["MOV", [G|v,E|v]],
        0x8C: ["MOV", [E|w,S|w]],       0x8D: ["LEA", [G|v,M|v]],           0x8E: ["MOV", [S|w,E|w]],       0x8F: ["POP",[E|v]],
        // 0x09
        0x90: ["NOP"],                  0x91: ["XCHG", ["eCX","eAX"]],      0x92: ["XCHG", ["eDX","eAX"]],  0x93: ["XCHG", ["eBX","eAX"]],
        0x94: ["XCHG", ["eSP","eAX"]],  0x95: ["XCHG", ["eBP","eAX"]],      0x96: ["XCHG", ["eSI","eAX"]],  0x97: ["XCHG", ["eDI","eAX"]],
        0x98: ["CBW"],                  0x99: ["CWD"],                      0x9A: ["CALLF",[A|p]],          0x9B: ["WAIT"],
        0x9C: ["PUSHF"],                0x9D: ["POPF"],                     0x9E: ["SAHF"],                 0x9F: ["LAHF"],
        // 0x0A
        0xA0: ["MOV", ["AL",O|b]],      0xA1: ["MOV", ["eAX",O|v]],         0xA2: ["MOV", [O|b,"AL"]],      0xA3: ["MOV", [O|v,"eAX"]],
        0xA4: ["MOVS", [X|b,Y|b]],      0xA5: ["MOVS", [X|v,Y|v]],          0xA6: ["CMPS", [X|b,Y|b]],      0xA7: ["CMPS", [X|v,Y|v]],
        0xA8: ["TEST", ["AL",I|b]],     0xA9: ["TEST", ["eAX",I|v]],        0xAA: ["STOS", [Y|b,"AL"]],     0xAB: ["STOS", [Y|v,"eAX"]],
        0xAC: ["LODS", ["AL",X|b]],     0xAD: ["LODS", ["eAX",X|v]],        0xAE: ["SCAS", ["AL",Y|b]],     0xAF: ["SCAS", ["eAX",X|v]],
        // 0x0B
        0xB0: ["MOV", ["AL",I|b]],      0xB1: ["MOV", ["CL",I|b]],          0xB2: ["MOV", ["DL",I|b]],      0xB3: ["MOV", ["BL",I|b]],
        0xB4: ["MOV", ["AH",I|b]],      0xB5: ["MOV", ["CH",I|b]],          0xB6: ["MOV", ["DH",I|b]],      0xB7: ["MOV", ["BH",I|b]],
        0xB8: ["MOV", ["eAX",I|v]],     0xB9: ["MOV", ["eCX",I|v]],         0xBA: ["MOV", ["eDX",I|v]],     0xBB: ["MOV", ["eBX",I|v]],
        0xBC: ["MOV", ["eSP",I|v]],     0xBD: ["MOV", ["eBP",I|v]],         0xBE: ["MOV", ["eSI",I|v]],     0xBF: ["MOV", ["eDI",I|v]],
        // 0x0C
            // Shift Group 2 (1A)
             /* #EXT_2 [E|b,I|b]                #EXT_2 [E|v,I|b] */         0xC2: ["RETN_P",[I|w]],         0xC3: ["RETN"],
        0xC4: ["LES", [G|v,M|p]],       0xC5: ["LDS", [G|v,M|p]],                /* #EXT_11 [E|b,I|b]               #EXT_11 [E|v,I|v] */ // Group 11 (1A) - MOV
        0xC8: ["ENTER", [I|w,I|b]],     0xC9: ["LEAVE"],                    0xCA: ["RETF_P",[I|w]],         0xCB: ["RETF"],
        0xCC: ["INT", [CO|3]],          0xCD: ["INT", [I|b]],               0xCE: ["INTO"],                 0xCF: ["IRET"],
        // 0x0D
            // Shift Group 2 (1A)
        /*      #EXT_2 [E|b,"1"]                #EXT_2 [E|v,"1"]                    #EXT_2 [E|b,"CL"]               #EXT_2 [E|v,"CL"] */
        0xD4: ["AAM", [I|b]],           0xD5: ["AAD", [I|b]],               0xD6: ["#RESERVED"],            0xD7: ["XLAT"],
            // ESC (Escape to coprocessor instruction set)
        0xD8: ["#RESERVED"],            0xD9: ["#RESERVED"],                0xDA: ["#RESERVED"],            0xDB: ["#RESERVED"],
        0xDC: ["#RESERVED"],            0xDD: ["#RESERVED"],                0xDE: ["#RESERVED"],            0xDF: ["#RESERVED"],
        // 0x0E
        0xE0: ["LOOPNE", [J|b]],        0xE1: ["LOOPE",[J|b]],              0xE2: ["LOOP",[J|b]],           0xE3: ["JCXZ",[J|b]],
        0xE4: ["IN", ["AL",I|b]],       0xE5: ["IN", ["eAX",I|b]],          0xE6: ["OUT", [I|b,"AL"]],      0xE7: ["OUT", [I|b,"eAX"]],
        0xE8: ["CALLN", [J|v]],         0xE9: ["JMPN",[J|v]],               0xEA: ["JMPF", [A|p]],          0xEB: ["JMPS",[J|b]],
        0xEC: ["IN", ["AL","DX"]],      0xED: ["IN", ["eAX","DX"]],         0xEE: ["OUT", ["DX","AL"]],     0xEF: ["OUT", ["DX","eAX"]],
        // 0x0F
             /* #LOCK"] */              0xF1: ["#RESERVED"],                     /* #REPNE                          #REP */
        0xF4: ["HLT"],                  0xF5: ["CMC"],                           /* #EXT_3 [E|b, 0]                 #EXT_3 [E|v, 1] */
        0xF8: ["CLC"],                  0xF9: ["STC"],                      0xFA: ["CLI"],                  0xFB: ["STI"],
        0xFC: ["CLD"],                  0xFD: ["STD"],                           /* #EXT_4                          #EXT_5 */

        /*
         * 2-byte Intel opcodes have 0Fh as the first byte:
         */

        // 0x00
              /* #EXT_6                          #EXT_7 */                  0x102: ["LAR", [G|v,E|w]],      0x103: ["LSL", [G|v, E|w]],
        0x104: ["#RESERVED"],           0x105: ["#RESERVED"],               0x106: ["CLTS"],                0x107: ["#RESERVED"],
        0x108: ["INVD"],                0x109: ["WBINVD"],                  0x10A: ["#RESERVED"],           0x10B: ["#ILLEGAL"],
        0x10C: ["#RESERVED"],           0x10D: ["#RESERVED"],               0x10E: ["#RESERVED"],           0x10F: ["#RESERVED"],

        // 0x101
        0x110: ["movups", [V|ps,W|ps]], 0x111: ["movups", [W|ps, V|ps]],    0x112: ["movlps", [W|q,V|q]],   0x113: ["movlps", [V|q,W|q]],
        0x114: ["unpcklps", [V|ps,W|q]],0x115: ["unpckhps", [V|ps,W|q]],    0x116: ["movhps", [V|q,W|q]],   0x117: ["movhps", [W|q,V|q]],
        0x118: ["#EXT_16"],             0x119: ["#RESERVED"],               0x11A: ["#RESERVED"],           0x11B: ["#RESERVED"],
        0x11C: ["#RESERVED"],           0x11D: ["#RESERVED"],               0x11E: ["#RESERVED"],           0x11F: ["#RESERVED"],

        // 0x102
        0x120: ["MOV", [R|d,C|d]],      0x121: ["MOV", [R|d,D|d]],          0x122: ["MOV", [C|d,R|d]],      0x123: ["MOV", [D|d,R|d]],
        0x124: ["#RESERVED"],           0x125: ["#RESERVED"],               0x126: ["#RESERVED"],           0x127: ["#RESERVED"],
        0x128: ["movaps", [V|ps,W|ps]], 0x129: ["movaps", [W|ps,V|ps]],     0x12A: ["cvtpl2ps", [V|ps,Q|q]],0x12B: ["movntps", [W|ps,V|ps]],
        0x12C: ["cvttps2pl", [Q|q,W|ps]],0x12D: ["cvtps2pl", [Q|q, W|ps]],  0x12E: ["ucomiss", [V|ss,W|ss]],0x12F: ["comiss", [V|ps,W|ps]],

        // 0x103
        0x130: ["WRMSR"],               0x131: ["RDTSC"],                   0x132: ["RDMSR"],               0x133: ["RDPMC"],
        0x134: ["SYSENTER"],            0x135: ["SYSEXIT"],                 0x136: ["#RESERVED"],           0x137: ["#RESERVED"],
        0x138: ["#RESERVED"],           0x139: ["#RESERVED"],               0x13A: ["#RESERVED"],           0x13B: ["#RESERVED"],
        0x13C: ["#RESERVED"],           0x13D: ["#RESERVED"],               0x13E: ["#RESERVED"],           0x13F: ["#RESERVED"],

        // 0x104
        0x140: ["CMOVO", [G|v,E|v]],    0x141: ["CMOVNO", [G|v,E|v]],       0x142: ["CMOVB", [G|v,E|v]],    0x143: ["CMOVNB", [G|v,E|v]],
        0x144: ["CMOVE", [G|v,E|v]],    0x145: ["CMOVNE", [G|v,E|v]],       0x146: ["CMOVBE", [G|v,E|v]],   0x147: ["CMOVNBE", [G|v,E|v]],
        0x148: ["CMOVS", [G|v,E|v]],    0x149: ["CMOVNS", [G|v,E|v]],       0x14A: ["CMOVP", [G|v,E|v]],    0x14B: ["CMOVNP", [G|v,E|v]],
        0x14C: ["CMOVL", [G|v,E|v]],    0x14D: ["CMOVNL", [G|v,E|v]],       0x14E: ["CMOVLE", [G|v,E|v]],   0x14F: ["CMOVNLE", [G|v,E|v]],

        // 0x105
        0x150: ["movmskps", [E|d,V|ps]],0x151: ["sqrtps", [V|ps,W|ps]],     0x152: ["rsqrtps", [V|ps,W|ps]],0x153: ["rcpps", [V|ps,W|ps]],
        0x154: ["andps", [V|ps,W|ps]],  0x155: ["andnps", [V|ps,W|ps]],     0x156: ["orps", [V|ps,W|ps]],   0x157: ["xorps", [V|ps,W|ps]],
        0x158: ["???", [G|v,E|v]],      0x159: ["???", [G|v,E|v]],          0x15A: ["???", [G|v,E|v]],      0x15B: ["???", [G|v,E|v]],
        0x15C: ["???", [G|v,E|v]],      0x15D: ["???", [G|v,E|v]],          0x15E: ["???", [G|v,E|v]],      0x15F: ["???", [G|v,E|v]],

        /** ===== GAP - TODO here!! ===== **/

        // 0x180
        0x180: ["JO", [J|v]],           0x181: ["JNO", [J|v]],              0x182: ["JB", [J|v]],           0x183: ["JNB", [J|v]],
        0x184: ["JE", [J|v]],           0x185: ["JNE", [J|v]],              0x186: ["JBE", [J|v]],          0x187: ["JNBE", [J|v]],
        0x188: ["JS", [J|v]],           0x189: ["JNS", [J|v]],              0x18A: ["JP", [J|v]],           0x18B: ["JNP", [J|v]],
        0x18C: ["JL", [J|v]],           0x18D: ["JNL", [J|v]],              0x18E: ["JLE", [J|v]],          0x18F: ["JNLE", [J|v]],

        /** ===== GAP - TODO here!! ===== **/

        // 0x0F 0xA0 -> 0x0F 0xAF
        0x1A0: ["PUSH", ["FS"]],        0x1A1: ["POP", ["FS"]],             0x1A2: ["CPUID"],               0x1A3: ["BT", [E|v,G|v]],
        0x1A4: ["SHLD", [E|v,G|v,I|b]], 0x1A5: ["SHLD", [E|v,G|v,"CL"]],    0x1A6: ["???"],                 0x1A7: ["???"],
        0x1A8: ["PUSH", ["GS"]],        0x1A9: ["POP", ["GS"]],             0x1AA: ["RSM"],                 0x1AB: ["BTS", [E|v,G|v]],
        0x1AC: ["SHRD", [E|v,G|v,I|b]], 0x1AD: ["SHRD", [E|v,G|v,"CL"]],    0x1AE: "#Grp15",                0x1AF: ["IMUL", [G|v,E|v]],

        // 0x0F 0xB0 -> 0x0F 0xBF
        0x1B0: ["CMPXCHG", [E|b,G|b]],  0x1B1: ["CMPXCHG", [E|v,G|v]],      0x1B2: ["LSS", [M|p]],          0x1B3: ["BTR", [E|v,G|v]],
        0x1B4: ["LFS", [G|v,M|p]],      0x1B5: ["LGS", [G|v,M|p]],          0x1B6: ["MOVZX", [G|v,E|b]],    0x1B7: ["MOVZX", [G|v,E|w]],
        0x1B8: ["???", [G|v,E|v]],      0x1B9: ["???", [G|v,E|v]],          0x1BA: ["???", [E|v,I|b]],      0x1BB: ["BTC", [E|v,G|v]],
        0x1BC: ["BSF", [G|v,E|v]],      0x1BD: ["BSR", [G|v,E|v]],          0x1BE: ["MOVSX", [G|v,E|b]],    0x1BF: ["MOVSX", [G|v,E|w]]
    };
    Decoder.arr_mapOpcodeExtensions = hsh = {};
    /* ====== Ext. group 1 - Immediate Grp 1 (1A) ====== */
    base = 0x80 << 3;
    hsh[base | 0x00] = ["ADD", [E|b, I|b]]; hsh[base | 0x01] = ["OR", [E|b, I|b]];  hsh[base | 0x02] = ["ADC", [E|b, I|b]];
    hsh[base | 0x03] = ["SBB", [E|b, I|b]]; hsh[base | 0x04] = ["AND", [E|b, I|b]]; hsh[base | 0x05] = ["SUB", [E|b, I|b]];
    hsh[base | 0x06] = ["XOR", [E|b, I|b]]; hsh[base | 0x07] = ["CMP", [E|b, I|b]];
    base = 0x81 << 3;
    hsh[base | 0x00] = ["ADD", [E|v, I|v]]; hsh[base | 0x01] = ["OR", [E|v, I|v]];  hsh[base | 0x02] = ["ADC", [E|v, I|v]];
    hsh[base | 0x03] = ["SBB", [E|v, I|v]]; hsh[base | 0x04] = ["AND", [E|v, I|v]]; hsh[base | 0x05] = ["SUB", [E|v, I|v]];
    hsh[base | 0x06] = ["XOR", [E|v, I|v]]; hsh[base | 0x07] = ["CMP", [E|v, I|v]];
    base = 0x82 << 3;
    hsh[base | 0x00] = ["ADD", [E|v, I|b]]; hsh[base | 0x01] = ["OR", [E|v, I|b]];  hsh[base | 0x02] = ["ADC", [E|v, I|b]];
    hsh[base | 0x03] = ["SBB", [E|v, I|b]]; hsh[base | 0x04] = ["AND", [E|v, I|b]]; hsh[base | 0x05] = ["SUB", [E|v, I|b]];
    hsh[base | 0x06] = ["XOR", [E|v, I|b]]; hsh[base | 0x07] = ["CMP", [E|v, I|b]];
    base = 0x83 << 3;
    hsh[base | 0x00] = ["ADD", [E|v, I|b]]; hsh[base | 0x01] = ["OR", [E|v, I|b]];  hsh[base | 0x02] = ["ADC", [E|v, I|b]];
    hsh[base | 0x03] = ["SBB", [E|v, I|b]]; hsh[base | 0x04] = ["AND", [E|v, I|b]]; hsh[base | 0x05] = ["SUB", [E|v, I|b]];
    hsh[base | 0x06] = ["XOR", [E|v, I|b]]; hsh[base | 0x07] = ["CMP", [E|v, I|b]];
    /* ====== /Ext. group 1 - Immediate Grp 1 (1A) ====== */
    /* ====== Ext. group 2 - Shift Grp 2 (1A) ====== */
    base = 0xC0 << 3;
    hsh[base | 0x00] = ["ROL", [E|b, I|b]]; hsh[base | 0x01] = ["ROR", [E|b, I|b]]; hsh[base | 0x02] = ["RCL", [E|b, I|b]];
    hsh[base | 0x03] = ["RCR", [E|b, I|b]]; hsh[base | 0x04] = ["SHL", [E|b, I|b]]; hsh[base | 0x05] = ["SHR", [E|b, I|b]];
    hsh[base | 0x06] = ["???", [E|b, I|b]]; hsh[base | 0x07] = ["SAR", [E|b, I|b]];
    base = 0xC1 << 3;
    hsh[base | 0x00] = ["ROL", [E|v, I|b]]; hsh[base | 0x01] = ["ROR", [E|v, I|b]]; hsh[base | 0x02] = ["RCL", [E|v, I|b]];
    hsh[base | 0x03] = ["RCR", [E|v, I|b]]; hsh[base | 0x04] = ["SHL", [E|v, I|b]]; hsh[base | 0x05] = ["SHR", [E|v, I|b]];
    hsh[base | 0x06] = ["???", [E|v, I|b]]; hsh[base | 0x07] = ["SAR", [E|v, I|b]];

    base = 0xD0 << 3;
    hsh[base | 0x00] = ["ROL", [E|b, CO|1]];hsh[base | 0x01] = ["ROR", [E|b, CO|1]];hsh[base | 0x02] = ["RCL", [E|b, CO|1]];
    hsh[base | 0x03] = ["RCR", [E|b, CO|1]];hsh[base | 0x04] = ["SHL", [E|b, CO|1]];hsh[base | 0x05] = ["SHR", [E|b, CO|1]];
    hsh[base | 0x06] = ["???", [E|b, CO|1]];hsh[base | 0x07] = ["SAR", [E|b, CO|1]];
    base = 0xD1 << 3;
    hsh[base | 0x00] = ["ROL", [E|v, CO|1]];hsh[base | 0x01] = ["ROR", [E|v, CO|1]];hsh[base | 0x02] = ["RCL", [E|v, CO|1]];
    hsh[base | 0x03] = ["RCR", [E|v, CO|1]];hsh[base | 0x04] = ["SHL", [E|v, CO|1]];hsh[base | 0x05] = ["SHR", [E|v, CO|1]];
    hsh[base | 0x06] = ["???", [E|v, CO|1]];hsh[base | 0x07] = ["SAR", [E|v, CO|1]];
    base = 0xD2 << 3;
    hsh[base | 0x00] = ["ROL", [E|b, "CL"]];hsh[base | 0x01] = ["ROR", [E|b, "CL"]];hsh[base | 0x02] = ["RCL", [E|b, "CL"]];
    hsh[base | 0x03] = ["RCR", [E|b, "CL"]];hsh[base | 0x04] = ["SHL", [E|b, "CL"]];hsh[base | 0x05] = ["SHR", [E|b, "CL"]];
    hsh[base | 0x06] = ["???", [E|b, "CL"]];hsh[base | 0x07] = ["SAR", [E|b, "CL"]];
    base = 0xD3 << 3;
    hsh[base | 0x00] = ["ROL", [E|v, "CL"]];hsh[base | 0x01] = ["ROR", [E|v, "CL"]];hsh[base | 0x02] = ["RCL", [E|v, "CL"]];
    hsh[base | 0x03] = ["RCR", [E|v, "CL"]];hsh[base | 0x04] = ["SHL", [E|v, "CL"]];hsh[base | 0x05] = ["SHR", [E|v, "CL"]];
    hsh[base | 0x06] = ["???", [E|v, "CL"]];hsh[base | 0x07] = ["SAR", [E|v, "CL"]];
    /* ====== /Ext. group 2 - Shift Grp 2 (1A) ====== */

    /* ====== Ext. group 3 - Unary Grp 3 (1A) ====== */
    base = 0xF6 << 3;
    hsh[base | 0x00] = ["TEST", [E|b, I|b]];hsh[base | 0x01] = ["???", [E|b]];      hsh[base | 0x02] = ["NOT", [E|b]];
    hsh[base | 0x03] = ["NEG", [E|b]];      hsh[base | 0x04] = ["MUL", ["AL", E|b]];hsh[base | 0x05] = ["IMUL", [E|b]];
    hsh[base | 0x06] = ["DIV", ["AL", E|b]];hsh[base | 0x07] = ["IDIV", [E|b]];
    base = 0xF7 << 3;
    hsh[base | 0x00] = ["TEST", [E|v, I|v]];hsh[base | 0x01] = ["???", [E|v]];      hsh[base | 0x02] = ["NOT", [E|v]];
    hsh[base | 0x03] = ["NEG", [E|v]];      hsh[base | 0x04] = ["MUL", ["eAX", E|v]];hsh[base | 0x05] = ["IMUL", [E|v]];
    hsh[base | 0x06] = ["DIV", ["eAX", E|v]];hsh[base | 0x07] = ["IDIV", [E|v]];
    /* ====== /Ext. group 3 - Unary Grp 3 (1A) ====== */

    /* ====== Ext. group 4 - INC/DEC Grp 4 (1A) ====== */
    base = 0xFE << 3;
    hsh[base | 0x00] = ["INC", [E|b]];      hsh[base | 0x01] = ["DEC", [E|b]];      hsh[base | 0x02] = ["???", [E|b]];
    hsh[base | 0x03] = ["???", [E|b]];      hsh[base | 0x04] = ["???", [E|b]];      hsh[base | 0x05] = ["???", [E|b]];
    hsh[base | 0x06] = ["???", [E|b]];      hsh[base | 0x07] = ["???", [E|b]];
    /* ====== /Ext. group 4 - INC/DEC Grp 4 (1A) ====== */

    /* ====== Ext. group 5 - INC/DEC Grp 5 (1A) ====== */
    base = 0xFF << 3;
    hsh[base | 0x00] = ["INC", [E|v]];      hsh[base | 0x01] = ["DEC", [E|v]];      hsh[base | 0x02] = ["CALLN", [E|v]];
    hsh[base | 0x03] = ["CALLF", [E|p]];    hsh[base | 0x04] = ["JMPN", [E|v]];     hsh[base | 0x05] = ["JMPF", [E|p]];
    hsh[base | 0x06] = ["PUSH", [E|v]];     hsh[base | 0x07] = ["???", [E|b]];
    /* ====== /Ext. group 5 - INC/DEC Grp 5 (1A) ====== */

    /* ====== Ext. group 6 - Two-byte opcode extensions ====== */
    base = 0x100 << 3; // 0x0F 0x00
    hsh[base | 0x00] = ["SLDT", [E|w]];     hsh[base | 0x01] = ["STR", [E|w]];      hsh[base | 0x02] = ["LLDT", [E|w]];
    hsh[base | 0x03] = ["LTR", [E|w]];      hsh[base | 0x04] = ["VERR", [E|w]];     hsh[base | 0x05] = ["VERW", [E|w]];
    hsh[base | 0x06] = ["???", [E|w]];      hsh[base | 0x07] = ["???", [E|w]];
    /* ====== /Ext. group 6 - Two-byte opcode extensions ====== */

    /* ====== Ext. group 7 - Two-byte opcode extensions ====== */
    base = 0x101 << 3; // 0x0F 0x01
    hsh[base | 0x00] = ["SGDT", [M|s]];     hsh[base | 0x01] = ["SIDT", [M|s]];     hsh[base | 0x02] = ["LGDT", [M|s]];
    hsh[base | 0x03] = ["LIDT", [M|s]];     hsh[base | 0x04] = ["SMSW", [E|w]];     hsh[base | 0x05] = ["???", [E|w]];
    hsh[base | 0x06] = ["LMSW", [E|w]];     hsh[base | 0x07] = ["INVLPG", [M|b]];
    /* ====== /Ext. group 7 - Two-byte opcode extensions ====== */

    /* ====== Ext. group 8 - Two-byte opcode extensions ====== */
    base = 0x1BA << 3; // 0x0F 0xBA
    hsh[base | 0x00] = ["???"];             hsh[base | 0x01] = ["???"];             hsh[base | 0x02] = ["???"];
    hsh[base | 0x03] = ["???"];             hsh[base | 0x04] = ["BT"];              hsh[base | 0x05] = ["BTS"];
    hsh[base | 0x06] = ["BTR"];             hsh[base | 0x07] = ["BTC"];
    /* ====== /Ext. group 8 - Two-byte opcode extensions ====== */

    /* ====== Ext. group 8 - Two-byte opcode extensions ====== */
    base = 0x1C7 << 3; // 0x0F 0xC7
    hsh[base | 0x00] = ["???"];             hsh[base | 0x01] = ["CMPXCHG", [M|q]];  hsh[base | 0x02] = ["???"];
    hsh[base | 0x03] = ["???"];             hsh[base | 0x04] = ["???"];             hsh[base | 0x05] = ["???"];
    hsh[base | 0x06] = ["???"];             hsh[base | 0x07] = ["???"];
    /* ====== /Ext. group 8 - Two-byte opcode extensions ====== */

    /* ====== Ext. group 11 - MOV Grp 11 (1A) ====== */
    base = 0xC6 << 3;
    hsh[base | 0x00] = ["MOV", [E|b, I|b]]; hsh[base | 0x01] = ["???", [E|b, I|b]]; hsh[base | 0x02] = ["???", [E|b, I|b]];
    hsh[base | 0x03] = ["???", [E|b, I|b]]; hsh[base | 0x04] = ["???", [E|b, I|b]]; hsh[base | 0x05] = ["???", [E|b, I|b]];
    hsh[base | 0x06] = ["???", [E|b, I|b]]; hsh[base | 0x07] = ["???", [E|b, I|b]];
    base = 0xC7 << 3;
    hsh[base | 0x00] = ["MOV", [E|v, I|v]]; hsh[base | 0x01] = ["???", [E|v, I|v]]; hsh[base | 0x02] = ["???", [E|v, I|v]];
    hsh[base | 0x03] = ["???", [E|v, I|v]]; hsh[base | 0x04] = ["???", [E|v, I|v]]; hsh[base | 0x05] = ["???", [E|v, I|v]];
    hsh[base | 0x06] = ["???", [E|v, I|v]]; hsh[base | 0x07] = ["???", [E|v, I|v]];
    /* ====== /Ext. group 11 - MOV Grp 11 (1A) ====== */
    /* ========== /Opcode tables ========== */

    var hsh, base;
    // Map from typeCodes to operand sizes
    Decoder.hsh_size_operand = hsh = {};
    hsh[a]  = [ 4, 8 ]; // Two word or 2 dword operands in memory, depending on operand-size attr
    hsh[b]  = [ 1, 1 ]; // Byte, regardless of operand-size attr
    hsh[c]  = [ 1, 2 ]; // Byte or word, depending on operand-size attr
    hsh[d]  = [ 4, 4 ]; // Dword, regardless of operand-size attr
    hsh[dq] = [ 16, 16 ];   // Double-quadword, regardless of operand-size attr
    hsh[p]  = [ 4, 6 ]; // 32-bit or 48-bit pointer, depending on operand-size attr
    hsh[pi] = [ 8, 8 ]; // Quadword MMX register (eg. mm0)
    hsh[ps] = [ 16, 16 ];   // 128-bit packed floating-point-precision data
    hsh[q]  = [ 8, 8 ]; // Quadword, regardless of operand-size attr
    hsh[s]  = [ 6, 6 ]; // 6-byte pseudo-descriptor
    hsh[ss] = [ 0, 0 ]; // Scalar element of 128-bit packed FP single-precision data
    hsh[si] = [ 0, 0 ]; // Dword integer register (eg. EAX)
    hsh[v]  = [ 2, 4 ]; // Word or dword, depending on operand-size attr
    hsh[w]  = [ 2, 2 ]; // Word, regardless of operand-size attr

    Decoder.hsh_addrmethodRegister = hsh = {};
    hsh[C] = "CONTROL";    // Control register
    hsh[D] = "DEBUG";      // Debug register
    hsh[Q] = "MMX";        // MMX register
    hsh[W] = "SIMD";       // SIMD register
    hsh[G] = "GENERAL";    // General-purpose register
    hsh[P] = "PQWORD_MMX"; // Packed quadword MMX register
    hsh[S] = "SEGMENT";    // Segment register
    hsh[T] = "TEST";       // Test register
    hsh[V] = "SIMD";       // SIMD floating-point register

    X = 0; // Undefined opcode
    Decoder.opcodeHasModRM32 = [
  /*       0 1 2 3 4 5 6 7 8 9 a b c d e f          */
  /*       -------------------------------          */
  /* 00 */ 1,1,1,1,0,0,0,0,1,1,1,1,0,0,0,X,
  /* 10 */ 1,1,1,1,0,0,0,0,1,1,1,1,0,0,0,0,
  /* 20 */ 1,1,1,1,0,0,X,0,1,1,1,1,0,0,X,0,
  /* 30 */ 1,1,1,1,0,0,X,0,1,1,1,1,0,0,X,0,
  /* 40 */ 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  /* 50 */ 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  /* 60 */ 0,0,1,1,X,X,X,X,0,1,0,1,0,0,0,0,
  /* 70 */ 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  /* 80 */ 1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
  /* 90 */ 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  /* A0 */ 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  /* B0 */ 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  /* C0 */ 1,1,0,0,1,1,1,1,0,0,0,0,0,0,0,0,
  /* D0 */ 1,1,1,1,0,0,0,0,1,1,1,1,1,1,1,1,
  /* E0 */ 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  /* F0 */ X,0,X,X,0,0,1,1,0,0,0,0,0,0,1,1,
  /*       0 1 2 3 4 5 6 7 8 9 a b c d e f           */
  /*       -------------------------------           */
           1,1,1,1,X,0,0,0,0,0,X,0,X,1,0,1, /* 0F 00 */
           1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1, /* 0F 10 */
           1,1,1,1,1,X,1,X,1,1,1,1,1,1,1,1, /* 0F 20 */
           0,0,0,0,0,0,X,X,1,X,1,X,X,X,X,X, /* 0F 30 */
           1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1, /* 0F 40 */
           1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1, /* 0F 50 */
           1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1, /* 0F 60 */
           1,1,1,1,1,1,1,0,1,1,X,X,1,1,1,1, /* 0F 70 */
           0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, /* 0F 80 */
           1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1, /* 0F 90 */
           0,0,0,1,1,1,0,0,0,0,0,1,1,1,1,1, /* 0F A0 */
           1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1, /* 0F B0 */
           1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0, /* 0F C0 */
           1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1, /* 0F D0 */
           1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1, /* 0F E0 */
           1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,X  /* 0F F0 */
  /*       -------------------------------           */
  /*       0 1 2 3 4 5 6 7 8 9 a b c d e f           */
    ];

    return Decoder;
});
