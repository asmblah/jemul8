/*
 *	jsEmu - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: CPU Instruction class support
 */
var mod = new jsEmu.PrimaryModule( function ( jsEmu ) {
	/* ========== Opcode tables ========== */
	// Format: [ <opcode_mnemonic>, <operands> ]
	//	NB: this could be an array, if all elements were unrem'd;
	//	an object should use less memory ( Arrays are derived from Object anyway )
	//	- needs further testing.
	jsEmu.x86CPU.prototype.arr_mapOpcodes_1Byte = {
		// 0x00
		0x00: ["ADD", ["Eb","Gb"]],		0x01: ["ADD", ["Ev","Gv"]],			0x02: ["ADD", ["Gb","Eb"]],		0x03: ["ADD", ["Gv","Ev"]],
		0x04: ["ADD", ["AL","Ib"]],		0x05: ["ADD", ["eAX","Iv"]],		0x06: ["PUSH",["ES"]],			0x07: ["POP",["ES"]],
		0x08: ["OR", ["Eb","Gb"]],		0x09: ["OR", ["Ev","Gv"]],			0x0A: ["OR", ["Gb","Eb"]],		0x0B: ["OR", ["Gv","Ev"]],
		0x0C: ["OR", ["AL","Ib"]],		0x0D: ["OR", ["eAX","Iv"]],			0x0E: ["PUSH",["CS"]],			0x0F: ["#ESCAPE"], // 2-byte escape (refer to 2-byte opcode map)
		// 0x01
		0x10: ["ADC", ["Eb","Gb"]],		0x11: ["ADC", ["Ev","Gv"]],			0x12: ["ADC", ["Gb","Eb"]],		0x13: ["ADC", ["Gv","Ev"]],
		0x14: ["ADC", ["AL","Ib"]],		0x15: ["ADC", ["eAX","Iv"]],		0x16: ["PUSH",["SS"]],			0x17: ["POP",["SS"]],
		0x18: ["SBB", ["Eb","Gb"]],		0x19: ["SBB", ["Ev","Gv"]],			0x1A: ["SBB", ["Gb","Eb"]],		0x1B: ["SBB", ["Gv","Ev"]],
		0x1C: ["SBB", ["AL","Ib"]],		0x1D: ["SBB", ["eAX","Iv"]],		0x1E: ["PUSH",["DS"]],			0x1F: ["POP",["DS"]],
		// 0x02
		0x20: ["AND", ["Eb","Gb"]],		0x21: ["AND", ["Ev","Gv"]],			0x22: ["AND", ["Gb","Eb"]],		0x23: ["AND", ["Gv","Ev"]],
		0x24: ["AND", ["AL","Ib"]],		0x25: ["AND", ["eAX","Iv"]],		/*0x26: ["#SEG=",["ES"]],*/				0x27: ["DAA"],
		0x28: ["SUB", ["Eb","Gb"]],		0x29: ["SUB", ["Ev","Gv"]],			0x2A: ["SUB", ["Gb","Eb"]],		0x2B: ["SUB", ["Gv","Ev"]],
		0x2C: ["SUB", ["AL","Ib"]],		0x2D: ["SUB", ["eAX","Iv"]],		/*0x2E: ["#SEG=",["CS"]],*/				0x2F: ["DAS"],
		// 0x03
		0x30: ["XOR", ["Eb","Gb"]],		0x31: ["XOR", ["Ev","Gv"]],			0x32: ["XOR", ["Gb","Eb"]],		0x33: ["XOR", ["Gv","Ev"]],	// NB: ([33F6 XOR SI, SI] decoded incorrectly - Intel docs say Gb,Ev - typo?)
		0x34: ["XOR", ["AL","Ib"]],		0x35: ["XOR", ["eAX","Iv"]],		/*0x36: ["#SEG=",["SS"]],*/				0x37: ["AAA"],
		0x38: ["CMP", ["Eb","Gb"]],		0x39: ["CMP", ["Ev","Gv"]],			0x3A: ["CMP", ["Gb","Eb"]],		0x3B: ["CMP", ["Gv","Ev"]],
		0x3C: ["CMP", ["AL","Ib"]],		0x3D: ["CMP", ["eAX","Iv"]],		/*0x3E: ["#SEG=",["DS"]],*/			0x3F: ["AAS"],
		// 0x04
		0x40: ["INC",["eAX"]],			0x41: ["INC",["eCX"]],				0x42: ["INC",["eDX"]],			0x43: ["INC",["eBX"]],
		0x44: ["INC",["eSP"]],			0x45: ["INC",["eBP"]],				0x46: ["INC",["eSI"]],			0x47: ["INC",["eDI"]],
		0x48: ["DEC",["eAX"]],			0x49: ["DEC",["eCX"]],				0x4A: ["DEC",["eDX"]],			0x4B: ["DEC",["eBX"]],
		0x4C: ["DEC",["eSP"]],			0x4D: ["DEC",["eBP"]],				0x4E: ["DEC",["eSI"]],			0x4F: ["DEC",["eDI"]],
		// 0x05
		0x50: ["PUSH",["eAX"]],			0x51: ["PUSH",["eCX"]],				0x52: ["PUSH",["eDX"]],			0x53: ["PUSH",["eBX"]],
		0x54: ["PUSH",["eSP"]],			0x55: ["PUSH",["eBP"]],				0x56: ["PUSH",["eSI"]],			0x57: ["PUSH",["eDI"]],
		0x58: ["POP",["eAX"]],			0x59: ["POP",["eCX"]],				0x5A: ["POP",["eDX"]],			0x5B: ["POP",["eBX"]],
		0x5C: ["POP",["eSP"]],			0x5D: ["POP",["eBP"]],				0x5E: ["POP",["eSI"]],			0x5F: ["POP",["eDI"]],
		// 0x06
		0x60: ["PUSHA"],				0x61: ["POPA"],						0x62: ["BOUND", ["Gv","Ma"]],	0x63: ["ARPL", ["Ew","Gw"]],
		/*0x64: ["#SEG=",["FS"]],*/				/*0x65: ["#SEG=",["GS"]],*/					/*0x66: ["#OP_SIZE"],*/				/*0x67: ["#ADDR_SIZE"],*/
		0x68: ["PUSH",["Iv"]],			0x69: ["IMUL", ["Gv","Ev","Iv"]],	0x6A: ["PUSH",["Ib"]],			0x6B: ["IMUL", ["Gv","Ev","Ib"]],
		0x6C: ["INS", ["Yb","DX"]],		0x6D: ["INS", ["Yv","DX"]],			0x6E: ["OUTS", ["DX","Xb"]],	0x6F: ["OUTS", ["DX","Xv"]],
		// 0x07
		0x70: ["JO",["Ib"]],			0x71: ["JNO",["Ib"]],				0x72: ["JB",["Ib"]],			0x73: ["JNB",["Ib"]],
		0x74: ["JE",["Ib"]],			0x75: ["JNE",["Ib"]],				0x76: ["JBE",["Ib"]],			0x77: ["JNBE",["Ib"]],
		0x78: ["JS",["Ib"]],			0x79: ["JNS",["Ib"]],				0x7A: ["JP",["Ib"]],			0x7B: ["JNP",["Ib"]],
		0x7C: ["JL",["Ib"]],			0x7D: ["JNL",["Ib"]],				0x7E: ["JLE",["Ib"]],			0x7F: ["JNLE",["Ib"]],
		// 0x08
			// Immediate Group 1 (1A)
		/*0x80: ["#EXT_1", ["Eb","Ib"]],	0x81: ["#EXT_1", ["Ev","Iv"]],		0x82: ["#EXT_1", ["Ev","Ib"]],	0x83: ["#EXT_1", ["Ev","Ib"]],*/
		0x84: ["TEST", ["Eb","Gb"]],	0x85: ["TEST", ["Ev","Gv"]],		0x86: ["XCHG", ["Eb","Gb"]],	0x87: ["XCHG", ["Ev","Gv"]],
		0x88: ["MOV", ["Eb","Gb"]],		0x89: ["MOV", ["Ev","Gv"]],			0x8A: ["MOV", ["Gb","Eb"]],		0x8B: ["MOV", ["Gv","Ev"]],
		0x8C: ["MOV", ["Ew","Sw"]],		0x8D: ["LEA", ["Gv","M"]],			0x8E: ["MOV", ["Sw","Ew"]],		0x8F: ["POP",["Ev"]],
		// 0x09
		0x90: ["NOP"],					0x91: ["XCHG", ["eCX","eAX"]],		0x92: ["XCHG", ["eDX","eAX"]],	0x93: ["XCHG", ["eBX","eAX"]],
		0x94: ["XCHG", ["eSP","eAX"]],	0x95: ["XCHG", ["eBP","eAX"]],		0x96: ["XCHG", ["eSI","eAX"]],	0x97: ["XCHG", ["eDI","eAX"]],
		0x98: ["CBW"],					0x99: ["CWD"],						0x9A: ["CALLF_A",["Ap"]],		0x9B: ["WAIT"],
		0x9C: ["PUSHF",["Fv"]],			0x9D: ["POPF",["Fv"]],				0x9E: ["SAHF"],					0x9F: ["LAHF"],
		// 0x0A
		0xA0: ["MOV", ["AL","Ob"]],		0xA1: ["MOV", ["eAX","Ov"]],		0xA2: ["MOV", ["Ob","AL"]],		0xA3: ["MOV", ["Ov","eAX"]],
		0xA4: ["MOVS", ["Xb","Yb"]],	0xA5: ["MOVS", ["Xv","Yv"]],		0xA6: ["CMPS", ["Xb","Yb"]],	0xA7: ["CMPS", ["Xv","Yv"]],
		0xA8: ["TEST", ["AL","Ib"]],	0xA9: ["TEST", ["eAX","Iv"]],		0xAA: ["STOS", ["Yb","AL"]],	0xAB: ["STOS", ["Yv","eAX"]],
		0xAC: ["LODS", ["AL","Xb"]],	0xAD: ["LODS", ["eAX","Xv"]],		0xAE: ["SCAS", ["AL","Yb"]],	0xAF: ["SCAS", ["eAX","Xv"]],
		// 0x0B
		0xB0: ["MOV", ["AL","Ib"]],		0xB1: ["MOV", ["CL","Ib"]],			0xB2: ["MOV", ["DL","Ib"]],		0xB3: ["MOV", ["BL","Ib"]],
		0xB4: ["MOV", ["AH","Ib"]],		0xB5: ["MOV", ["CH","Ib"]],			0xB6: ["MOV", ["DH","Ib"]],		0xB7: ["MOV", ["BH","Ib"]],
		0xB8: ["MOV", ["eAX","Iv"]],	0xB9: ["MOV", ["eCX","Iv"]],		0xBA: ["MOV", ["eDX","Iv"]],	0xBB: ["MOV", ["eBX","Iv"]],
		0xBC: ["MOV", ["eSP","Iv"]],	0xBD: ["MOV", ["eBP","Iv"]],		0xBE: ["MOV", ["eSI","Iv"]],	0xBF: ["MOV", ["eDI","Iv"]],
		// 0x0C
			// Shift Group 2 (1A)
		/*0xC0: ["#EXT_2", ["Eb","Ib"]],	0xC1: ["#EXT_2", ["Ev","Ib"]],*/		0xC2: ["RETN_P",["Iw"]],		0xC3: ["RETN"],
		0xC4: ["LES", ["Gv","Mp"]],		0xC5: ["LDS", ["Gv","Mp"]],			/*0xC6: ["#EXT_11", ["Eb","Ib"]],	0xC7: ["#EXT_11", ["Ev","Iv"]],*/ // Group 11 (1A) - MOV
		0xC8: ["ENTER", ["Iw","Ib"]],	0xC9: ["LEAVE"],					0xCA: ["RETF_P",["Iw"]],		0xCB: ["RETF"],
		0xCC: ["INT",["3"]],			0xCD: ["INT",["Ib"]],				0xCE: ["INTO"],					0xCF: ["IRET"],
		// 0x0D
			// Shift Group 2 (1A)
		/*0xD0: ["#EXT_2", ["Eb","1"]],	0xD1: ["#EXT_2", ["Ev","1"]],		0xD2: ["#EXT_2", ["Eb","CL"]],	0xD3: ["#EXT_2", ["Ev","CL"]],*/
		0xD4: ["AAM",["Ib"]],			0xD5: ["AAD",["Ib"]],				0xD6: ["#RESERVED"],			0xD7: ["XLAT"],
			// ESC (Escape to coprocessor instruction set)
		0xD8: ["#RESERVED"],			0xD9: ["#RESERVED"],				0xDA: ["#RESERVED"],			0xDB: ["#RESERVED"],
		0xDC: ["#RESERVED"],			0xDD: ["#RESERVED"],				0xDE: ["#RESERVED"],			0xDF: ["#RESERVED"],
		// 0x0E
		0xE0: ["LOOPNE",["Jb"]],		0xE1: ["LOOPE",["Jb"]],				0xE2: ["LOOP",["Ib"]],			0xE3: ["JCXZ",["Jb"]],
		0xE4: ["IN", ["AL","Ib"]],		0xE5: ["IN", ["eAX","Ib"]],			0xE6: ["OUT", ["Ib","AL"]],		0xE7: ["OUT", ["Ib","eAX"]],
		0xE8: ["CALLN_R",["Jv"]],		0xE9: ["JMPN",["Jv"]],				0xEA: ["JMPF", ["Ap"]],			0xEB: ["JMPN",["Jb"]],
		0xEC: ["IN", ["AL","DX"]],		0xED: ["IN", ["eAX","DX"]],			0xEE: ["OUT", ["DX","AL"]],		0xEF: ["OUT", ["DX","eAX"]],
		// 0x0F
		/*0xF0: ["#LOCK"],*/					0xF1: ["#RESERVED"],				/*0xF2: ["#REPNE"],*/					/*0xF3: ["#REP"],*/
		0xF4: ["HLT"],					0xF5: ["CMC"],						/*0xF6: ["#EXT_3", ["Eb"], 0],	0xF7: ["#EXT_3", ["Ev"], 1],*/
		0xF8: ["CLC"],					0xF9: ["STC"],						0xFA: ["CLI"],					0xFB: ["STI"],
		0xFC: ["CLD"],					0xFD: ["STD"]						/*0xFE: ["#EXT_4"],0xFF: 			["#EXT_5"]*/
		};
	
	// Format: [ <opcode_mnemonic>, <operands> ]
	//	2-byte Intel operands have 0Fh as the first byte. Only the 2nd byte
	//	is used to index into this table.
	jsEmu.x86CPU.prototype.arr_mapOpcodes_2Byte = {
		
	};
	
	jsEmu.x86CPU.prototype.arr_mapOpcodes_1Byte_Extensions = [
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
			["INC",["Eb"]],				["DEC",["Eb"]],			["#RESERVED"],			["#RESERVED"],
				["#RESERVED"],			["#RESERVED"],			["#RESERVED"],			["#RESERVED"]
		], [	//5
			["INC",["Ev"]],				["DEC",["Ev"]],			["CALLN_AI",["Ev"]],	["CALLF_AI",["Ep"]],
				["JMP",["Ev"]],			["JMP FAR", ["Ep"]],	["PUSH",["Ev"]],		["#RESERVED"]
		], [	//6
			["SLDT",["Ew"]],			["STR",["Ew"]],			["LLDT",["Ew"]],		["LTR",["Ew"]],
				["VERR",["Ew"]],		["VERW",["Ew"]],		["#RESERVED"],			["#RESERVED"]
		], [	//7
			["SGDT",["Ms"]],			["SIDT",["Ms"]],		["LGDT",["Ms"]],		["LIDT",["Ms"]],
				["SMSW",["Ew"]],		["#RESERVED"],			["LMSW",["Ew"]],		["INVLPG",["Mb"]]
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
			["MOV", ["Ev","Iv"]],		["#RESERVED"],			["#RESERVED"],			["#RESERVED"],
				["#RESERVED"],			["#RESERVED"],			["#RESERVED"],			["#RESERVED"]
		], [	//12
			["#RESERVED"],				["#RESERVED"],			["psrlw", ["Pq","Ib"]],	["#RESERVED"],
				["psraw", ["Pq","Ib"]],	["#RESERVED"],			["psllw", ["Pq","Ib"]],	["#RESERVED"]
		], [	//13
			["#RESERVED"],				["#RESERVED"],			["psrld", ["Pq","Ib"]],	["#RESERVED"],
				["psrad", ["Pq","Ib"]],	["#RESERVED"],			["pslld", ["Pq","Ib"]],	["#RESERVED"]
		], [	//14
			["#RESERVED"],				["#RESERVED"],			["psrlq", ["Pq","Ib"]],	["#RESERVED"],
				["#RESERVED"],			["#RESERVED"],			["psllq", ["Pq","Ib"]],	["#RESERVED"]
		], [	//15
			["fxsave"],					["fxrstor"],			["ldmxcsr"],			["stmxcsr"],
				["#RESERVED"],			["#RESERVED"],			["#RESERVED"],			["#RESERVED"]
		], [	//16
			["prefetch",["NTA"]],		["prefetch",["T0"]],	["prefetch",["T1"]],	["prefetch",["T2"]],
				["#RESERVED"],			["#RESERVED"],			["#RESERVED"],			["#RESERVED"]
		]
	];
	/* ========== /Opcode tables ========== */
	
	// Map from typeCodes to operand sizes
	jsEmu.x86CPU.prototype.hsh_size_operand = {
		"a": 4		// Two word or 2 dword operands in memory, depending on operand-size attr
		, "b": 1	// Byte, regardless of operand-size attr
		, "c": 1	// Byte or word, depending on operand-size attr
		, "d": 4	// Dword, regardless of operand-size attr
		, "dq": 16	// Double-quadword, regardless of operand-size attr
		, "p": 4	// 32-bit or 48-bit pointer, depending on operand-size attr
		, "pi": 4	// Quadword MMX register (eg. mm0)
		, "ps": 16	// 128-bit packed floating-point-precision data
		, "q": 8	// Quadword, regardless of operand-size attr
		, "s": 6	// 6-byte pseudo-descriptor
		, "ss": 0	// Scalar element of 128-bit packed FP single-precision data
		, "si": 0	// Dword integer register (eg. EAX)
		, "v": 2	// Word or dword, depending on operand-size attr
		, "w": 2	// Word, regardless of operand-size attr
	};
	// List of typeCodes which should be double-sized if operand-size attribute is set
	//	( ie. multiply their size in bytes from above hash by 2 )
	jsEmu.x86CPU.prototype.hsh_flgDependsOnOperandSizeAttr = {
		"a": 8
		, "c": 2
		, "p": 6
		, "v": 4
	};
	
	jsEmu.x86CPU.prototype.hsh_addrmethodRegister = {
			"C": "CONTROL"		// Control register
			, "D": "DEBUG"		// Debug register
			//, "Q": "MMX"		// MMX register
			//, "W": "SIMD"		// SIMD register
			, "G": "GENERAL"	// General-purpose register
			, "P": "PQWORD_MMX"	// Packed quadword MMX register
			, "S": "SEGMENT"	// Segment register
			, "T": "TEST"		// Test register
			, "V": "SIMD"		// SIMD floating-point register
		};
	
	var hsh = {};
	var base
	jsEmu.x86CPU.prototype.arr_mapOpcodeExtensions = hsh;
	/* ====== Ext. group 1 - Immediate Grp 1 ( 1A ) ====== */
	base = 0x80 << 3;
	hsh[base | 0x00] = ["ADD", ["Eb", "Ib"]]; 	hsh[base | 0x01] = ["OR", ["Eb", "Ib"]];	hsh[base | 0x02] = ["ADC", ["Eb", "Ib"]];
	hsh[base | 0x03] = ["SBB", ["Eb", "Ib"]];	hsh[base | 0x04] = ["AND", ["Eb", "Ib"]]; 	hsh[base | 0x05] = ["SUB", ["Eb", "Ib"]];
	hsh[base | 0x06] = ["XOR", ["Eb", "Ib"]];	hsh[base | 0x07] = ["CMP", ["Eb", "Ib"]];
	base = 0x81 << 3;
	hsh[base | 0x00] = ["ADD", ["Ev", "Iv"]]; 	hsh[base | 0x01] = ["OR", ["Ev", "Iv"]];	hsh[base | 0x02] = ["ADC", ["Ev", "Iv"]];
	hsh[base | 0x03] = ["SBB", ["Ev", "Iv"]];	hsh[base | 0x04] = ["AND", ["Ev", "Iv"]]; 	hsh[base | 0x05] = ["SUB", ["Ev", "Iv"]];
	hsh[base | 0x06] = ["XOR", ["Ev", "Iv"]];	hsh[base | 0x07] = ["CMP", ["Ev", "Iv"]];
	base = 0x82 << 3;
	hsh[base | 0x00] = ["ADD", ["Ev", "Ib"]]; 	hsh[base | 0x01] = ["OR", ["Ev", "Ib"]];	hsh[base | 0x02] = ["ADC", ["Ev", "Ib"]];
	hsh[base | 0x03] = ["SBB", ["Ev", "Ib"]];	hsh[base | 0x04] = ["AND", ["Ev", "Ib"]]; 	hsh[base | 0x05] = ["SUB", ["Ev", "Ib"]];
	hsh[base | 0x06] = ["XOR", ["Ev", "Ib"]];	hsh[base | 0x07] = ["CMP", ["Ev", "Ib"]];
	base = 0x83 << 3;
	hsh[base | 0x00] = ["ADD", ["Ev", "Ib"]]; 	hsh[base | 0x01] = ["OR", ["Ev", "Ib"]];	hsh[base | 0x02] = ["ADC", ["Ev", "Ib"]];
	hsh[base | 0x03] = ["SBB", ["Ev", "Ib"]];	hsh[base | 0x04] = ["AND", ["Ev", "Ib"]]; 	hsh[base | 0x05] = ["SUB", ["Ev", "Ib"]];
	hsh[base | 0x06] = ["XOR", ["Ev", "Ib"]];	hsh[base | 0x07] = ["CMP", ["Ev", "Ib"]];
	/* ====== /Ext. group 1 - Immediate Grp 1 ( 1A ) ====== */
	/* ====== Ext. group 2 - Shift Grp 2 ( 1A ) ====== */
	base = 0xC0 << 3;
	hsh[base | 0x00] = ["ROL", ["Eb", "Ib"]]; 	hsh[base | 0x01] = ["ROR", ["Eb", "Ib"]];	hsh[base | 0x02] = ["RCL", ["Eb", "Ib"]];
	hsh[base | 0x03] = ["RCR", ["Eb", "Ib"]];	hsh[base | 0x04] = ["SHL", ["Eb", "Ib"]]; 	hsh[base | 0x05] = ["SHR", ["Eb", "Ib"]];
	hsh[base | 0x06] = ["???", ["Eb", "Ib"]];	hsh[base | 0x07] = ["SAR", ["Eb", "Ib"]];
	base = 0xC1 << 3;
	hsh[base | 0x00] = ["ROL", ["Ev", "Ib"]]; 	hsh[base | 0x01] = ["ROR", ["Ev", "Ib"]];	hsh[base | 0x02] = ["RCL", ["Ev", "Ib"]];
	hsh[base | 0x03] = ["RCR", ["Ev", "Ib"]];	hsh[base | 0x04] = ["SHL", ["Ev", "Ib"]]; 	hsh[base | 0x05] = ["SHR", ["Ev", "Ib"]];
	hsh[base | 0x06] = ["???", ["Ev", "Ib"]];	hsh[base | 0x07] = ["SAR", ["Ev", "Ib"]];
	
	base = 0xD0 << 3;
	hsh[base | 0x00] = ["ROL", ["Eb", 1]]; 	hsh[base | 0x01] = ["ROR", ["Eb", 1]];	hsh[base | 0x02] = ["RCL", ["Eb", 1]];
	hsh[base | 0x03] = ["RCR", ["Eb", 1]];	hsh[base | 0x04] = ["SHL", ["Eb", 1]]; 	hsh[base | 0x05] = ["SHR", ["Eb", 1]];
	hsh[base | 0x06] = ["???", ["Eb", 1]];	hsh[base | 0x07] = ["SAR", ["Eb", 1]];
	base = 0xD1 << 3;
	hsh[base | 0x00] = ["ROL", ["Ev", 1]]; 	hsh[base | 0x01] = ["ROR", ["Ev", 1]];	hsh[base | 0x02] = ["RCL", ["Ev", 1]];
	hsh[base | 0x03] = ["RCR", ["Ev", 1]];	hsh[base | 0x04] = ["SHL", ["Ev", 1]]; 	hsh[base | 0x05] = ["SHR", ["Ev", 1]];
	hsh[base | 0x06] = ["???", ["Ev", 1]];	hsh[base | 0x07] = ["SAR", ["Ev", 1]];
	base = 0xD2 << 3;
	hsh[base | 0x00] = ["ROL", ["Eb", "CL"]]; 	hsh[base | 0x01] = ["ROR", ["Eb", "CL"]];	hsh[base | 0x02] = ["RCL", ["Eb", "CL"]];
	hsh[base | 0x03] = ["RCR", ["Eb", "CL"]];	hsh[base | 0x04] = ["SHL", ["Eb", "CL"]]; 	hsh[base | 0x05] = ["SHR", ["Eb", "CL"]];
	hsh[base | 0x06] = ["???", ["Eb", "CL"]];	hsh[base | 0x07] = ["SAR", ["Eb", "CL"]];
	base = 0xD3 << 3;
	hsh[base | 0x00] = ["ROL", ["Ev", "CL"]]; 	hsh[base | 0x01] = ["ROR", ["Ev", "CL"]];	hsh[base | 0x02] = ["RCL", ["Ev", "CL"]];
	hsh[base | 0x03] = ["RCR", ["Ev", "CL"]];	hsh[base | 0x04] = ["SHL", ["Ev", "CL"]]; 	hsh[base | 0x05] = ["SHR", ["Ev", "CL"]];
	hsh[base | 0x06] = ["???", ["Ev", "CL"]];	hsh[base | 0x07] = ["SAR", ["Ev", "CL"]];
	/* ====== /Ext. group 2 - Shift Grp 2 ( 1A ) ====== */
	
	/* ====== Ext. group 3 - Unary Grp 3 ( 1A ) ====== */
	base = 0xF6 << 3;
	hsh[base | 0x00] = ["TEST", ["Eb", "Ib"]]; 	hsh[base | 0x01] = ["???", ["Eb"]];			hsh[base | 0x02] = ["NOT", ["Eb"]];
	hsh[base | 0x03] = ["NEG", ["Eb"]];			hsh[base | 0x04] = ["MUL", ["Eb", "AL"]]; 	hsh[base | 0x05] = ["IMUL", ["Eb", "AL"]];
	hsh[base | 0x06] = ["DIV", ["Eb", "AL"]];	hsh[base | 0x07] = ["IDIV", ["Eb", "AL"]];
	base = 0xF7 << 3;
	hsh[base | 0x00] = ["TEST", ["Ev", "Iv"]]; 	hsh[base | 0x01] = ["???", ["Ev"]];			hsh[base | 0x02] = ["NOT", ["Ev"]];
	hsh[base | 0x03] = ["NEG", ["Ev"]];			hsh[base | 0x04] = ["MUL", ["Ev", "eAX"]];	hsh[base | 0x05] = ["IMUL", ["Ev", "eAX"]];
	hsh[base | 0x06] = ["DIV", ["Ev", "eAX"]];	hsh[base | 0x07] = ["IDIV", ["Ev", "eAX"]];
	/* ====== /Ext. group 3 - Unary Grp 3 ( 1A ) ====== */
	
	/* ====== Ext. group 4 - INC/DEC Grp 4 ( 1A ) ====== */
	base = 0xFE << 3;
	hsh[base | 0x00] = ["INC", ["Eb"]]; 		hsh[base | 0x01] = ["DEC", ["Eb"]];			hsh[base | 0x02] = ["???", ["Eb"]];
	hsh[base | 0x03] = ["???", ["Eb"]];			hsh[base | 0x04] = ["???", ["Eb"]]; 		hsh[base | 0x05] = ["???", ["Eb"]];
	hsh[base | 0x06] = ["???", ["Eb"]];			hsh[base | 0x07] = ["???", ["Eb"]];
	/* ====== /Ext. group 4 - INC/DEC Grp 4 ( 1A ) ====== */
	
	/* ====== Ext. group 5 - INC/DEC Grp 5 ( 1A ) ====== */
	base = 0xFF << 3;
	hsh[base | 0x00] = ["INC", ["Ev"]]; 		hsh[base | 0x01] = ["DEC", ["Ev"]];			hsh[base | 0x02] = ["CALLN_AI", ["Ev"]];
	hsh[base | 0x03] = ["CALLF_AI", ["Ep"]];	hsh[base | 0x04] = ["JMPN", ["Ev"]]; 		hsh[base | 0x05] = ["JMPF", ["Ep"]];
	hsh[base | 0x06] = ["PUSH", ["Ev"]];		hsh[base | 0x07] = ["???", ["Eb"]];
	/* ====== /Ext. group 5 - INC/DEC Grp 5 ( 1A ) ====== */
	
	/* ====== Ext. group 11 - MOV Grp 11 ( 1A ) ====== */
	base = 0xC6 << 3;
	hsh[base | 0x00] = ["MOV", ["Eb", "Ib"]]; 	hsh[base | 0x01] = ["???", ["Eb", "Ib"]];	hsh[base | 0x02] = ["???", ["Eb", "Ib"]];
	hsh[base | 0x03] = ["???", ["Eb", "Ib"]];	hsh[base | 0x04] = ["???", ["Eb", "Ib"]]; 	hsh[base | 0x05] = ["???", ["Eb", "Ib"]];
	hsh[base | 0x06] = ["???", ["Eb", "Ib"]];	hsh[base | 0x07] = ["???", ["Eb", "Ib"]];
	base = 0xC7 << 3;
	hsh[base | 0x00] = ["MOV", ["Ev", "Iv"]]; 	hsh[base | 0x01] = ["???", ["Ev", "Iv"]];	hsh[base | 0x02] = ["???", ["Ev", "Iv"]];
	hsh[base | 0x03] = ["???", ["Ev", "Iv"]];	hsh[base | 0x04] = ["???", ["Ev", "Iv"]]; 	hsh[base | 0x05] = ["???", ["Ev", "Iv"]];
	hsh[base | 0x06] = ["???", ["Ev", "Iv"]];	hsh[base | 0x07] = ["???", ["Ev", "Iv"]];
	/* ====== /Ext. group 11 - MOV Grp 11 ( 1A ) ====== */
	
	/* ==== Exports ==== */
	
	/* ==== /Exports ==== */
});

// Add Module to emulator
jsEmu.AddModule(mod);