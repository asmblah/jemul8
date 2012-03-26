/*
 *	jsGL - JavaScript Graphics Layer, based on the specification for the OpenGL® API
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: jsEmu ( x86) Main
 */

// Scope encapsulator
new function () {
	/* ==== Malloc ==== */
	var xmlhttp = window.XMLHttpRequest ? new window.XMLHttpRequest() : null;
	// System RAM - 1MB limit for now
	var numKilobytesMemory = 1 * 1024;
	// Define BIOS' machine Equipment List word ( 16 bits wide )
	var wordEquipmentList = new Bitfield(16);
	// Allocate memory for emulated RAM
	var memData = new Array(numKilobytesMemory * 1024);
	// Instruction cache ( decoded Instructions are stored indexed by absolute memory address
	//	to avoid needing to redecode Instructions executed more than once ( eg. in a loop ).
	var arr_insnCache = [];
	
	// Format: [<opcode_mnemonic>, <operands>, <operand-size attribute>, <address-size attribute>]
	var arr_mapOpcodes_1Byte = [
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
				["PUSH",["Iv"]],			["IMUL","Gv,Ev,Iv"],	["PUSH",["Ib"]],		["IMUL", "Gv,Ev,Ib"],
					["INS", ["Yb","DX"]],	["INS", "Yv.DX"],		["OUTS", ["DX","Xb"]],	["OUTS", ["DX","Xv"]]
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
				["#EXT_2", ["Eb","Ib"]],	["#EXT_2", ["Ev","Ib"]],["RET NEAR",["Iw"]],	["RET NEAR"],
					["LES", ["Gv","Mp"]],	["LDS", ["Gv","Mp"]],	["#EXT_11", ["Eb","Ib"]],["#EXT_11", ["Ev","Iv"]],//Group 11 (1A) - MOV
				["ENTER", ["Iw","Ib"]],		["LEAVE"],				["RET FAR",["Iw"]],		["RET FAR"],
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
				["CALL NEAR",["Jv"]],		["JMP NEAR",["Jv"]],	["JMP", ["Ap"]/*JMP far*/],	["JMP SHORT",["Jb"]],
					["IN", ["AL","DX"]],	["IN", ["eAX","DX"]],	["OUT", ["DX","AL"]],	["OUT", ["DX","eAX"]]
			], [	//0x0F
				["LOCK"],					["#RESERVED"],			["#REPNE"],				["#REP"],
					["HLT"],				["CMC"],				["#EXT_3", ["Eb"], 0],["#EXT_3", ["Ev"], 1],
				["CLC"],					["STC"],				["CLI"],				["STI"],
					["CLD"],				["STD"],				["#EXT_4"/*INC/DEC Group 4 (1A)*/],["#EXT_5"/*INC/DEC Group 5 (1A)*/]
			]
		];
	/*
	var arr_mapOpcodes_2Byte =
	[
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
	var arr_mapOpcodes_1Byte_Extensions = [
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
					["JMP NEAR",["Ev"]],	["JMP", ["Ep"]/*JMP FAR*/],	["PUSH",["Ev"]],		["#RESERVED"]
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
				["#RESERVED"],				["CMPXCH8", "B Mq"],	["#RESERVED"],			["#RESERVED"],
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
	// Emulated x86 IA_32 CPU
	//	( based on an Intel 80486 / i486 )
	var CPU = {
			// Hash of CPU registers, map by name
			hsh_reg: {}
		};
	// Emulated BIOS
	//	( based on Phoenix BIOS )
	var BIOS = {
			// Status of last BIOS disk operation
			//	 ( 0h being success )
			statusDiskLast: 0x00
		};
	/* ==== /Malloc ==== */
	window.CPU=CPU;
	// Accumulator
	CPU.EAX = CPU.hsh_reg["EAX"] = new Register("EAX", 4);
	CPU.AX = CPU.hsh_reg["AX"] = new SubRegister("AX", 2, CPU.EAX, 0xFFFF, 0);
	CPU.AH = CPU.hsh_reg["AH"] = new SubRegister("AH", 1, CPU.EAX, 0xFF, 1);
	CPU.AL = CPU.hsh_reg["AL"] = new SubRegister("AL", 1, CPU.EAX, 0xFF, 0);
	// Base
	CPU.EBX = CPU.hsh_reg["EBX"] = new Register("EBX", 4);
	CPU.BX = CPU.hsh_reg["BX"] = new SubRegister("BX", 2, CPU.EBX, 0xFFFF, 0);
	CPU.BH = CPU.hsh_reg["BH"] = new SubRegister("BH", 1, CPU.EBX, 0xFF, 1);
	CPU.BL = CPU.hsh_reg["BL"] = new SubRegister("BL", 1, CPU.EBX, 0xFF, 0);
	// Counter
	CPU.ECX = CPU.hsh_reg["ECX"] = new Register("ECX", 4);
	CPU.CX = CPU.hsh_reg["CX"] = new SubRegister("CX", 2, CPU.ECX, 0xFFFF, 0);
	CPU.CH = CPU.hsh_reg["CH"] = new SubRegister("CH", 1, CPU.ECX, 0xFF, 1);
	CPU.CL = CPU.hsh_reg["CL"] = new SubRegister("CL", 1, CPU.ECX, 0xFF, 0);
	// Data
	CPU.EDX = CPU.hsh_reg["EDX"] = new Register("EDX", 4);
	CPU.DX = CPU.hsh_reg["DX"] = new SubRegister("DX", 2, CPU.EDX, 0xFFFF, 0);
	CPU.DH = CPU.hsh_reg["DH"] = new SubRegister("DH", 1, CPU.EDX, 0xFF, 1);
	CPU.DL = CPU.hsh_reg["DL"] = new SubRegister("DL", 1, CPU.EDX, 0xFF, 0);
	// Base pointer
	CPU.EBP = CPU.hsh_reg["EBP"] = new Register("EBP", 4);
	CPU.BP = CPU.hsh_reg["BP"] = new SubRegister("BP", 2, CPU.EBP, 0xFFFF, 0);
	// Dest. index
	CPU.EDI = CPU.hsh_reg["EDI"] = new Register("EDI", 4);
	CPU.DI = CPU.hsh_reg["DI"] = new SubRegister("DI", 2, CPU.EDI, 0xFFFF, 0);
	// Source index
	CPU.ESI = CPU.hsh_reg["ESI"] = new Register("ESI", 4);
	CPU.SI = CPU.hsh_reg["SI"] = new SubRegister("SI", 2, CPU.ESI, 0xFFFF, 0);
	// Stack pointer
	CPU.ESP = CPU.hsh_reg["ESP"] = new Register("ESP", 4);
	CPU.SP = CPU.hsh_reg["SP"] = new SubRegister("SP", 2, CPU.ESP, 0xFFFF, 0);
	
	// Code segment
	CPU.CS = CPU.hsh_reg["CS"] = new Register("CS", 2);
	// Data segment
	CPU.DS = CPU.hsh_reg["DS"] = new Register("DS", 2);
	// Extra segment
	CPU.ES = CPU.hsh_reg["ES"] = new Register("ES", 2);
	// "FS" segment
	CPU.FS = CPU.hsh_reg["FS"] = new Register("FS", 2);
	// "GS" segment
	CPU.GS = CPU.hsh_reg["GS"] = new Register("GS", 2);
	// Stack segment
	CPU.SS = CPU.hsh_reg["SS"] = new Register("SS", 2);
	
	// Flags register
	CPU.EFLAGS = CPU.hsh_reg["EFLAGS"] = new Register("EFLAGS", 2);
	// Carry flag
	CPU.CF = CPU.hsh_reg["CF"] = new BitFlag("CF", CPU.EFLAGS, 1);
	// Unknown(1) flag
	CPU.UF1 = CPU.hsh_reg["UF1"] = new BitFlag("UF1", CPU.EFLAGS, 2);
	// Parity flag
	CPU.PF = CPU.hsh_reg["PF"] = new BitFlag("PF", CPU.EFLAGS, 4);
	// Unknown(2) flag
	CPU.UF2 = CPU.hsh_reg["UF2"] = new BitFlag("UF2", CPU.EFLAGS, 8);
	// Auxiliary flag
	CPU.AF = CPU.hsh_reg["AF"] = new BitFlag("AF", CPU.EFLAGS, 16);
	// Unknown(3) flag
	CPU.UF3 = CPU.hsh_reg["UF3"] = new BitFlag("UF3", CPU.EFLAGS, 32);
	// Zero flag
	CPU.ZF = CPU.hsh_reg["ZF"] = new BitFlag("ZF", CPU.EFLAGS, 64);
	// Sign flag
	CPU.SF = CPU.hsh_reg["SF"] = new BitFlag("SF", CPU.EFLAGS, 128);
	// Trap flag
	CPU.TF = CPU.hsh_reg["TF"] = new BitFlag("TF", CPU.EFLAGS, 256);
	// Interrupt flag
	CPU.IF = CPU.hsh_reg["IF"] = new BitFlag("IF", CPU.EFLAGS, 512);
	// Direction flag
	CPU.DF = CPU.hsh_reg["DF"] = new BitFlag("DF", CPU.EFLAGS, 1024);
	// Overflow flag
	CPU.OF = CPU.hsh_reg["OF"] = new BitFlag("OF", CPU.EFLAGS, 2048);
	// IOPL ( I/O Privilege Level ) flag - Intel 286+ only
	CPU.IOPL = CPU.hsh_reg["IOPL"] = new BitFlag("IOPL", CPU.EFLAGS, 4096);
	// NT ( Nested Task ) flag - Intel 286+ only
	CPU.NT = CPU.hsh_reg["NT"] = new BitFlag("NT", CPU.EFLAGS, 8192);
	
	// Map from typeCodes to operand sizes
	CPU.hsh_size_operand = {
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
	CPU.hsh_flgDependsOnOperandSizeAttr = {
			"a": null
			, "c": null
			, "p": null
			, "v": null
		};
	
	CPU.hsh_addrmethodRegister = {
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
	
	// Indexes in array correspond with ModR/M Reg field
	CPU.arr_regOrdinals_Byte = [
			CPU.AL, CPU.CL, CPU.DL, CPU.BL
			, CPU.AH, CPU.CH, CPU.DH, CPU.BH
		];
	CPU.arr_regOrdinals_Word = [
			CPU.AX, CPU.CX, CPU.DX, CPU.BX
			, CPU.SP, CPU.BP
			, CPU.SI, CPU.DI
		];
	CPU.arr_regOrdinals_Segment = [
			CPU.ES, CPU.CS, CPU.SS, CPU.DS, CPU.FS, CPU.GS
		];
	
	// Internal emulated native JS interrupt handlers for BIOS and CPU
	//	( NB - emulator knows to lookup in this hash because an unmodified Interrupt Vector Table entry
	//	will have a segment:offset address of 0000h:0000h; this is invalid as it points inside the IVT itself. )
	CPU.hsh_InterruptHandler = {
			// ( CPU ) Divide by Zero
			0x00: function () {
				throw new Error("CPU interrupt 'Divide by Zero' - unsupported.");
			// ( CPU ) Single step
			}, 0x01: function () {
				throw new Error("CPU interrupt 'Single step' - unsupported.");
			// ( CPU ) Non-maskable Interrupt ( NMI )
			}, 0x02: function () {
				throw new Error("CPU interrupt 'Non-maskable interrupt/NMI' - unsupported.");
			// ( CPU ) Breakpoint Instruction
			}, 0x03: function () {
				throw new Error("CPU interrupt 'Breakpoint instruction' - unsupported.");
			// ( CPU ) Overflow Instruction
			}, 0x04: function () {
				throw new Error("CPU interrupt 'Overflow instruction' - unsupported.");
			// ( BIOS/Software ) Print Screen
			}, 0x04: function () {
				throw new Error("BIOS interrupt 'Print Screen' - unsupported.");
			// ( BIOS ) Video support
			}, 0x10: function () {
				
			// ( BIOS ) Get Equipment List
			}, 0x11: function () {
				// BIOS equipment list word, as defined for emulator
				CPU.EAX.Set(wordEquipmentList);
			// (BIOS) Get Memory Size
			}, 0x12: function () {
				// The word at 0040h:0013h contains the number of kilobytes
				//	of contiguous memory starting at absolute address 00000h.
				CPU.AX.Set(ReadBytesRAM((0x0040 << 4) + 0x0013, 2));
			// Low Level Disk Services
			}, 0x13: function () {
				// AH is used to select a function to call for this Interrupt
				switch ( CPU.AH.Get() ) {
				// Reset Disk Drives
				case 0x00:
					/* ===== Input ===== */
					// DL is set to indicate the drive to reset:
					//	00h - 1st floppy disk ( drive A )
					//	01h - 2nd floppy disk ( drive B )
					//	80h - 1st hard disk
					//	81h - 2nd hard disk
					// ( If bit 7 is set, both floppy & hard disks reset )
					var drive = CPU.DL.Get();
					/* ===== /Input ===== */
					
					// Force controller to recalibrate drive heads ( seek to track 0 )
					
					/* ==== Return ==== */
					BIOS.statusDiskLast = 0x00;
					// CF set on error, clear if no error
					CPU.CF.Clear();
					// AH return code
					CPU.AH.Set(BIOS.statusDiskLast);
					/* ==== /Return ==== */
					break;
				// Get Status of last operation
				case 0x01:
					/* ==== Return ==== */
					// AH return code - read stored last disk operation status
					CPU.AH.Set(BIOS.statusDiskLast);
					/* ==== /Return ==== */
					break;
				// Read Sectors from Drive into Memory
				case 0x02:
					/* ===== Input ===== */
					// AL - No. sectors to read
					var numSectors = CPU.AL.Get();
					// CH - Track
					var track = CPU.CH.Get();
					// CL - Sector
					var sector = CPU.CL.Get();
					// DH - Head
					var head = CPU.DH.Get();
					// DL - Drive
					var drive = CPU.DL.Get();
					// ES:BX - Buffer Address Pointer
					var addrBuffer = (CPU.ES.Get() << 4) + CPU.BX.Get();
					/* ===== /Input ===== */
					
					/* ==== Return ==== */
					BIOS.statusDiskLast = 0x00;
					// CF set on error, clear if no error
					CPU.CF.Clear();
					// AH return code
					CPU.AH.Set(BIOS.statusDiskLast);
					// AL - actual no. sectors read
					CPU.AL.Set(numSectors);
					/* ==== /Return ==== */
					break;
				// Verify Disk Sector(s)
				case 0x04:
					/* ===== Input ===== */
					// AL - No. sectors to verify
					var numSectors = CPU.AL.Get();
					// CH - Track
					var track = CPU.CH.Get();
					// CL - Sector
					var sector = CPU.CL.Get();
					// DH - Head
					var head = CPU.DH.Get();
					// DL - Drive
					var drive = CPU.DL.Get();
					// ES:BX - Buffer Address Pointer
					var addrBuffer = (CPU.ES.Get() << 4) + CPU.BX.Get();
					/* ===== /Input ===== */
					
					// Normally, this function does not compare the disk with memory, it merely
					//	checks whether the sector's stored CRC matches the data's actual CRC.
					// In the case of this emulator, we can safely assume the emulated memory image, located
					//	in the JavaScript VM's memory, is read from/written to correctly.
					
					/* ==== Return ==== */
					BIOS.statusDiskLast = 0x00;
					// CF set on error, clear if no error
					CPU.CF.Clear();
					// AH return code
					CPU.AH.Set(BIOS.statusDiskLast);
					// AL - actual no. sectors verified
					CPU.AL.Set(numSectors);
					/* ==== /Return ==== */
					break;
				// ( FLOPPY ) Format Track
				case 0x05:
					throw new Error("Floppy format not supported yet.");
					break;
				// ( FIXED DISK ) Format Track
				case 0x05:
					throw new Error("Fixed-disk format not supported yet.");
					break;
				// ( FIXED DISK ) Format Track & set bad Sector flags
				case 0x06:
					throw new Error("Fixed-disk format not supported yet.");
					break;
				// ( FIXED DISK ) Format Drive starting at given Track
				case 0x07:
					throw new Error("Fixed-disk format not supported yet.");
					break;
				// ( FIXED DISK ) Format Drive starting at given Track
				case 0x07:
					throw new Error("Fixed-disk format not supported yet.");
					break;
				// ( DISK ) Get Drive parameters
				case 0x13:
					throw new Error("Disk not supported yet.");
					break;
				// Invalid/unsupported function
				default:
					throw new Error("Unsupported or invalid Low Level Disk services function.");
				}
			// ( BIOS ) SERIAL
			}, 0x14: function () {
				
			// 25 ( BIOS ) SYSTEM - BOOTSTRAP LOADER
			}, 0x19: function () {
				//===================
				// This interrupt reboots the system without clearing memory or restoring
				//	interrupt vectors.  Because interrupt vectors are preserved, this
				//	interrupt usually causes a system hang if any TSRs have hooked
				//	vectors from 00h through 1Ch, particularly INT 08.
				//===================
				
				// For IBM BIOS CS:IP = 0000h:7C00h
				//	DH = access
				//	bits 7-6,4-0: don't care
				//	bit 5: =0 device supported by INT 13
				//	DL = boot drive
				//	00h first floppy
				//	80h first hard disk
				
				CPU.CS.Set(0x0000);
				CPU.EIP.Set(0x7C00);
				
				// If booting from a floppy
				
			}
		};
	
	// Run the CPU - start fetch/execute cycle
	CPU.Exec = function () {
		/* ==== Malloc ==== */
		var offset;
		var offsetStart;
		var byt;
		// TODO: load these from prefixes too
		var sizeAddress = 2;
		var sizeOperand = 2;
		
		var colOpcodeMap;
		var rowOpcodeMap;
		
		var dataOpcode;
		
		var bytModRM;
		var fieldMod;
		var fieldReg;
		var fieldRM;
		
		var name_regDataSegment = "DS";
		var nameStringRepeat = "";
		
		var nameInstruction = "";
		
		var flgDirection;
		var flgSign;
		var flgOperandSize;
		
		var operand1;
		var operand2;
		
		var nameMapFlags;
		
		var reg;
		
		var sizeBytes;
		
		var typeCode;
		var addrMethodCode;
		var addrMethod;
		
		var sizeBytes_Value;
		
		var lenBytes;
		
		var textASM;
		
		var insn;
		/* ==== /Malloc ==== */
		
		// Offset is current absolute Instruction address
		offset = (CPU.CS.Get() << 4) + CPU.EIP.Get();
		
		for ( ; ; ) {
			// Common case; Instruction not yet decoded into Instruction cache
			//	TODO: detect ( on memory writes ) whether that byte in RAM has been decoded,
			//	if so code is polymorphic, so ( for now ) just delete rest of cache after the changed instruction
			//	by setting the length property of the cache array
			if ( !(offset in arr_insnCache) ) {
				//debugger;
				// Loop provided for processing any prefixes etc.
				do {
					// Store start byte offset of instruction: will be needed later
					offsetStart = offset;
					
					// Read next byte of code - may be an opcode or a prefix
					byt = memData[offset];
					
					// Get references to cell in opcode map / table from the opcode byte
					colOpcodeMap = byt & 0x0F;	// In low nibble
					rowOpcodeMap = byt >> 4;	// In high nibble
					
					// Read data from map / table
					dataOpcode = arr_mapOpcodes_1Byte[rowOpcodeMap][colOpcodeMap];
					
					// Opcode extension was used
					if ( dataOpcode[0].substr(0, 5) === "#EXT_" ) {
						throw new Error("Extensions not supported yet.");
					// Segment override ( prefix )
					} else if ( dataOpcode[0] === "#SEG=" ) {
						name_regDataSegment = dataOpcode[1][0];
						// Skip prefix byte & read next
						++offset;
						continue;
					// String repeat operation ( prefix )
					} else if ( dataOpcode[0] === "#REP" || dataOpcode[0] === "#REPNE" ) {
						nameStringRepeat = dataOpcode[0];
						// Skip prefix byte & read next
						++offset;
						continue;
					}
				// Loop provided for processing any prefixes etc.
				} while ( 0 );
				
				// Read ASM mnemonic/name for instruction
				nameInstruction = dataOpcode[0];
				
				// Skip opcode byte
				++offset;
				
				// Instruction has operand(s) - ( dest., possibly followed by source )
				if ( dataOpcode.length > 1 ) {
					
					
					// pre-extract values for possible flags
					//	( NB:	- these fields don't apply to all opcodes)
					//		- sign flag applies to immediate data. )
					flgDirection = flgSign = ((byt & 0x02) >> 1);
					flgOperandSize = !(byt & 0x01);
					
					/* ====== Decode first operand ====== */
					// ( NB: already determined it must exist )
					operand1 = new Operand();
					
					// Flags text for opcode from table
					nameMapFlags = dataOpcode[1][0];
					//debugger;
					// Flag indicates a general purpose register ( eg. AX, AH, AL )
					//	or segment register ( eg. CS, DS, SS )
					if ( reg = CPU.hsh_reg[nameMapFlags] ) {
						operand1.SetType("GENERAL");
						operand1.SetRegister(reg);
					// Flag indicates a 16-bit general purpose register ( eg. AX, SI )
					} else if ( sizeAddress == 2 && (reg = CPU.hsh_reg[nameMapFlags.substr(1)]) ) {
						operand1.SetType("GENERAL");
						operand1.SetRegister(reg);
					// Flag indicates a 32-bit general purpose register ( eg. EAX, ESI )
					} else if ( sizeAddress == 4 && (reg = CPU.hsh_reg[nameMapFlags.toUpperCase()]) ) {
						operand1.SetType("GENERAL");
						operand1.SetRegister(reg);
					// Normal operand descriptor
					} else {
						/* ============ Use TypeCode to determine size ( in bytes ) of operand ============ */
						typeCode = nameMapFlags.charAt(1);
						// Look up TypeCode ( second character of flags text ) to determine operand size in bytes
						if ( (sizeBytes = CPU.hsh_size_operand[typeCode]) !== undefined ) {
							// Some flags indicate size ( in bytes ) should be doubled if operand-size attribute is set
							if ( flgOperandSize && (typeCode in CPU.hsh_flgDependsOnOperandSizeAttr) ) {
								sizeBytes *= 2;
							}
							operand1.SetSize(sizeBytes);
							
							addrMethodCode = nameMapFlags.charAt(0);
							/* ============ Determine addressing method ============ */
							// Operand addresses a register to be decoded using ModR/M Reg field
							if ( (addrMethod = CPU.hsh_addrmethodRegister[addrMethodCode]) !== undefined ) {
								operand1.SetType(addrMethod);
								
								/* ====== Decode ModR/M byte ====== */
								// NB: do not increment offset here, this byte may not be needed
								bytModRM = memData[offset + 1];
								fieldMod = bytModRM >> 6;		// Mod field is first 2 bits
								fieldReg = bytModRM & 0x38;		// Reg field is second 3 bits ( Reg 2 )
								fieldRM = bytModRM & 0x07;		// Register/Memory field is last 3 bits ( Reg 1 )
								/* ====== /Decode ModR/M byte ====== */
								
								// Byte register
								if ( sizeBytes == 1 ) {
									operand1.SetRegister(CPU.arr_regOrdinals_Byte[fieldReg]);
								// Word or Segment register
								} else if ( sizeBytes == 2 ) {
									if ( addrMethod == "GENERAL" ) {
										operand1.SetRegister(CPU.arr_regOrdinals_Word[fieldReg]);
									} else if ( addrMethod == "SEGMENT" ) {
										operand1.SetRegister(CPU.arr_regOrdinals_Segment[fieldReg]);
									}
								}
							// Use a fast switch to decide how to proceed
							} else {
								switch ( addrMethodCode ) {
								// No ModR/M byte used, Immediate data to be read
								case "A":
									// NB: also sets type to IMMEDIATE
									operand1.SetImmediate(ReadBytesRAM(offset, sizeBytes));
									operand1.SetSegment(ReadBytesRAM(offset + sizeBytes, sizeBytes));
									// Move offset pointer past the 2 values just read
									offset += sizeBytes * 2;
									break;
								// Immediate data to be read
								case "I":
									// NB: also sets type to IMMEDIATE
									operand1.SetImmediate(ReadBytesRAM(offset, sizeBytes));
									// Move offset pointer past the value just read
									offset += sizeBytes;
									break;
								// Instruction contains relative offset, to be added to EIP
								case "J":
									// NB: also sets type to IMMEDIATE
									operand1.SetImmediate(ReadBytesRAM(offset, sizeBytes));
									// Move offset pointer past the value just read
									offset += sizeBytes;
									break;
								// No ModR/M byte, offset coded as word or dword (dep. on op size attr)
								case "O":
									// Use operand-size attribute to determine size of Immediate value to extract
									sizeBytes_Value = flgOperandSize == 2 ? 2 : 4;
									// NB: also sets type to IMMEDIATE
									operand1.SetImmediate(ReadBytesRAM(offset, sizeBytes_Value));
									operand1.SetIsPointer(true);
									// Move offset pointer past the value just read
									offset += sizeBytes_Value;
									break;
								case "E":	// ModR/M byte follows opcode, specifies operand (either general register or memory address)
								case "M":	// ModR/M byte may only refer to memory
								case "R":	// ModR/M byte may only refer to general purpose reg (mod = general register)
									/* ====== Decode ModR/M byte ====== */
									// We are going to use ModR/M byte ( previously decoded ), so skip past it after reading
									bytModRM = memData[offset++];
									fieldMod = bytModRM >> 6;		// Mod field is first 2 bits
									fieldReg = bytModRM & 0x38;		// Reg field is second 3 bits ( Reg 2 )
									fieldRM = bytModRM & 0x07;		// Register/Memory field is last 3 bits ( Reg 1 )
									/* ====== /Decode ModR/M byte ====== */
									
									throw new Error("No ModR/M support yet.");
									
									break;
								// Memory, addressed by DS:SI register pair
								case "X":
									operand1.SetType("GENERAL");
									operand1.SetSegment(CPU.DS.Get());
									operand1.SetRegister(CPU.SI);
									operand1.SetIsPointer(true);
									break;
								// Memory, addressed by ES:DI register pair
								case "Y":
									operand1.SetType("GENERAL");
									operand1.SetSegment(CPU.ES.Get());
									operand1.SetRegister(CPU.DI);
									operand1.SetIsPointer(true);
									break;
								// EFLAGS register
								case "F":
									break;
								default:
									throw new Error("Invalid AddressingMethodCode '" + addrMethodCode + "'.");
								}
							}
							/* ============ /Determine addressing method ============ */
							
						// Operand flags may indicate a constant value
						} else {
							// Constant value is valid
							if ( isFinite(nameMapFlags) ) {
								// Store immediate value ( incl. switching addressing method to Immediate )
								operand1.SetImmediate(nameMapFlags);
							// Error; invalid flags... ?!
							} else {
								throw new Error("Invalid operand flags: '" + nameMapFlags + "'");
							}
						}
						operand1.SetSize(sizeBytes);
						/* ============ /Use TypeCode to determine size ( in bytes ) of operand ============ */
						
						
					}
					/* ====== /Decode first operand ====== */
					
					//console.dir(operand1);
				}
				
				// Calculate length of Instruction in bytes
				lenBytes = offset - offsetStart;
				
				/*
				 *	Tracer must follow JUMP/CALL/LOOP instructions
				 *	in order to decompile the correct bytes. This requires
				 *	a fair bit of care to ensure data is only disassembled once
				 *	and the tracer does not enter an infinite loop.
				 */
				//if ( nameInstruction === "JMP SHORT" ) {
				//	offset += operand1.GetImmediate();
				//}
				
				textASM = nameInstruction;
				if ( operand1 ) {
					textASM += " " + operand1.GetASMText();
				}
				if ( operand2 ) {
					textASM += ", " + operand2.GetASMText();
				}
				console.log(textASM);
				
				// Create new Instruction and store in array, indexed by address
				//	for fast lookups later
				insn = arr_insnCache[offsetStart] = new Instruction(offsetStart, nameInstruction, operand1, operand2, lenBytes);
				// Execute immediately
				insn.Execute();
				
				/* ==== Cleanup ==== */
				operand1 = operand2 = null;
				/* ==== /Cleanup ==== */
			// Less common case; instruction already decoded, just read from Instruction cache & exec
			//	TODO: addl optimisation possible: if insn already decoded,
			//	maybe a version of the above loop with just this branch & inverted condition would be faster?
			//	( ie. add a tight loop here )
			} else {
				// Load Instruction's decoded data
				insn = arr_insnCache[offset];
				// Move pointer past Instruction
				offset += insn.lenBytes;
				// Execute immediately
				insn.Execute();
			}
			debugger;
		}
	};
	
	// All the emulated BIOS's basic setup
	//	( eg. values read from motherboard switches / memory size etc. )
	BIOS.Init = function () {
		// Word at 0040h:0013h contains no. of kilobytes of contiguous memory available
		WriteBytesRAM((0x0040 << 4) + 0x0013, numKilobytesMemory, 2);
		
		/* ==== Malloc ==== */
		var numFloppies = 1;
		var is80x87CoprocessorInstalled = 0;
		// Calculate the number of 16K banks of RAM that would need to be present on motherboard to support
		//	the current emulated RAM size
		var num16K_RAMBanks_Onboard = Math.floor(numKilobytesMemory / 16);
		// 00h - EGA, VGA or PGA
		// 01h - 40x25 colour
		// 10h - 80x25 colour
		// 11h - 80x25 monochrome
		var modeVideoInitial = 0x10;
		// DMA support ( only for PCjr, Tandy 1400LT )
		var isDMASupportInstalled = 0;
		// Number of serial/COM ports installed
		var numSerialPortsInstalled = 0;
		// Game port installed ?
		var isGamePortInstalled = 0;
		// Internal modem installed ?
		var isInternalModemInstalled = 0;
		// Number of parallel/LPT ports installed
		var numParallelPortsInstalled = 0;
		/* ==== /Malloc ==== */
		
		/* ==== Set up Equipment List Word ==== */
		// Floppy disks installed ( number specified by bits 7 - 6 )
		wordEquipmentList.SetBits(0, numFloppies > 0 ? 1 : 0, 1);
		// 80x87 coprocessor installed
		wordEquipmentList.SetBits(1, is80x87CoprocessorInstalled ? 1 : 0, 1);
		// Number of 16K banks of RAM on motherboard
		wordEquipmentList.SetBits(2, num16K_RAMBanks_Onboard, 2);
		// Initial Video mode
		wordEquipmentList.SetBits(4, modeVideoInitial, 2);
		// Number of floppies installed less 1 ( if bit 0 set )
		wordEquipmentList.SetBits(6, numFloppies > 1 ? numFloppies - 1 : 0, 2);
		// DMA support installed
		wordEquipmentList.SetBits(8, isDMASupportInstalled, 1);
		// Number of serial ports installed
		wordEquipmentList.SetBits(9, numSerialPortsInstalled, 3);
		// Game port installed ?
		wordEquipmentList.SetBits(12, isGamePortInstalled, 1);
		// Internal modem installed ?
		wordEquipmentList.SetBits(13, isInternalModemInstalled, 1);
		// Number of parallel ports installed
		wordEquipmentList.SetBits(14, numParallelPortsInstalled, 2);
		/* ==== /Set up Equipment List Word ==== */
	};
	// Load an x86 Master Boot Record ( 512-byte boot sector )
	//	( IBM-compatible BIOS load )
	BIOS.LoadMBR = function ( arr_bytMBR ) {
		/* ==== Malloc ==== */
		var offset = 0x00007C00;
		/* ==== /Malloc ==== */
		
		// Load Master Boot Record into physical RAM address 0x7C00 ( derived from CS above )
		for ( var idx = 0 ; idx < 512 ; ++idx ) {
			memData[offset + idx] = arr_bytMBR[idx];
		}
		
		// Start executing at new load location to boot
		CPU.CS.Set(0x0000);
		CPU.EIP.Set(offset);
	};
	
	function Bitfield( sizeBits ) {
		this.sizeBits = sizeBits;
		this.value = 0;
	}
	Bitfield.prototype.Set = function ( val ) {
		this.value = val;
	};
	Bitfield.prototype.SetBit = function ( idx ) {
		this.value |= 1 << idx;
	};
	Bitfield.prototype.ClearBit = function ( idx ) {
		this.value &= ~(1 << idx);
	};
	Bitfield.prototype.ToggleBit = function ( idx ) {
		this.value ^= 1 << idx;
	};
	Bitfield.prototype.SetBits = function ( idx, val, numBitsMax ) {
		/* ==== Malloc ==== */
		var bitmaskMaxSize = Math.pow(2, numBitsMax);
		/* ==== /Malloc ==== */
		this.value |= (val & bitmaskMaxSize) << idx;
	};
	
	// Load sequence
	window.onload = function () {
		/* ==== Malloc ==== */
		var arr_bytMBR = GetSyncHTTP_Binary("boot.bin");
		/* ==== /Malloc ==== */
		
		// Initialise emulated BIOS
		BIOS.Init();
		
		// Load x86 MBR image
		BIOS.LoadMBR(arr_bytMBR);
		
		// Run the CPU - start fetch/execute cycle
		CPU.Exec();
		
		/*CPU.EAX.Set(0xF000FF16);
		console.log("EAX = " + CPU.EAX.Get().toString(16));
		console.log("AX = " + CPU.AX.Get().toString(16));
		console.log("AH = " + CPU.AH.Get().toString(16));
		console.log("AL = " + CPU.AL.Get().toString(16));
		
		CPU.EAX.Set(0x00000000);
		console.log("EAX = " + CPU.EAX.Get().toString(16));
		console.log("AX = " + CPU.AX.Get().toString(16));
		console.log("AH = " + CPU.AH.Get().toString(16));
		console.log("AL = " + CPU.AL.Get().toString(16));
		
		CPU.AH.Set(0xFF+2);
		console.log("EAX = " + CPU.EAX.Get().toString(16));
		console.log("AX = " + CPU.AX.Get().toString(16));
		console.log("AH = " + CPU.AH.Get().toString(16));
		console.log("AL = " + CPU.AL.Get().toString(16));
		
		CPU.EFLAGS.Set(0);
		console.log("CF = " + CPU.CF.Get().toString(16));
		console.log("PF = " + CPU.PF.Get().toString(16));
		console.log("AF = " + CPU.AF.Get().toString(16));
		console.log("ZF = " + CPU.ZF.Get().toString(16));
		
		CPU.AF.Set();
		CPU.ZF.Set();
		console.log("CF = " + CPU.CF.Get().toString(16));
		console.log("PF = " + CPU.PF.Get().toString(16));
		console.log("AF = " + CPU.AF.Get().toString(16));
		console.log("ZF = " + CPU.ZF.Get().toString(16));
		return;
		*/
		// Perform trace...
		
		/*
		//var scr = document.createElement("script"); //document.getElementsByTagName("head")[0].getElementsByTagName("script")[1];
		//var head = document.getElementsByTagName("head")[0];
		
		var a = [];
		for ( var i = 0 ; i < 400000 ; ++i ) {
			a[a.length] = "BX.Set(AX.Get());";
		}
		var b = a.join("");
		var start = new Date().getTime();
		with ( CPU ) {
			eval(b);
		}
		alert(new Date().getTime() - start);
		//scr.text = "alert('start...');var start = new Date().getTime();function go(){with(CPU){"
		//		+ b + "}};go();alert(new Date().getTime() - start);"; //"window.areyouthere = function(){}";
		
		//head.appendChild(scr);
		
		alert("test 2...");
		var a = 10;
		var start = new Date().getTime();
		for ( var i = 0 ; i < 400000 ; ++i ) {
			switch ( a ) {
			case 10:
			CPU.BX.Set(CPU.AX.Get());	// mov bx, ax
			break;
			}
		}
		alert(new Date().getTime() - start);
		alert("test 3...");
		*/
		
		/*
		var idx = 0;
		var arr = [{ cmd: "SUB", operand1: { reg: CPU.BX }, operand2: { reg: CPU.AX } }];
		var data;
		
		var cmd;	// mov bx, ax
		var a;// = CPU.BX;
		var b;// = CPU.AX;
		var start = new Date().getTime();
		for ( var i = 0 ; i < 3000000 ; ++i ) {
			data = arr[idx];
			cmd = data.cmd;
			a = data.operand1.reg;
			b = data.operand2.reg;
			
			switch ( cmd ) {
			case "MOV":
				a.Set(b.Get());
				break;
			case "ADD":
				a.Set(a.Get() + b.Get());
				break;
			case "SUB":
				a.Set(a.Get() - b.Get());
				break;
			}
		}
		alert(new Date().getTime() - start);
		
		return;
		*/
		
		
		
		/*CPU.EAX.Set(0xF000FF00);
		console.log("EAX = " + CPU.EAX.Get().toString(16));
		console.log("AX = " + CPU.AX.Get().toString(16));
		console.log("AH = " + CPU.AH.Get().toString(16));
		console.log("AL = " + CPU.AL.Get().toString(16));
		
		CPU.EAX.Set(0x00000000);
		console.log("EAX = " + CPU.EAX.Get().toString(16));
		console.log("AX = " + CPU.AX.Get().toString(16));
		console.log("AH = " + CPU.AH.Get().toString(16));
		console.log("AL = " + CPU.AL.Get().toString(16));
		
		CPU.AX.Set(0x000F);
		console.log("EAX = " + CPU.EAX.Get().toString(16));
		console.log("AX = " + CPU.AX.Get().toString(16));
		console.log("AH = " + CPU.AH.Get().toString(16));
		console.log("AL = " + CPU.AL.Get().toString(16));
		*/
	};
	
	function SegmentToAbsolute( segment ) {
		// Shift extra 4 bits onto segment value ( must be 20-bit address )
		return segment << 4;
	}
	
	// Read from RAM array
	function ReadBytesRAM( addr, num ) {
		// Use size of operand to determine how many bytes to read
		switch ( num ) {
		case 1:	// Byte ( 8-bit )
			return memData[addr];
		case 2:	// Word ( 16-bit )
			return (memData[addr + 1] << 8) | (memData[addr]);
		case 4:	// Dword ( 32-bit )
			return (memData[addr + 3] << 24) | (memData[addr + 2] << 16) | (memData[addr + 1] << 8) | (memData[addr]);
		default:
			throw new Error("ReadBytesRAM :: Operand size > 32-bit not supported");
		}
	}
	// Write to RAM array
	function WriteBytesRAM( addr, val, num ) {
		/* ==== Guards ==== */
		Assert((val / 0xFF) >> 0 <= num, "WriteBytesRAM :: Value is greater in bytes than size");
		/* ==== /Guards ==== */
		
		// Use size of operand to determine how many bytes to write
		switch ( num ) {
		case 1:	// Byte ( 8-bit )
			memData[addr	] = val;
		case 2:	// Word ( 16-bit )
			memData[addr	] = val & 0x00FF;
			memData[addr + 1] = val & 0xFF00;
		case 4:	// Dword ( 32-bit )
			memData[addr	] = val & 0x000000FF;
			memData[addr + 1] = val & 0x0000FF00;
			memData[addr + 2] = val & 0x00FF0000;
			memData[addr + 3] = val & 0xFF000000;
		default:
			throw new Error("WriteBytesRAM :: Operand size > 32-bit not supported");
		}
	}
	
	// Read data from an arbitrary memory array
	function ReadBytes( arr_data, addr, num ) {
		// Use size of operand to determine how many bytes to read
		switch ( num ) {
		case 1:	// Byte ( 8-bit )
			return arr_data[addr];
		case 2:	// Word ( 16-bit )
			return (arr_data[addr + 1] << 8) | (arr_data[addr]);
		case 4:	// Dword ( 32-bit )
			return (arr_data[addr + 3] << 24) | (arr_data[addr + 2] << 16) | (arr_data[addr + 1] << 8) | (arr_data[addr]);
		default:
			throw new Error("ReadBytes :: Operand size > 32-bit not supported");
		}
	}
	// Write data to an arbitrary memory array
	function WriteBytes( arr_data, addr, val, num ) {
		/* ==== Guards ==== */
		Assert((val / 0xFF) >> 0 <= num, "WriteBytes :: Value is greater in bytes than size");
		/* ==== /Guards ==== */
		
		// Use size of operand to determine how many bytes to write
		switch ( num ) {
		case 1:	// Byte ( 8-bit )
			arr_data[addr	] = val;
		case 2:	// Word ( 16-bit )
			arr_data[addr	] = val & 0x00FF;
			arr_data[addr + 1] = val & 0xFF00;
		case 4:	// Dword ( 32-bit )
			arr_data[addr	] = val & 0x000000FF;
			arr_data[addr + 1] = val & 0x0000FF00;
			arr_data[addr + 2] = val & 0x00FF0000;
			arr_data[addr + 3] = val & 0xFF000000;
		default:
			throw new Error("WriteBytes :: Operand size > 32-bit not supported");
		}
	}
	
	// CPU Instruction Operand ( eg. dest or src ) class constructor
	function Operand() {
		/* ==== Guards ==== */
		Assert(this != self, "Operand constructor :: not called as constructor.");
		/* ==== /Guards ==== */
		
		// Register used ( if applicable )
		this.reg = null;
		// Size of register used in bytes ( if applicable )
		this.sizeBytes = null;
		// Immediate/scalar number value of operand ( if applicable )
		this.immed = null;
		// Effective segment of operand's pointer address ( if applicable )
		this.segment = 0;
		// Type of operand's value ( Immediate data, General register, MMX register etc. )
		this.type = null;
		// Whether operand represents a memory pointer
		this.isPointer = false;
	}
	Operand.prototype.SetRegister = function ( reg ) {
		this.reg = reg;
		// Store size of register in bytes ( eg. AX is a word/2-byte register )
		this.sizeBytes = reg.GetSize();
	};
	Operand.prototype.SetSize = function ( sizeBytes ) {
		// Store size of operand in bytes ( eg. AX is a word/2-byte register, 0xFF is a one-byte immediate )
		this.sizeBytes = sizeBytes;
	};
	Operand.prototype.SetImmediate = function ( immed ) {
		this.immed = immed;
		this.type = "IMMEDIATE";
	};
	Operand.prototype.GetImmediate = function () {
		return this.immed;
	};
	Operand.prototype.SetSegment = function ( segment ) {
		this.segment = segment;
	};
	Operand.prototype.SetType = function ( type ) {
		this.type = type;
	};
	Operand.prototype.SetIsPointer = function ( isPointer ) {
		this.isPointer = isPointer;
	};
	// Returns a human-readable ASM-format representation of the operand's data
	Operand.prototype.GetASMText = function () {
		switch ( this.type ) {
		case "IMMEDIATE":
			return this.immed.toString(16).toUpperCase();
		case "CONTROL":
		case "DEBUG":
		case "GENERAL":
		case "MMX":
		case "SEGMENT":
		case "SIMD":
			return this.reg.GetName();
		}
	};
	Operand.prototype.GetPointerAddress = function () {
		switch ( this.type ) {
		case "GENERAL":
		case "SEGMENT":
			return (this.segment << 4) + this.reg.Get();
		case "IMMEDIATE":
			return (this.segment << 4) + this.immed;
		default:
			throw new Error("GetPointerAddress :: Cannot determine address offset component from type.");
		}
	};
	
	// CPU Instruction ( eg. MOV, CMP ) class constructor
	function Instruction( offsetAddress, name, operand1, operand2, lenBytes ) {
		/* ==== Guards ==== */
		Assert(this != self, "Instruction constructor :: not called as constructor.");
		/* ==== /Guards ==== */
		
		// Mnemonic / name of Instruction
		this.name = name;
		// Absolute offset address of Instruction 
		this.offsetAddress = offsetAddress;
		this.operand1 = operand1;
		this.operand2 = operand2;
		// Length of Instruction in bytes
		this.lenBytes = lenBytes;
	}
	// Execute a CPU Instruction
	Instruction.prototype.Execute = function () {
		/* ==== Malloc ==== */
		var data;
		/* ==== /Malloc ==== */
		
		switch ( this.name ) {
		// Clear Interrupt flag - disables the maskable hardware interrupts. NMI's and software interrupts are not inhibited.
		case "CLI":
			CPU.IF.Clear();
			return;
		// Set Interrupt flag - enables recognition of all hardware interrupts.
		case "STI":
			CPU.IF.Set();
			return;
		// Clear Direction flag
		case "CLD":
			CPU.DF.Clear();
			return;
		// Set Direction flag
		case "STD":
			CPU.DF.Set();
			return;
		// Clear Carry flag
		case "CLC":
			CPU.CF.Clear();
			return;
		// Set Carry flag
		case "STC":
			CPU.CF.Set();
			return;
		// Complement/toggle/invert Carry flag
		case "CMC":
			CPU.CF.Set(!CPU.CF.Get());
			return;
		// Do nothing. Occupies both time & space
		case "NOP":
			// ...
			return;
		// Push data onto stack top ( SS:SP )
		case "PUSH":
			switch ( this.operand1.type ) {
			// Registers
			case "GENERAL":
			case "SEGMENT":
				// Memory pointer; read
				if ( this.operand1.isPointer ) {
					PushStack(ReadBytesRAM(this.operand1.GetPointerAddress(), this.operand1.sizeBytes), this.operand1.sizeBytes);
					return;
				} else {
					PushStack(this.operand1.reg.Get(), this.operand1.sizeBytes);
					return;
				}
			// Immediate data
			case "IMMEDIATE":
				// Memory pointer; read
				if ( this.operand1.isPointer ) {
					PushStack(ReadBytesRAM(this.operand1.GetPointerAddress(), this.operand1.sizeBytes), this.operand1.sizeBytes);
					return;
				} else {
					PushStack(this.operand1.immed, this.operand1.sizeBytes);
					return;
				}
			// Unsupported data... ?!
			default:
				throw new Error("Execute (PUSH) :: Unsupported data");
			}
		// Pop word off stack top ( SS:SP )
		case "POP":
			switch ( this.operand1.type ) {
			// Registers
			case "GENERAL":
			case "SEGMENT":
				// Memory pointer; read
				if ( this.operand1.isPointer ) {
					WriteBytesRAM(this.operand1.GetPointerAddress(), PopStack(2), 2);
					return;
				} else {
					this.operand1.reg.Set(PopStack(2));
					return;
				}
			// Immediate data
			case "IMMEDIATE":
				// Memory pointer; write
				if ( this.operand1.isPointer ) {
					WriteBytesRAM(this.operand1.GetPointerAddress(), PopStack(2), 2);
					return;
				// Invalid; cannot write to Immediate data
				} else {
					throw new Error("Execute (POP) :: Tried to pop stack to Immediate data");
				}
			// Unsupported data... ?!
			default:
				throw new Error("Execute (POP) :: Unsupported data");
			}
		// Software-generated interrupt
		case "INT":
			// Call BIOS-defined interrupt handler if installed
			if ( this.operand1.immed in CPU.hsh_InterruptHandler ) {
				CPU.hsh_InterruptHandler[this.operand1.immed]();
				return;
			// Otherwise, look up in table
			} else {
				throw new Error("Interrupt vector table not supported");
			}
		case "JMP SHORT":
			return;
		case "JMP NEAR":
			return;
		case "JB":
			if ( CPU.CF.Get() == 1 ) {
				
			}
			return;
		}
	};
	
	// Push data onto the Stack
	function PushStack( val, sizeBytes ) {
		/* ==== Malloc ==== */
		// Get pointer to top of Stack
		var ptrStack = CPU.ESP.Get();
		/* ==== /Malloc ==== */
		
		// Sign-extend byte values (for emulator this means do nothing - not using two's complement)
		if (sizeBytes <= 2) {
			sizeBytes = 2;
		// Extend 3-4 byte values as above
		} else if (sizeBytes < 4) {
			sizeBytes = 4;
		}
		
		// Decrement by operand size
		ptrStack -= sizeBytes;
		// Wrap if goes out of bounds
		if ( ptrStack < 0 ) ptrStack += 0xFFFF + 1;
		
		// Update Stack pointer
		CPU.ESP.Set(ptrStack);
		
		// Write data to Stack top ( SS:SP )
		WriteBytesRAM(SegmentToAbsolute(CPU.SS.Get()) + ptrStack, val, sizeBytes);
	}
	
	// Pop data off the Stack
	function PopStack( sizeBytes ) {
		/* ==== Malloc ==== */
		// Get pointer to top of Stack
		var ptrStack = CPU.ESP.Get();
		var data;
		/* ==== /Malloc ==== */
		
		// Read data from Stack top ( SS:SP )
		data = ReadBytesRAM(SegmentToAbsolute(CPU.SS.Get()) + ptrStack, sizeBytes);
		
		// Decrement by operand size
		ptrStack -= sizeBytes;
		// Wrap if goes out of bounds
		if ( ptrStack < 0 ) ptrStack += 0xFFFF + 1;
		
		// Update Stack pointer
		CPU.ESP.Set(ptrStack);
		
		return data;
	}
	
	// CPU Register ( eg. EAX, EBX ) class constructor
	function Register( name, sizeBytes ) {
		/* ==== Guards ==== */
		Assert(this != self, "Register constructor :: not called as constructor.");
		/* ==== /Guards ==== */
		
		this.name = name;
		this.value = 0;
		this.sizeBytes = sizeBytes;
	}
	Register.prototype.Get = function () {
		return this.value;
	};
	Register.prototype.Set = function ( val ) {
		this.value = val;
	};
	Register.prototype.GetSize = function () {
		return this.sizeBytes;
	};
	Register.prototype.GetName = function () {
		return this.name;
	};
	
	// CPU Sub-register ( eg AX, AL, AH ) class constructor
	function SubRegister( name, sizeBytes, regMaster, bitmaskSize, bytesInLeft ) {
		/* ==== Guards ==== */
		Assert(this != self, "SubRegister constructor :: not called as constructor.");
		Assert(regMaster && regMaster instanceof Register, "SubRegister constructor :: no valid master register specified.");
		/* ==== /Guards ==== */
		
		this.name = name;
		this.sizeBytes = sizeBytes;
		this.Get = SubRegister_CreateGetter(regMaster, bitmaskSize, bytesInLeft);
		this.Set = SubRegister_CreateSetter(regMaster, bitmaskSize, bytesInLeft);
	}
	SubRegister.prototype.GetSize = function () {
		return this.sizeBytes;
	};
	SubRegister.prototype.GetName = function () {
		return this.name;
	};
	
	function SubRegister_CreateGetter( regMaster, bitmaskSize, bytesInLeft ) {
		/* ==== Malloc ==== */
		// Amount to 
		var bitsShiftRight = bytesInLeft * 8;
		/* ==== /Malloc ==== */
		
		// Faster case; if no bits to shift, remove shift operation from method function
		if ( bitsShiftRight == 0 ) {
			return function () {
				// Mask, leaving only subvalue
				return (regMaster.Get() & bitmaskSize);
			};
		// General case
		} else {
			return function () {
				// Mask, leaving only subvalue
				return ((regMaster.Get() >> bitsShiftRight) & bitmaskSize);
			};
		}
	}
	function SubRegister_CreateSetter( regMaster, bitmaskSize, bytesInLeft ) {
		/* ==== Malloc ==== */
		// Amount to 
		var bitsShiftRight = bytesInLeft * 8;
		// Amount to add to wrap negative number around
		var valNegativeWrap = bitmaskSize + 1;
		// Bitmask for extracting only the part of the value not occupied by this subregister
		var bitmaskNotOccupies = 0xFFFFFFFF - (bitmaskSize << bitsShiftRight);
		/* ==== /Malloc ==== */
		
		// Faster case; if no bits to shift, remove shift operation from method function
		if ( bitsShiftRight == 0 ) {
			return function () {
				// Mask, leaving only subvalue
				return (regMaster.Get() & bitmaskSize);
			};
		// General case
		} else {
			return function ( val ) {
				// Wrap round if negative or too large
				if ( val < 0 ) val += valNegativeWrap;
				if ( val > bitmaskSize ) val -= valNegativeWrap;
				regMaster.Set(
						// Mask out current SubRegister value
						(regMaster.Get() & bitmaskNotOccupies)
						// Restrict new value to max size of SubRegister
						| (val << bitsShiftRight)
					);
			};
		}
	}
	
	// CPU flags register ( eg. EFLAGS ) bit-flag ( eg IF, AF, DF ) class constructor
	function BitFlag( name, regMaster, bitsInLeft ) {
		/* ==== Guards ==== */
		Assert(this != self, "BitFlag constructor :: not called as constructor.");
		Assert(regMaster && regMaster instanceof Register, "BitFlag constructor :: no valid master register specified.");
		/* ==== /Guards ==== */
		
		this.name = name;
		this.regMaster = regMaster;
		
		this.Get = BitFlag_CreateGetter(regMaster, bitsInLeft);
		this.Set = BitFlag_CreateSetter(regMaster, bitsInLeft);
		this.Clear = BitFlag_CreateClearer(regMaster, bitsInLeft);
	}
	BitFlag.prototype.GetName = function () {
		return this.name;
	};
	
	function BitFlag_CreateGetter( regMaster, bitsInLeft ) {
		/* ==== Malloc ==== */
		
		/* ==== /Malloc ==== */
		
		// Faster case; if no bits to shift, remove shift operation from method function
		if ( bitsInLeft == 0 ) {
			return function () {
				// Mask, leaving only subvalue
				return (regMaster.Get() & 0x01);
			};
		// General case
		} else {
			return function () {
				// Mask, leaving only subvalue
				return ((regMaster.Get() >> bitsInLeft) & 0x01);
			};
		}
	}
	function BitFlag_CreateSetter( regMaster, bitsInLeft ) {
		/* ==== Malloc ==== */
		var bitmaskOccupies = (0x01 << bitsInLeft);
		// Bitmask for extracting only the bits not occupied by this BitFlag
		var bitmaskNotOccupies = 0xFFFFFFFF - bitmaskOccupies;
		/* ==== /Malloc ==== */
		
		// Faster case; if no bits to shift, remove shift operation from method function
		if ( bitsInLeft == 0 ) {
			return function () {
				regMaster.Set(
						// Mask out current BitFlag value
						(regMaster.Get() & bitmaskNotOccupies)
						// Set bit in flag's location
						| 0x01
					);
			};
		// General case
		} else {
			return function () {
				regMaster.Set(
						// Mask out current BitFlag value
						(regMaster.Get() & bitmaskNotOccupies)
						// Set bit in flag's location
						| bitmaskOccupies
					);
			};
		}
	}
	function BitFlag_CreateClearer( regMaster, bitsInLeft ) {
		/* ==== Malloc ==== */
		var bitmaskOccupies = (0x01 << bitsInLeft);
		// Bitmask for extracting only the bits not occupied by this BitFlag
		var bitmaskNotOccupies = 0xFFFFFFFF - bitmaskOccupies;
		/* ==== /Malloc ==== */
		
		// Only general case needed because this is so simple
		return function () {
			regMaster.Set(
					// Mask out current BitFlag value
					(regMaster.Get() & bitmaskNotOccupies)
				);
		};
	}
	/*
	function Exec( js ) {
		// Run it, using CPU object as context
		//	to expose register variables etc.
		with ( CPU ) {
			
			eval(js);
		}
	}*/
	
	// Synchronously download a file over HTTP
	function GetSyncHTTP( path ) {
		xmlhttp.open("GET", path, false);
		xmlhttp.send("");
		return xmlhttp.responseText;
	}
	
	function GetSyncHTTP_Binary( path ) {
		/* ==== Malloc ==== */
		var arr_bytResponse;
		var numBytes;
		var idx;
		/* ==== /Malloc ==== */
		
		xmlhttp.open("GET", path, false);
		// Force to x-user-defined encoding (Latin-1 ASCII, UTF-8 fail in reserved 128-160 range - force to UNICODE Private Area (0xF700-0xF7FF) range)
		//	( NB: fix from http://mgran.blogspot.com/2006/08/downloading-binary-streams-with.html )
		xmlhttp.overrideMimeType("text/plain; charset=x-user-defined");
		xmlhttp.send("");
		
		// Read response, split into bytes / characters
		arr_bytResponse = xmlhttp.responseText.split("");
		
		// Clip charCodes into ASCII range 00h->FFh (from UNICODE F700h->F7FFh)
		numBytes = arr_bytResponse.length;
		for ( idx = 0 ; idx < numBytes ; ++idx ) {
			arr_bytResponse[idx] = arr_bytResponse[idx].charCodeAt(0) & 0xFF;
		}
		
		// Read raw program image data
		return arr_bytResponse;
	}
	
	// Debugging helpers
	function Assert( test, textMsg ) {
		if ( !test ) {
			throw new Error(textMsg);
		}
	}
}