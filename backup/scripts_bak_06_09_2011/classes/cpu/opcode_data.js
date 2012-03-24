/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: CPU Instruction class support
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("cpu/opcode_data", function ( $ ) { "use strict";
	var x86Emu = this.data("x86Emu");
	
	// NB: all pre-shifted left by 8 bits for simple ORing together
	//	with Operand Types
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
	//	NB: this could be an array, if all elements were unrem'd;
	//	an object should use less memory ( Arrays are derived from Object anyway )
	//	- needs further testing.
	x86Emu.x86CPU.prototype.arr_mapOpcodes_1Byte = {
		// 0x00
		0x00: ["ADD", [E|b,G|b]],		0x01: ["ADD", [E|v,G|v]],			0x02: ["ADD", [G|b,E|b]],		0x03: ["ADD", [G|v,E|v]],
		0x04: ["ADD", ["AL",I|b]],		0x05: ["ADD", ["eAX",I|v]],			0x06: ["PUSH",["ES"]],			0x07: ["POP",["ES"]],
		0x08: ["OR", [E|b,G|b]],		0x09: ["OR", [E|v,G|v]],			0x0A: ["OR", [G|b,E|b]],		0x0B: ["OR", [G|v,E|v]],
		0x0C: ["OR", ["AL",I|b]],		0x0D: ["OR", ["eAX",I|v]],			0x0E: ["PUSH",["CS"]],			0x0F: ["#ESCAPE"], // 2-byte escape (refer to 2-byte opcode map)
		// 0x01
		0x10: ["ADC", [E|b,G|b]],		0x11: ["ADC", [E|v,G|v]],			0x12: ["ADC", [G|b,E|b]],		0x13: ["ADC", [G|v,E|v]],
		0x14: ["ADC", ["AL",I|b]],		0x15: ["ADC", ["eAX",I|v]],			0x16: ["PUSH",["SS"]],			0x17: ["POP",["SS"]],
		0x18: ["SBB", [E|b,G|b]],		0x19: ["SBB", [E|v,G|v]],			0x1A: ["SBB", [G|b,E|b]],		0x1B: ["SBB", [G|v,E|v]],
		0x1C: ["SBB", ["AL",I|b]],		0x1D: ["SBB", ["eAX",I|v]],			0x1E: ["PUSH",["DS"]],			0x1F: ["POP",["DS"]],
		// 0x02
		0x20: ["AND", [E|b,G|b]],		0x21: ["AND", [E|v,G|v]],			0x22: ["AND", [G|b,E|b]],		0x23: ["AND", [G|v,E|v]],
		0x24: ["AND", ["AL",I|b]],		0x25: ["AND", ["eAX",I|v]],			/*0x26: ["#SEG=",["ES"]],*/				0x27: ["DAA"],
		0x28: ["SUB", [E|b,G|b]],		0x29: ["SUB", [E|v,G|v]],			0x2A: ["SUB", [G|b,E|b]],		0x2B: ["SUB", [G|v,E|v]],
		0x2C: ["SUB", ["AL",I|b]],		0x2D: ["SUB", ["eAX",I|v]],			/*0x2E: ["#SEG=",["CS"]],*/				0x2F: ["DAS"],
		// 0x03
		0x30: ["XOR", [E|b,G|b]],		0x31: ["XOR", [E|v,G|v]],			0x32: ["XOR", [G|b,E|b]],		0x33: ["XOR", [G|v,E|v]],	// NB: ([33F6 XOR SI, SI] decoded incorrectly - Intel docs say Gb,Ev - typo?)
		0x34: ["XOR", ["AL",I|b]],		0x35: ["XOR", ["eAX",I|v]],			/*0x36: ["#SEG=",["SS"]],*/				0x37: ["AAA"],
		0x38: ["CMP", [E|b,G|b]],		0x39: ["CMP", [E|v,G|v]],			0x3A: ["CMP", [G|b,E|b]],		0x3B: ["CMP", [G|v,E|v]],
		0x3C: ["CMP", ["AL",I|b]],		0x3D: ["CMP", ["eAX",I|v]],			/*0x3E: ["#SEG=",["DS"]],*/				0x3F: ["AAS"],
		// 0x04
		0x40: ["INC", ["eAX"]],			0x41: ["INC", ["eCX"]],				0x42: ["INC", ["eDX"]],			0x43: ["INC", ["eBX"]],
		0x44: ["INC", ["eSP"]],			0x45: ["INC", ["eBP"]],				0x46: ["INC", ["eSI"]],			0x47: ["INC", ["eDI"]],
		0x48: ["DEC", ["eAX"]],			0x49: ["DEC", ["eCX"]],				0x4A: ["DEC", ["eDX"]],			0x4B: ["DEC", ["eBX"]],
		0x4C: ["DEC", ["eSP"]],			0x4D: ["DEC", ["eBP"]],				0x4E: ["DEC", ["eSI"]],			0x4F: ["DEC", ["eDI"]],
		// 0x05
		0x50: ["PUSH", ["eAX"]],		0x51: ["PUSH", ["eCX"]],			0x52: ["PUSH", ["eDX"]],		0x53: ["PUSH", ["eBX"]],
		0x54: ["PUSH", ["eSP"]],		0x55: ["PUSH", ["eBP"]],			0x56: ["PUSH", ["eSI"]],		0x57: ["PUSH", ["eDI"]],
		0x58: ["POP", ["eAX"]],			0x59: ["POP", ["eCX"]],				0x5A: ["POP", ["eDX"]],			0x5B: ["POP", ["eBX"]],
		0x5C: ["POP", ["eSP"]],			0x5D: ["POP", ["eBP"]],				0x5E: ["POP", ["eSI"]],			0x5F: ["POP", ["eDI"]],
		// 0x06
		0x60: ["PUSHA"],				0x61: ["POPA"],						0x62: ["BOUND", [G|v,M|a]],		0x63: ["ARPL", [E|w,G|w]],
		/*0x64: ["#SEG=",["FS"]],*/				/*0x65: ["#SEG=",["GS"]],*/					/*0x66: ["#OP_SIZE"],*/				/*0x67: ["#ADDR_SIZE"],*/
		0x68: ["PUSH",[I|v]],			0x69: ["IMUL", [G|v,E|v,I|v]],		0x6A: ["PUSH", [I|b]],			0x6B: ["IMUL", [G|v,E|v,I|b]],
		0x6C: ["INS", [Y|b,"DX"]],		0x6D: ["INS", [Y|v,"DX"]],			0x6E: ["OUTS", ["DX",X|b]],		0x6F: ["OUTS", ["DX",X|v]],
		// 0x07
		0x70: ["JO", [I|b]],			0x71: ["JNO", [I|b]],				0x72: ["JB", [I|b]],			0x73: ["JNB", [I|b]],
		0x74: ["JE", [I|b]],			0x75: ["JNE", [I|b]],				0x76: ["JBE", [I|b]],			0x77: ["JNBE", [I|b]],
		0x78: ["JS", [I|b]],			0x79: ["JNS", [I|b]],				0x7A: ["JP", [I|b]],			0x7B: ["JNP", [I|b]],
		0x7C: ["JL", [I|b]],			0x7D: ["JNL", [I|b]],				0x7E: ["JLE", [I|b]],			0x7F: ["JNLE", [I|b]],
		// 0x08
			// Immediate Group 1 (1A)
		/*0x80: ["#EXT_1", [E|b,I|b]],	0x81: ["#EXT_1", [E|v,I|v]],		0x82: ["#EXT_1", [E|v,I|b]],	0x83: ["#EXT_1", [E|v,I|b]],*/
		0x84: ["TEST", [E|b,G|b]],		0x85: ["TEST", [E|v,G|v]],			0x86: ["XCHG", [E|b,G|b]],		0x87: ["XCHG", [E|v,G|v]],
		0x88: ["MOV", [E|b,G|b]],		0x89: ["MOV", [E|v,G|v]],			0x8A: ["MOV", [G|b,E|b]],		0x8B: ["MOV", [G|v,E|v]],
		0x8C: ["MOV", [E|w,S|w]],		0x8D: ["LEA", [G|v,M|v]],			0x8E: ["MOV", [S|w,E|w]],		0x8F: ["POP",[E|v]],
		// 0x09
		0x90: ["NOP"],					0x91: ["XCHG", ["eCX","eAX"]],		0x92: ["XCHG", ["eDX","eAX"]],	0x93: ["XCHG", ["eBX","eAX"]],
		0x94: ["XCHG", ["eSP","eAX"]],	0x95: ["XCHG", ["eBP","eAX"]],		0x96: ["XCHG", ["eSI","eAX"]],	0x97: ["XCHG", ["eDI","eAX"]],
		0x98: ["CBW", ["eAX"]],			0x99: ["CWD"],						0x9A: ["CALLF_A",[A|p]],		0x9B: ["WAIT"],
		0x9C: ["PUSHF",[F|v]],			0x9D: ["POPF",[F|v]],				0x9E: ["SAHF"],					0x9F: ["LAHF"],
		// 0x0A
		0xA0: ["MOV", ["AL",O|b]],		0xA1: ["MOV", ["eAX",O|v]],			0xA2: ["MOV", [O|b,"AL"]],		0xA3: ["MOV", [O|v,"eAX"]],
		0xA4: ["MOVS", [X|b,Y|b]],		0xA5: ["MOVS", [X|v,Y|v]],			0xA6: ["CMPS", [X|b,Y|b]],		0xA7: ["CMPS", [X|v,Y|v]],
		0xA8: ["TEST", ["AL",I|b]],		0xA9: ["TEST", ["eAX",I|v]],		0xAA: ["STOS", [Y|b,"AL"]],		0xAB: ["STOS", [Y|v,"eAX"]],
		0xAC: ["LODS", ["AL",X|b]],		0xAD: ["LODS", ["eAX",X|v]],		0xAE: ["SCAS", ["AL",Y|b]],		0xAF: ["SCAS", ["eAX",X|v]],
		// 0x0B
		0xB0: ["MOV", ["AL",I|b]],		0xB1: ["MOV", ["CL",I|b]],			0xB2: ["MOV", ["DL",I|b]],		0xB3: ["MOV", ["BL",I|b]],
		0xB4: ["MOV", ["AH",I|b]],		0xB5: ["MOV", ["CH",I|b]],			0xB6: ["MOV", ["DH",I|b]],		0xB7: ["MOV", ["BH",I|b]],
		0xB8: ["MOV", ["eAX",I|v]],		0xB9: ["MOV", ["eCX",I|v]],			0xBA: ["MOV", ["eDX",I|v]],		0xBB: ["MOV", ["eBX",I|v]],
		0xBC: ["MOV", ["eSP",I|v]],		0xBD: ["MOV", ["eBP",I|v]],			0xBE: ["MOV", ["eSI",I|v]],		0xBF: ["MOV", ["eDI",I|v]],
		// 0x0C
			// Shift Group 2 (1A)
		/*0xC0: ["#EXT_2", [E|b,I|b]],			0xC1: ["#EXT_2", [E|v,I|b]],*/				0xC2: ["RETN_P",[I|w]],			0xC3: ["RETN"],
		0xC4: ["LES", [G|v,M|p]],		0xC5: ["LDS", [G|v,M|p]],			/*0xC6: ["#EXT_11", [E|b,I|b]],	0xC7: ["#EXT_11", [E|v,I|v]],*/ // Group 11 (1A) - MOV
		0xC8: ["ENTER", [I|w,I|b]],		0xC9: ["LEAVE"],					0xCA: ["RETF_P",[I|w]],			0xCB: ["RETF"],
		0xCC: ["INT", [CO|3]],			0xCD: ["INT", [I|b]],				0xCE: ["INTO"],					0xCF: ["IRET"],
		// 0x0D
			// Shift Group 2 (1A)
		/*0xD0: ["#EXT_2", [E|b,"1"]],	0xD1: ["#EXT_2", [E|v,"1"]],		0xD2: ["#EXT_2", [E|b,"CL"]],	0xD3: ["#EXT_2", [E|v,"CL"]],*/
		0xD4: ["AAM", [I|b]],			0xD5: ["AAD", [I|b]],				0xD6: ["#RESERVED"],			0xD7: ["XLAT"],
			// ESC (Escape to coprocessor instruction set)
		0xD8: ["#RESERVED"],			0xD9: ["#RESERVED"],				0xDA: ["#RESERVED"],			0xDB: ["#RESERVED"],
		0xDC: ["#RESERVED"],			0xDD: ["#RESERVED"],				0xDE: ["#RESERVED"],			0xDF: ["#RESERVED"],
		// 0x0E
		0xE0: ["LOOPNE", [J|b]],		0xE1: ["LOOPE",[J|b]],				0xE2: ["LOOP",[I|b]],			0xE3: ["JCXZ",[J|b]],
		0xE4: ["IN", ["AL",I|b]],		0xE5: ["IN", ["eAX",I|b]],			0xE6: ["OUT", [I|b,"AL"]],		0xE7: ["OUT", [I|b,"eAX"]],
		0xE8: ["CALLN_R", [J|v]],		0xE9: ["JMPN",[J|v]],				0xEA: ["JMPF", [A|p]],			0xEB: ["JMPN",[J|b]],
		0xEC: ["IN", ["AL","DX"]],		0xED: ["IN", ["eAX","DX"]],			0xEE: ["OUT", ["DX","AL"]],		0xEF: ["OUT", ["DX","eAX"]],
		// 0x0F
		/*0xF0: ["#LOCK"],*/					0xF1: ["#RESERVED"],				/*0xF2: ["#REPNE"],*/					/*0xF3: ["#REP"],*/
		0xF4: ["HLT"],					0xF5: ["CMC"],						/*0xF6: ["#EXT_3", [E|b], 0],	0xF7: ["#EXT_3", [E|v], 1],*/
		0xF8: ["CLC"],					0xF9: ["STC"],						0xFA: ["CLI"],					0xFB: ["STI"],
		0xFC: ["CLD"],					0xFD: ["STD"]						/*0xFE: ["#EXT_4"],0xFF: 			["#EXT_5"]*/
	};
	
	// Format: [ <opcode_mnemonic>, <operands> ]
	//	2-byte Intel operands have 0Fh as the first byte. Only the 2nd byte
	//	is used to index into this table.
	x86Emu.x86CPU.prototype.arr_mapOpcodes_2Byte = {
		// 0x00
		0x00: ["#EXT_6"],				0x01: ["#EXT_7"],					0x02: ["LAR", [G|v,E|w]],		0x03: ["LSL", [G|v, E|w]],
		0x04: ["#RESERVED"],			0x05: ["#RESERVED"],				0x06: ["CLTS"],					0x07: ["#RESERVED"],
		0x08: ["INVD"],					0x09: ["WBINVD"],					0x0A: ["#RESERVED"],			0x0B: ["#ILLEGAL"],
		0x0C: ["#RESERVED"],			0x0D: ["#RESERVED"],				0x0E: ["#RESERVED"],			0x0F: ["#RESERVED"],
		
		// 0x01
		0x10: ["movups", [V|ps,W|ps]],	0x11: ["movups", [W|ps, V|ps]],		0x12: ["movlps", [W|q,V|q]],	0x13: ["movlps", [V|q,W|q]],
		0x14: ["unpcklps", [V|ps,W|q]],	0x15: ["unpckhps", [V|ps,W|q]],		0x16: ["movhps", [V|q,W|q]],	0x17: ["movhps", [W|q,V|q]],
		0x18: ["#EXT_16"],				0x19: ["#RESERVED"],				0x1A: ["#RESERVED"],			0x1B: ["#RESERVED"],
		0x1C: ["#RESERVED"],			0x1D: ["#RESERVED"],				0x1E: ["#RESERVED"],			0x1F: ["#RESERVED"],
		
		// 0x02
		0x20: ["MOV", [R|d,C|d]],		0x21: ["MOV", [R|d,D|d]],			0x22: ["MOV", [C|d,R|d]],		0x23: ["MOV", [D|d,R|d]],
		0x24: ["#RESERVED"],			0x25: ["#RESERVED"],				0x26: ["#RESERVED"],			0x27: ["#RESERVED"],
		0x28: ["movaps", [V|ps,W|ps]],	0x29: ["movaps", [W|ps,V|ps]],		0x2A: ["cvtpl2ps", [V|ps,Q|q]],	0x2B: ["movntps", [W|ps,V|ps]],
		0x2C: ["cvttps2pl", [Q|q,W|ps]],0x2D: ["cvtps2pl", [Q|q, W|ps]],	0x2E: ["ucomiss", [V|ss,W|ss]],	0x2F: ["comiss", [V|ps,W|ps]],
		
		// 0x03
		0x30: ["WRMSR"],				0x31: ["RDTSC"],					0x32: ["RDMSR"],				0x33: ["RDPMC"],
		0x34: ["SYSENTER"],				0x35: ["SYSEXIT"],					0x36: ["#RESERVED"],			0x37: ["#RESERVED"],
		0x38: ["#RESERVED"],			0x39: ["#RESERVED"],				0x3A: ["#RESERVED"],			0x3B: ["#RESERVED"],
		0x3C: ["#RESERVED"],			0x3D: ["#RESERVED"],				0x3E: ["#RESERVED"],			0x3F: ["#RESERVED"],
		
		// 0x04
		0x40: ["CMOVO", [G|v,E|v]],		0x41: ["CMOVNO", [G|v,E|v]],		0x42: ["CMOVB", [G|v,E|v]],		0x43: ["CMOVNB", [G|v,E|v]],
		0x44: ["CMOVE", [G|v,E|v]],		0x45: ["CMOVNE", [G|v,E|v]],		0x46: ["CMOVBE", [G|v,E|v]],	0x47: ["CMOVNBE", [G|v,E|v]],
		0x48: ["CMOVS", [G|v,E|v]],		0x49: ["CMOVNS", [G|v,E|v]],		0x4A: ["CMOVP", [G|v,E|v]],		0x4B: ["CMOVNP", [G|v,E|v]],
		0x4C: ["CMOVL", [G|v,E|v]],		0x4D: ["CMOVNL", [G|v,E|v]],		0x4E: ["CMOVLE", [G|v,E|v]],	0x4F: ["CMOVNLE", [G|v,E|v]],
		
		// 0x05
		0x50: ["movmskps", [E|d,V|ps]],	0x51: ["sqrtps", [V|ps,W|ps]],		0x52: ["rsqrtps", [V|ps,W|ps]],	0x53: ["rcpps", [V|ps,W|ps]],
		0x54: ["andps", [V|ps,W|ps]],	0x55: ["andnps", [V|ps,W|ps]],		0x56: ["orps", [V|ps,W|ps]],	0x57: ["xorps", [V|ps,W|ps]],
		0x58: ["", [G|v,E|v]],			0x59: ["", [G|v,E|v]],				0x5A: ["", [G|v,E|v]],			0x5B: ["", [G|v,E|v]],
		0x5C: ["", [G|v,E|v]],			0x5D: ["", [G|v,E|v]],				0x5E: ["", [G|v,E|v]],			0x5F: ["", [G|v,E|v]],
		
		/** ===== GAP - TODO here!! ===== **/
		
		// 0x08
		0x80: ["JO", [J|v]],			0x81: ["JNO", [J|v]],				0x82: ["JNLE", [J|v]],			0x83: ["JNB", [J|v]],
		0x84: ["JE", [J|v]],			0x85: ["JNE", [J|v]],				0x86: ["JBE", [J|v]],			0x87: ["JNBE", [J|v]],
		0x88: ["", [G|v,E|v]],			0x89: ["", [G|v,E|v]],			0x8A: ["", [G|v,E|v]],		0x8B: ["", [G|v,E|v]],
		0x8C: ["", [G|v,E|v]],			0x8D: ["", [G|v,E|v]],		0x8E: ["", [G|v,E|v]],	0x8F: ["", [G|v,E|v]],
		
		/** ===== GAP - TODO here!! ===== **/
		
		// 0x0B
		0xB0: ["CMPXCHG", [E|b,G|b]],	0xB1: ["CMPXCHG", [E|v,G|v]],		0xB2: ["LSS", [M|p]],			0xB3: ["BTR", [E|v,G|v]],
		0xB4: ["LFS", [M|p]],			0xB5: ["LGS", [M|p]],				0xB6: ["MOVZX", [G|v,E|b]],		0xB7: ["MOVZX", [G|v,E|w]],
		0xB8: ["", [G|v,E|v]],			0xB9: ["", [G|v,E|v]],			0xBA: ["", [G|v,E|v]],		0xBB: ["", [G|v,E|v]],
		0xBC: ["", [G|v,E|v]],			0xBD: ["", [G|v,E|v]],		0xBE: ["", [G|v,E|v]],	0xBF: ["", [G|v,E|v]]
		
		
	};
	
	x86Emu.x86CPU.prototype.arr_mapOpcodes_1Byte_Extensions = [
		[	//1
			["ADD"],					["OR"],					["ADC"],				["SBB"],
				["AND"],				["SUB"],				["XOR"],				["CMP"]
		], [	//2
			["ROL"],					["ROR"],				["RCL"],				["RCR"],
				["SHL"],				["SHR"],				["#RESERVED"],			["SAR"]
		], [	//3
			["TEST", ["Ib/Iv"]],		["#RESERVED"],			["NOT"],				["NEG"],
				["MUL", ["AL","eAX"]],	["IMUL", ["AL","eAX"]],	["DIV", ["AL","eAX"]],	["IDIV", ["AL","eAX"]]
		], [	//4
			["INC",[E|b]],				["DEC",[E|b]],			["#RESERVED"],			["#RESERVED"],
				["#RESERVED"],			["#RESERVED"],			["#RESERVED"],			["#RESERVED"]
		], [	//5
			["INC",[E|v]],				["DEC",[E|v]],			["CALLN_AI",[E|v]],	["CALLF_AI",[E|p]],
				["JMP",[E|v]],			["JMP FAR", [E|p]],	["PUSH",[E|v]],		["#RESERVED"]
		], [	//6
			["SLDT",[E|w]],			["STR",[E|w]],			["LLDT",[E|w]],		["LTR",[E|w]],
				["VERR",[E|w]],		["VERW",[E|w]],		["#RESERVED"],			["#RESERVED"]
		], [	//7
			["SGDT",["Ms"]],			["SIDT",["Ms"]],		["LGDT",["Ms"]],		["LIDT",["Ms"]],
				["SMSW",[E|w]],		["#RESERVED"],			["LMSW",[E|w]],		["INVLPG",["Mb"]]
		], [	//8
			["#RESERVED"],				["#RESERVED"],			["#RESERVED"],			["#RESERVED"],
				["BT"],					["BTS"],				["BTR"],				["BTC"]
		], [	//9
			["#RESERVED"],				["CMPXCHG8", "B Mq"],	["#RESERVED"],			["#RESERVED"],
				["#RESERVED"],			["#RESERVED"],			["#RESERVED"],			["#RESERVED"]
		], [	//10
			["#RESERVED"],				["#RESERVED"],			["#RESERVED"],			["#RESERVED"],
				["#RESERVED"],			["#RESERVED"],			["#RESERVED"],			["#RESERVED"]
		], [	//11
			["MOV", [E|v,I|v]],		["#RESERVED"],			["#RESERVED"],			["#RESERVED"],
				["#RESERVED"],			["#RESERVED"],			["#RESERVED"],			["#RESERVED"]
		], [	//12
			["#RESERVED"],				["#RESERVED"],			["psrlw", ["Pq",I|b]],	["#RESERVED"],
				["psraw", ["Pq",I|b]],	["#RESERVED"],			["psllw", ["Pq",I|b]],	["#RESERVED"]
		], [	//13
			["#RESERVED"],				["#RESERVED"],			["psrld", ["Pq",I|b]],	["#RESERVED"],
				["psrad", ["Pq",I|b]],	["#RESERVED"],			["pslld", ["Pq",I|b]],	["#RESERVED"]
		], [	//14
			["#RESERVED"],				["#RESERVED"],			["psrlq", ["Pq",I|b]],	["#RESERVED"],
				["#RESERVED"],			["#RESERVED"],			["psllq", ["Pq",I|b]],	["#RESERVED"]
		], [	//15
			["fxsave"],					["fxrstor"],			["ldmxcsr"],			["stmxcsr"],
				["#RESERVED"],			["#RESERVED"],			["#RESERVED"],			["#RESERVED"]
		], [	//16
			["prefetch",["NTA"]],		["prefetch",["T0"]],	["prefetch",["T1"]],	["prefetch",["T2"]],
				["#RESERVED"],			["#RESERVED"],			["#RESERVED"],			["#RESERVED"]
		]
	];
	/* ========== /Opcode tables ========== */
	
	var hsh;
	var base;
	// Map from typeCodes to operand sizes
	x86Emu.x86CPU.prototype.hsh_size_operand = hsh = {};
	hsh[a]	= 4;	// Two word or 2 dword operands in memory, depending on operand-size attr
	hsh[b]	= 1;	// Byte, regardless of operand-size attr
	hsh[c]	= 1;	// Byte or word, depending on operand-size attr
	hsh[d]	= 4;	// Dword, regardless of operand-size attr
	hsh[dq]	= 16;	// Double-quadword, regardless of operand-size attr
	hsh[p]	= 4;	// 32-bit or 48-bit pointer, depending on operand-size attr
	hsh[pi]	= 4;	// Quadword MMX register (eg. mm0)
	hsh[ps]	= 16;	// 128-bit packed floating-point-precision data
	hsh[q]	= 8;	// Quadword, regardless of operand-size attr
	hsh[s]	= 6;	// 6-byte pseudo-descriptor
	hsh[ss]	= 0;	// Scalar element of 128-bit packed FP single-precision data
	hsh[si]	= 0;	// Dword integer register (eg. EAX)
	hsh[v]	= 2;	// Word or dword, depending on operand-size attr
	hsh[w]	= 2;	// Word, regardless of operand-size attr
	
	// Sizes for typeCodes when operand-size attribute is set
	//	(will multiply their size in bytes from above hash by 2)
	x86Emu.x86CPU.prototype.hsh_flgDependsOnOperandSizeAttr = hsh = {};
	hsh[ a ]
		= hsh[ c ]
		= hsh[ p ]
		= hsh[ v ] = true;
	
	x86Emu.x86CPU.prototype.hsh_addrmethodRegister = hsh = {};
	hsh[ C ] = "CONTROL";		// Control register
	hsh[ D ] = "DEBUG";			// Debug register
	hsh[ Q ] = "MMX";			// MMX register
	hsh[ W ] = "SIMD";			// SIMD register
	hsh[ G ] = "GENERAL";		// General-purpose register
	hsh[ P ] = "PQWORD_MMX";	// Packed quadword MMX register
	hsh[ S ] = "SEGMENT";		// Segment register
	hsh[ T ] = "TEST";			// Test register
	hsh[ V ] = "SIMD";			// SIMD floating-point register
	
	x86Emu.x86CPU.prototype.arr_mapOpcodeExtensions = hsh = {};
	/* ====== Ext. group 1 - Immediate Grp 1 ( 1A ) ====== */
	base = 0x80 << 3;
	hsh[base | 0x00] = ["ADD", [E|b, I|b]]; 	hsh[base | 0x01] = ["OR", [E|b, I|b]];		hsh[base | 0x02] = ["ADC", [E|b, I|b]];
	hsh[base | 0x03] = ["SBB", [E|b, I|b]];		hsh[base | 0x04] = ["AND", [E|b, I|b]]; 	hsh[base | 0x05] = ["SUB", [E|b, I|b]];
	hsh[base | 0x06] = ["XOR", [E|b, I|b]];		hsh[base | 0x07] = ["CMP", [E|b, I|b]];
	base = 0x81 << 3;
	hsh[base | 0x00] = ["ADD", [E|v, I|v]]; 	hsh[base | 0x01] = ["OR", [E|v, I|v]];		hsh[base | 0x02] = ["ADC", [E|v, I|v]];
	hsh[base | 0x03] = ["SBB", [E|v, I|v]];		hsh[base | 0x04] = ["AND", [E|v, I|v]]; 	hsh[base | 0x05] = ["SUB", [E|v, I|v]];
	hsh[base | 0x06] = ["XOR", [E|v, I|v]];		hsh[base | 0x07] = ["CMP", [E|v, I|v]];
	base = 0x82 << 3;
	hsh[base | 0x00] = ["ADD", [E|v, I|b]]; 	hsh[base | 0x01] = ["OR", [E|v, I|b]];		hsh[base | 0x02] = ["ADC", [E|v, I|b]];
	hsh[base | 0x03] = ["SBB", [E|v, I|b]];		hsh[base | 0x04] = ["AND", [E|v, I|b]]; 	hsh[base | 0x05] = ["SUB", [E|v, I|b]];
	hsh[base | 0x06] = ["XOR", [E|v, I|b]];		hsh[base | 0x07] = ["CMP", [E|v, I|b]];
	base = 0x83 << 3;
	hsh[base | 0x00] = ["ADD", [E|v, I|b]]; 	hsh[base | 0x01] = ["OR", [E|v, I|b]];		hsh[base | 0x02] = ["ADC", [E|v, I|b]];
	hsh[base | 0x03] = ["SBB", [E|v, I|b]];		hsh[base | 0x04] = ["AND", [E|v, I|b]]; 	hsh[base | 0x05] = ["SUB", [E|v, I|b]];
	hsh[base | 0x06] = ["XOR", [E|v, I|b]];		hsh[base | 0x07] = ["CMP", [E|v, I|b]];
	/* ====== /Ext. group 1 - Immediate Grp 1 ( 1A ) ====== */
	/* ====== Ext. group 2 - Shift Grp 2 ( 1A ) ====== */
	base = 0xC0 << 3;
	hsh[base | 0x00] = ["ROL", [E|b, I|b]]; 	hsh[base | 0x01] = ["ROR", [E|b, I|b]];		hsh[base | 0x02] = ["RCL", [E|b, I|b]];
	hsh[base | 0x03] = ["RCR", [E|b, I|b]];		hsh[base | 0x04] = ["SHL", [E|b, I|b]]; 	hsh[base | 0x05] = ["SHR", [E|b, I|b]];
	hsh[base | 0x06] = ["???", [E|b, I|b]];		hsh[base | 0x07] = ["SAR", [E|b, I|b]];
	base = 0xC1 << 3;
	hsh[base | 0x00] = ["ROL", [E|v, I|b]]; 	hsh[base | 0x01] = ["ROR", [E|v, I|b]];		hsh[base | 0x02] = ["RCL", [E|v, I|b]];
	hsh[base | 0x03] = ["RCR", [E|v, I|b]];		hsh[base | 0x04] = ["SHL", [E|v, I|b]]; 	hsh[base | 0x05] = ["SHR", [E|v, I|b]];
	hsh[base | 0x06] = ["???", [E|v, I|b]];		hsh[base | 0x07] = ["SAR", [E|v, I|b]];
	
	base = 0xD0 << 3;
	hsh[base | 0x00] = ["ROL", [E|b, CO|1]]; 	hsh[base | 0x01] = ["ROR", [E|b, CO|1]];	hsh[base | 0x02] = ["RCL", [E|b, CO|1]];
	hsh[base | 0x03] = ["RCR", [E|b, CO|1]];	hsh[base | 0x04] = ["SHL", [E|b, CO|1]]; 	hsh[base | 0x05] = ["SHR", [E|b, CO|1]];
	hsh[base | 0x06] = ["???", [E|b, CO|1]];	hsh[base | 0x07] = ["SAR", [E|b, CO|1]];
	base = 0xD1 << 3;
	hsh[base | 0x00] = ["ROL", [E|v, CO|1]]; 	hsh[base | 0x01] = ["ROR", [E|v, CO|1]];	hsh[base | 0x02] = ["RCL", [E|v, CO|1]];
	hsh[base | 0x03] = ["RCR", [E|v, CO|1]];	hsh[base | 0x04] = ["SHL", [E|v, CO|1]]; 	hsh[base | 0x05] = ["SHR", [E|v, CO|1]];
	hsh[base | 0x06] = ["???", [E|v, CO|1]];	hsh[base | 0x07] = ["SAR", [E|v, CO|1]];
	base = 0xD2 << 3;
	hsh[base | 0x00] = ["ROL", [E|b, "CL"]]; 	hsh[base | 0x01] = ["ROR", [E|b, "CL"]];	hsh[base | 0x02] = ["RCL", [E|b, "CL"]];
	hsh[base | 0x03] = ["RCR", [E|b, "CL"]];	hsh[base | 0x04] = ["SHL", [E|b, "CL"]]; 	hsh[base | 0x05] = ["SHR", [E|b, "CL"]];
	hsh[base | 0x06] = ["???", [E|b, "CL"]];	hsh[base | 0x07] = ["SAR", [E|b, "CL"]];
	base = 0xD3 << 3;
	hsh[base | 0x00] = ["ROL", [E|v, "CL"]]; 	hsh[base | 0x01] = ["ROR", [E|v, "CL"]];	hsh[base | 0x02] = ["RCL", [E|v, "CL"]];
	hsh[base | 0x03] = ["RCR", [E|v, "CL"]];	hsh[base | 0x04] = ["SHL", [E|v, "CL"]]; 	hsh[base | 0x05] = ["SHR", [E|v, "CL"]];
	hsh[base | 0x06] = ["???", [E|v, "CL"]];	hsh[base | 0x07] = ["SAR", [E|v, "CL"]];
	/* ====== /Ext. group 2 - Shift Grp 2 ( 1A ) ====== */
	
	/* ====== Ext. group 3 - Unary Grp 3 ( 1A ) ====== */
	base = 0xF6 << 3;
	hsh[base | 0x00] = ["TEST", [I|b, E|b]]; 	hsh[base | 0x01] = ["???", [E|b]];			hsh[base | 0x02] = ["NOT", [E|b]];
	hsh[base | 0x03] = ["NEG", [E|b]];			hsh[base | 0x04] = ["MUL", ["AL", E|b]]; 	hsh[base | 0x05] = ["IMUL", ["AL", E|b]];
	hsh[base | 0x06] = ["DIV", ["AL", E|b]];	hsh[base | 0x07] = ["IDIV", ["AL", E|b]];
	base = 0xF7 << 3;
	hsh[base | 0x00] = ["TEST", [I|v, E|v]]; 	hsh[base | 0x01] = ["???", [E|v]];			hsh[base | 0x02] = ["NOT", [E|v]];
	hsh[base | 0x03] = ["NEG", [E|v]];			hsh[base | 0x04] = ["MUL", ["eAX", E|v]];	hsh[base | 0x05] = ["IMUL", ["eAX", E|v]];
	hsh[base | 0x06] = ["DIV", ["eAX", E|v]];	hsh[base | 0x07] = ["IDIV", ["eAX", E|v]];
	/* ====== /Ext. group 3 - Unary Grp 3 ( 1A ) ====== */
	
	/* ====== Ext. group 4 - INC/DEC Grp 4 ( 1A ) ====== */
	base = 0xFE << 3;
	hsh[base | 0x00] = ["INC", [E|b]]; 			hsh[base | 0x01] = ["DEC", [E|b]];			hsh[base | 0x02] = ["???", [E|b]];
	hsh[base | 0x03] = ["???", [E|b]];			hsh[base | 0x04] = ["???", [E|b]]; 			hsh[base | 0x05] = ["???", [E|b]];
	hsh[base | 0x06] = ["???", [E|b]];			hsh[base | 0x07] = ["???", [E|b]];
	/* ====== /Ext. group 4 - INC/DEC Grp 4 ( 1A ) ====== */
	
	/* ====== Ext. group 5 - INC/DEC Grp 5 ( 1A ) ====== */
	base = 0xFF << 3;
	hsh[base | 0x00] = ["INC", [E|v]]; 			hsh[base | 0x01] = ["DEC", [E|v]];			hsh[base | 0x02] = ["CALLN_AI", [E|v]];
	hsh[base | 0x03] = ["CALLF_AI", [E|p]];		hsh[base | 0x04] = ["JMPN", [E|v]]; 		hsh[base | 0x05] = ["JMPF", [E|p]];
	hsh[base | 0x06] = ["PUSH", [E|v]];			hsh[base | 0x07] = ["???", [E|b]];
	/* ====== /Ext. group 5 - INC/DEC Grp 5 ( 1A ) ====== */
	
	/* ====== Ext. group 11 - MOV Grp 11 ( 1A ) ====== */
	base = 0xC6 << 3;
	hsh[base | 0x00] = ["MOV", [E|b, I|b]]; 	hsh[base | 0x01] = ["???", [E|b, I|b]];		hsh[base | 0x02] = ["???", [E|b, I|b]];
	hsh[base | 0x03] = ["???", [E|b, I|b]];		hsh[base | 0x04] = ["???", [E|b, I|b]]; 	hsh[base | 0x05] = ["???", [E|b, I|b]];
	hsh[base | 0x06] = ["???", [E|b, I|b]];		hsh[base | 0x07] = ["???", [E|b, I|b]];
	base = 0xC7 << 3;
	hsh[base | 0x00] = ["MOV", [E|v, I|v]]; 	hsh[base | 0x01] = ["???", [E|v, I|v]];		hsh[base | 0x02] = ["???", [E|v, I|v]];
	hsh[base | 0x03] = ["???", [E|v, I|v]];		hsh[base | 0x04] = ["???", [E|v, I|v]]; 	hsh[base | 0x05] = ["???", [E|v, I|v]];
	hsh[base | 0x06] = ["???", [E|v, I|v]];		hsh[base | 0x07] = ["???", [E|v, I|v]];
	/* ====== /Ext. group 11 - MOV Grp 11 ( 1A ) ====== */
	
	/* ==== Exports ==== */
	
	/* ==== /Exports ==== */
});
