/*
 *	jsEmu - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: CPU Instruction class support
 */
var mod = new jsEmu.PrimaryModule( function ( jsEmu ) {
	/* ========== Opcode tables ========== */
	// Format: [<opcode_mnemonic>, <operands>, <operand-size attribute>, <address-size attribute>]
	jsEmu.x86CPU.prototype.arr_mapOpcodes_1Byte = [
			[	//0x00
				["ADD", ["Eb","Gb"]],		["ADD", ["Ev","Gv"]],	["ADD", ["Gb","Eb"]],	["ADD", ["Gv","Ev"]],
					["ADD", ["AL","Ib"]],	["ADD", ["eAX","Iv"]],	["PUSH",["ES"]],		["POP",["ES"]],
				["OR", ["Eb","Gb"]],		["OR", ["Ev","Gv"]],	["OR", ["Gb","Eb"]],	["OR", ["Gv","Ev"]],
					["OR", ["AL","Ib"]],	["OR", ["eAX","Iv"]],	["PUSH",["CS"]],		["#ESCAPE"]		//2-byte escape (refer to 2-byte opcode map)
			], [	//0x01
				["ADC", ["Eb","Gb"]],		["ADC", ["Ev","Gv"]],	["ADC", ["Gb","Eb"]],	["ADC", ["Gv","Ev"]],
					["ADC", ["AL","Ib"]],	["ADC", ["eAX","Iv"]],	["PUSH",["SS"]],		["POP",["SS"]],
				["SBB", ["Eb","Gb"]],		["SBB", ["Ev","Gv"]],	["SBB", ["Gb","Eb"]],	["SBB", ["Gv","Ev"]],
					["SBB", ["AL","Ib"]],	["SBB", ["eAX","Iv"]],	["PUSH",["DS"]],		["POP",["DS"]]
			], [	//0x02
				["AND", ["Eb","Gb"]],		["AND", ["Ev","Gv"]],	["AND", ["Gb","Eb"]],	["AND", ["Gv","Ev"]],
					["AND", ["AL","Ib"]],	["AND", ["eAX","Iv"]],	["#SEG=",["ES"]],		["DAA"],
				["SUB", ["Eb","Gb"]],		["SUB", ["Ev","Gv"]],	["SUB", ["Gb","Eb"]],	["SUB", ["Gv","Ev"]],
					["SUB", ["AL","Ib"]],	["SUB", ["eAX","Iv"]],	["#SEG=",["CS"]],		["DAS"]
			], [	//0x03
				["XOR", ["Eb","Gb"]],		["XOR", ["Ev","Gv"]],	["XOR", ["Gb","Eb"]],	["XOR", ["Gv","Ev"]],	//NB: ([33F6 XOR SI, SI] decoded incorrectly
																													//- Intel docs say Gb,Ev - typo?)
					["XOR", ["AL","Ib"]],	["XOR", ["eAX","Iv"]],	["#SEG=",["SS"]],		["AAA"],
				["CMP", ["Eb","Gb"]],		["CMP", ["Ev","Gv"]],	["CMP", ["Gb","Eb"]],	["CMP", ["Gv","Ev"]],
					["CMP", ["AL","Ib"]],	["CMP", ["eAX","Iv"]],	["#SEG=",["DS"]],		["AAS"]
			], [	//0x04
				["INC",["eAX"]],			["INC",["eCX"]],		["INC",["eDX"]],		["INC",["eBX"]],
					["INC",["eSP"]],		["INC",["eBP"]],		["INC",["eSI"]],		["INC",["eDI"]],
				["DEC",["eAX"]],			["DEC",["eCX"]],		["DEC",["eDX"]],		["DEC",["eBX"]],
					["DEC",["eSP"]],		["DEC",["eBP"]],		["DEC",["eSI"]],		["DEC",["eDI"]]
			], [	//0x05
				["PUSH",["eAX"]],			["PUSH",["eCX"]],		["PUSH",["eDX"]],		["PUSH",["eBX"]],
					["PUSH",["eSP"]],		["PUSH",["eBP"]],		["PUSH",["eSI"]],		["PUSH",["eDI"]],
				["POP",["eAX"]],			["POP",["eCX"]],		["POP",["eDX"]],		["POP",["eBX"]],
					["POP",["eSP"]],		["POP",["eBP"]],		["POP",["eSI"]],		["POP",["eDI"]]
			], [	//0x06
				["PUSHA"],					["POPA"],				["BOUND", ["Gv","Ma"]],	["ARPL", ["Ew","Gw"]],
					["#SEG=",["FS"]],		["#SEG=",["GS"]],		["#OP_SIZE"],			["#ADDR_SIZE"],
				["PUSH",["Iv"]],			["IMUL", ["Gv","Ev","Iv"]],	["PUSH",["Ib"]],		["IMUL", ["Gv","Ev","Ib"]],
					["INS", ["Yb","DX"]],	["INS", ["Yv","DX"]],	["OUTS", ["DX","Xb"]],	["OUTS", ["DX","Xv"]]
			], [	//0x07
				["JO",["Ib"]],				["JNO",["Ib"]],			["JB",["Ib"]],			["JAE",["Ib"]],
					["JE",["Ib"]],			["JNE",["Ib"]],			["JBE",["Ib"]],			["JNBE",["Ib"]],
				["JS",["Ib"]],				["JNS",["Ib"]],			["JPE",["Ib"]],			["JPO",["Ib"]],
					["JL",["Ib"]],			["JNL",["Ib"]],			["JNG",["Ib"]],			["JG",["Ib"]]
			], [	//0x08
				//Immediate Group 1 (1A)
				["#EXT_1", ["Eb","Ib"]],	["#EXT_1", ["Ev","Iv"]],["#EXT_1", ["Ev","Ib"]],["#EXT_1", ["Ev","Ib"]],
					["TEST", ["Eb","Gb"]],	["TEST", ["Ev","Gv"]],	["XCHG", ["Eb","Gb"]],	["XCHG", ["Ev","Gv"]],
				["MOV", ["Eb","Gb"]],		["MOV", ["Ev","Gv"]],	["MOV", ["Gb","Eb"]],	["MOV", ["Gv","Ev"]],
					["MOV", ["Ew","Sw"]],	["LEA", ["Gv","M"]],	["MOV", ["Sw","Ew"]],	["POP",["Ev"]]
			], [	//0x09
				["NOP"],					["XCHG", ["eCX","eAX"]],["XCHG", ["eDX","eAX"]],["XCHG", ["eBX","eAX"]],
					["XCHG", ["eSP","eAX"]],["XCHG", ["eBP","eAX"]],["XCHG", ["eSI","eAX"]],["XCHG", ["eDI","eAX"]],
				["CBW"],					["CWD"],				["CALL FAR",["Ap"]],	["WAIT"],
					["PUSHF",["Fv"]],		["POPF",["Fv"]],		["SAHF"],				["LAHF"]
			], [	//0x0A
				["MOV", ["AL","Ob"]],		["MOV", ["eAX","Ov"]],	["MOV", ["Ob","AL"]],	["MOV", ["Ov","eAX"]],
					["MOVS", ["Xb","Yb"]],	["MOVS", ["Xv","Yv"]],	["CMPS", ["Xb","Yb"]],	["CMPS", ["Xv","Yv"]],
				["TEST", ["AL","Ib"]],		["TEST", ["eAX","Iv"]],	["STOS", ["Yb","AL"]],	["STOS", ["Yv","eAX"]],
					["LODS", ["AL","Xb"]],	["LODS", ["eAX","Xv"]],	["SCAS", ["AL","Yb"]],	["SCAS", ["eAX","Xv"]]
			], [	//0x0B
				["MOV", ["AL","Ib"]],		["MOV", ["CL","Ib"]],	["MOV", ["DL","Ib"]],	["MOV", ["BL","Ib"]],
					["MOV", ["AH","Ib"]],	["MOV", ["CH","Ib"]],	["MOV", ["DH","Ib"]],	["MOV", ["BH","Ib"]],
				["MOV", ["eAX","Iv"]],		["MOV", ["eCX","Iv"]],	["MOV", ["eDX","Iv"]],	["MOV", ["eBX","Iv"]],
					["MOV", ["eSP","Iv"]],	["MOV", ["eBP","Iv"]],	["MOV", ["eSI","Iv"]],	["MOV", ["eDI","Iv"]]
			], [	//0x0C
				//Shift Group 2 (1A)
				["#EXT_2", ["Eb","Ib"]],	["#EXT_2", ["Ev","Ib"]],["RETN_P",["Iw"]],		["RETN"],
					["LES", ["Gv","Mp"]],	["LDS", ["Gv","Mp"]],	["#EXT_11", ["Eb","Ib"]],["#EXT_11", ["Ev","Iv"]],//Group 11 (1A) - MOV
				["ENTER", ["Iw","Ib"]],		["LEAVE"],				["RETF_P",["Iw"]],		["RETF"],
					["INT",["3"]],			["INT",["Ib"]],			["INTO"],				["IRET"]
			], [	//0x0D
				//Shift Group 2 (1A)
				["#EXT_2", ["Eb","1"]],		["#EXT_2", ["Ev","1"]],	["#EXT_2", ["Eb","CL"]],["#EXT_2", ["Ev","CL"]],
					["AAM",["Ib"]],			["AAD",["Ib"]],			["#RESERVED"],			["XLAT"],
				//ESC (Escape to coprocessor instruction set)
				["#RESERVED"],				["#RESERVED"],			["#RESERVED"],			["#RESERVED"],
					["#RESERVED"],			["#RESERVED"],			["#RESERVED"],			["#RESERVED"]
			], [	//0x0E
				["LOOPNE",["Jb"]],			["LOOPE",["Jb"]],		["LOOP",["Ib"]],		["JCXZ",["Jb"]],
					["IN", ["AL","Ib"]],	["IN", ["eAX","Ib"]],	["OUT", ["Ib","AL"]],	["OUT", ["Ib","eAX"]],
				["CALL NEAR",["Jv"]],		["JMP",["Jv"]],	["JMP FAR", ["Ap"]],	["JMP",["Jb"]],
					["IN", ["AL","DX"]],	["IN", ["eAX","DX"]],	["OUT", ["DX","AL"]],	["OUT", ["DX","eAX"]]
			], [	//0x0F
				["#LOCK"],					["#RESERVED"],			["#REPNE"],				["#REP"],
					["HLT"],				["CMC"],				["#EXT_3", ["Eb"], 0],["#EXT_3", ["Ev"], 1],
				["CLC"],					["STC"],				["CLI"],				["STI"],
					["CLD"],				["STD"],				["#EXT_4"/*INC/DEC Group 4 (1A)*/],["#EXT_5"/*INC/DEC Group 5 (1A)*/]
			]
		];
	/*
	jsEmu.x86CPU.prototype.arr_mapOpcodes_2Byte = [
		[
			[""],	//Group 6 (1A)
			[""],	//Group 7 (1A)
			["LAR", ["Gv","Ew"]],
			["LSL", ["Gv","Ew"]],
			["#RESERVED"],
			["#RESERVED"],
			
			["CLTS"],
			["#RESERVED"]
			
		]
	];
	*/
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
				["INC",["Ev"]],				["DEC",["Ev"]],			["CALL NEAR",["Ev"]],	["CALL FAR",["Ep"]],
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
			],
		];
	/* ========== /Opcode tables ========== */
	
	// Map from typeCodes to operand sizes
	jsEmu.x86CPU.prototype.hsh_size_operand = {
			"a": 4		// Two word or 2 dword operands in memory, depending on operand-size attr
			, "b": 1	// Byte, regardless of operand-size attr
			, "c": 1	// Byte or word, depending on operand-size attr
			, "d": 4	// Dword, regardless of operand-size attr
			, "dq": 16	// Double-quadword, regardless of operand-size attr
			, "p": 2	// 32-bit or 48-bit pointer, depending on operand-size attr
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
			"a": null
			, "c": null
			, "p": null
			, "v": null
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
	
	/* ==== Exports ==== */
	
	/* ==== /Exports ==== */
});

// Add Module to emulator
jsEmu.AddModule(mod);