/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: CPU Instruction class support
 */
var mod = new jemul8.SecondaryModule( function ( jemul8, machine, CPU, DRAM ) {
	// CPU Instruction ( eg. MOV, CMP ) class constructor
	function Instruction( offsetAddress, name, sizeAddress_Bytes, sizeOperand_Bytes ) {
		/* ==== Guards ==== */
		jemul8.Assert(this != self, "Instruction constructor :: not called as constructor.");
		/* ==== /Guards ==== */
		
		// Mnemonic / name of Instruction
		this.name = name;
		// Absolute offset address of Instruction 
		this.offsetAddress = offsetAddress;
		this.operand1 = null;
		this.operand2 = null;
		this.operand3 = null;
		// Length of Instruction in bytes
		this.lenBytes = null;
		
		// Repeat prefix for String Instructions ( eg. MOVS, CMPS, LODS, CMPS )
		this.typeStringRepeat = "";
		
		// Operand Size
		this.sizeOperand_Bytes = this.attrOperand_Bytes = sizeOperand_Bytes;
		// Address Size
		this.sizeAddress_Bytes = this.attrAddress_Bytes = sizeAddress_Bytes;
		
		// Flag to ensure ModR/M byte is only skipped once
		//	( if several Operands use fields from it, they would otherwise advance
		//	the decoder's pointer more than once )
		this.flgSkippedModRM = false;
		
		// POLYMORPHIC: Load appropriate Execute function for Instruction
		this.execute = hsh_func_insnExecute[ name ];
	}
	
	// Execute a CPU Instruction
	var hsh_func_insnExecute = {
		// ASCII adjust after Addition
		//		Based on http://siyobik.info/index.php?module=x86&id=1
		//	TODO: how to handle other flags? Intel docs say undefined,
		//	but other sources say should be handled just as for other insns
		"AAA": function () {
			/* ==== Malloc ==== */
			var AL = CPU.AL.get();
			/* ==== /Malloc ==== */
			if ( ((AL & 0x0F) > 9) || (CPU.AF.get()) ) {
				CPU.AL.set((AL + 6) & 0x0F);
				CPU.AH.set(CPU.AH.get() + 1);
				CPU.CF.set();
				CPU.AF.set();
			} else {
				CPU.AL.set(AL & 0x0F);
				CPU.CF.clear();
				CPU.AF.clear();
			}
		// ASCII adjust AX before Division
		}, "AAD": function () {
			/* ==== Malloc ==== */
			// Val1 will almost always be 0Ah ( 10d ), meaning to adjust for base-10 / decimal.
			var val1 = this.operand1.Read();
			var res = CPU.AH.get() * val1 + CPU.AL.get();
			/* ==== /Malloc ==== */
			CPU.AL.set(res & 0xFF);
			CPU.AH.set(0);
			
			this.setFlags_Op1(val1, res);
		// ASCII adjust after Multiplication
		}, "AAM": function () {
			/* ==== Malloc ==== */
			// Val1 will almost always be 0Ah ( 10d ), meaning to adjust for base-10 / decimal.
			var val1 = this.operand1.Read();
			var AL = CPU.AL.get();
			var res = CPU.AH.get() * val1 + AL;
			/* ==== /Malloc ==== */
			CPU.AH.set((AL / 10) >> 0);
			CPU.AL.set(AL % 10);
			this.setFlags_Op1(val1, res);
		// ASCII adjust AL after Subtraction
		//	TODO: how to handle other flags? Intel docs say undefined,
		//	but other sources say should be handled just as for other insns
		}, "AAS": function () {
			/* ==== Malloc ==== */
			var AL = CPU.AL.get();
			/* ==== /Malloc ==== */
			if ( ((AL & 0x0F) > 9) || (CPU.AF.get()) ) {
				CPU.AL.set((AL - 6) & 0x0F);
				CPU.AH.set(CPU.AH.get() - 1);
				CPU.CF.set();
				CPU.AF.set();
			} else {
				CPU.AL.set(AL & 0x0F);
				CPU.CF.clear();
				CPU.AF.clear();
			}
		// Add with Carry
		}, "ADC": function () {
			/* ==== Malloc ==== */
			var val1 = this.operand1.Read();
			var val2 = this.operand2.Read();
			var res = val1 + val2 + CPU.CF.get();
			/* ==== /Malloc ==== */
			this.operand1.Write(res);
			
			this.setFlags(val1, val2, res);
		// Arithmetic Addition
		}, "ADD": function () {
			// NB: Addition and subtraction handle two's complement the same way
			//	for both unsigned and signed interpretations of numbers
			/* ==== Malloc ==== */
			var val1 = this.operand1.Read();
			var val2 = this.operand2.Read();
			var res = val1 + val2;
			/* ==== /Malloc ==== */
			this.operand1.Write(res);
			
			this.setFlags(val1, val2, res);
		// Logical AND
		}, "AND": function () {
			/* ==== Malloc ==== */
			var val1 = this.operand1.Read();
			var val2 = this.operand2.Read();
			var res = val1 & val2;
			/* ==== /Malloc ==== */
			this.operand1.Write(res);
			
			this.setFlags(val1, val2, res);
		// Adjusted Requested Privilege Level of Selector ( 286+ Protected Mode )
		}, "ARPL": function () {
			throw new Error( "Execute (ARPL): No Protected Mode support yet." );
			/* ==== Malloc ==== */
			var RPL_Source = operand2.getRPL();
			/* ==== /Malloc ==== */
			
			if ( this.operand1.getRPL() < RPL_Source ) {
				CPU.ZF.set();
				this.operand1.setRPL(RPL_Source);
			} else {
				CPU.ZF.clear();
			}
		// Array Index Bound Check ( 80188+ )
		//	Based on http://siyobik.info/index.php?module=x86&id=18
		}, "BOUND": function () {
			throw new Error( "Execute (ARPL): No Array bounds support yet." );
		// Bit Scan Forward ( 386+ )
		//	TODO: how to handle other flags? Intel docs say undefined,
		//	but other sources say should be handled just as for other insns
		}, "BSF": function () {
			/* ==== Malloc ==== */
			var sizeBits = this.sizeOperand_Bytes * 8;
			var val = this.operand2.Read();
			/* ==== /Malloc ==== */
			// Find Least Significant Bit set
			for ( var idx_bit = 0 ; idx_bit < sizeBits ; ++idx_bit ) {
				// Found a set bit
				if ( (val >> idx_bit) & 0x01 ) {
					this.operand1.Write(idx_bit);	//this.operand1.reg.set(idx_bit);
					CPU.ZF.clear();
					return;
				}
			}
			// At this point, dest operand's value is undefined ( no set bit found ),
			//	so we will use zero ( and flag explicitly with Zero Flag )
			this.operand1.Write(0x00);	//this.operand1.reg.set(0x00);
			CPU.ZF.set();
		// Bit Scan Reverse ( 386+ )
		}, "BSR": function () {
			/* ==== Malloc ==== */
			var sizeBits = this.sizeOperand_Bytes * 8;
			var val = this.operand2.Read();
			/* ==== /Malloc ==== */
			// Find Most Significant Bit set
			for ( var idx_bit = sizeBits - 1 ; idx_bit >= 0 ; --idx_bit ) {
				// Found a set bit
				if ( (val >> idx_bit) & 0x01 ) {
					this.operand1.Write(idx_bit);	//this.operand1.reg.set(idx_bit);
					CPU.ZF.clear();
					return;
				}
			}
			// At this point, dest operand's value is undefined ( no set bit found ),
			//	so we will use zero ( and flag explicitly with Zero Flag )
			this.operand1.Write(0x00);	//this.operand1.reg.set(0x00);
			CPU.ZF.set();
		// Byte Swap ( 486+ )
		//	- Reverses the byte order of a 32-bit register.
		}, "BSWAP": function () {
			/* ==== Malloc ==== */
			var val = this.operand1.Read();
			/* ==== /Malloc ==== */
			// Bits 0 through 7 are swapped with bits 24 through 31, and bits 8 through 15 are swapped with bits 16 through 23.
			this.operand1.Write(
					((val & 0xFF000000) >> 24)
					| ((val & 0xFF0000) >> 8)
					| ((val & 0xFF00) << 8)
					| ((val & 0xFF) << 24)
				);
		// Bit Test ( 386+ )
		}, "BT": function () {
			// Read bit at specified offset & store in Carry Flag
			CPU.CF.setBit((this.operand1.Read() >> this.operand2.Read()) & 0x01);
		// Bit Test and Compliment ( 386+ )
		}, "BTC": function () {
			/* ==== Malloc ==== */
			var offsetBit = this.operand2.Read();
			var val = this.operand1.Read();
			/* ==== /Malloc ==== */
			// Read bit at specified offset & store in Carry Flag
			CPU.CF.setBit((val >> offsetBit) & 0x01);
			// Complement / toggle the bit just read
			this.operand1.Write(val ^ (1 << offsetBit));
		// Bit Test and Reset ( 386+ )
		}, "BTR": function () {
			/* ==== Malloc ==== */
			var offsetBit = this.operand2.Read();
			var val = this.operand1.Read();
			/* ==== /Malloc ==== */
			// Read bit at specified offset & store in Carry Flag
			CPU.CF.setBit((val >> offsetBit) & 0x01);
			// Clear / reset the bit just read
			this.operand1.Write(val & ~(1 << offsetBit));
		// Bit Test and Set ( 386+ )
		}, "BTS": function () {
			/* ==== Malloc ==== */
			var offsetBit = this.operand2.Read();
			var val = this.operand1.Read();
			/* ==== /Malloc ==== */
			// Read bit at specified offset & store in Carry Flag
			CPU.CF.setBit((val >> offsetBit) & 0x01);
			// Set the bit just read
			this.operand1.Write(val | (1 << offsetBit));
		// Procedure Call - Near, relative, displacement is relative to next instruction ( adding to EIP )
		//	( within current code segment / intrasegment call )
		}, "CALLN_R": function () {
			/* ==== Malloc ==== */
			var sizeOperand_Bytes = this.sizeOperand_Bytes;
			var EIP = CPU.EIP.get();
			/* ==== /Malloc ==== */
			// General Protection fault / exception if InstructionPointer goes out of bounds for the current Code Segment
			if ( !this.InCodeSegmentLimits(EIP) ) { CPUException("GP", 0); return; }
			// 16-bit
			if ( sizeOperand_Bytes == 2 ) {
				// Stack overflow error if no stack space ( 2 bytes / 16-bit )
				if ( this.getStackSpace() < 2 ) { CPUException("SS", 0); return; }
				// Push only IP ( save another get by just masking out high word )
				CPU.PushStack(EIP & 0xFFFF, 2);
				// Destination is rel16
				CPU.EIP.set((EIP + this.operand1.Read()) & 0xFFFF);
			// 32-bit
			} else {
				// Stack overflow error if no stack space ( 4 bytes / 32-bit )
				if ( this.getStackSpace() < 4 ) { CPUException("SS", 0); return; }
				// Push full 32-bit wide EIP
				CPU.PushStack(EIP, 4);
				// Destination is rel32
				CPU.EIP.set(EIP + this.operand1.Read());
			}
		// Procedure Call - Near, absolute indirect ( indirect means value is not encoded in insn - read from reg or mem )
		//	( within current code segment / intrasegment call )
		}, "CALLN_AI": function () {
			/* ==== Malloc ==== */
			var sizeOperand_Bytes = this.sizeOperand_Bytes;
			var EIP = CPU.EIP.get();
			/* ==== /Malloc ==== */
			// General Protection fault / exception if InstructionPointer goes out of bounds for the current Code Segment
			if ( !this.InCodeSegmentLimits(EIP) ) { CPUException("GP", 0); return; }
			// 16-bit
			if ( sizeOperand_Bytes == 2 ) {
				// Stack overflow error if no stack space ( 2 bytes / 16-bit )
				if ( this.getStackSpace() < 2 ) { CPUException("SS", 0); return; }
				// Push only IP ( save another get by just masking out high word )
				CPU.PushStack(EIP & 0xFFFF, 2);
				// Destination is r/m16
				CPU.EIP.set(this.operand1.Read() & 0xFFFF);
			// 32-bit
			} else {
				// Stack overflow error if no stack space ( 4 bytes / 32-bit )
				if ( this.getStackSpace() < 4 ) { CPUException("SS", 0); return; }
				// Push full 32-bit wide EIP
				CPU.PushStack(EIP, 4);
				// Destination is r/m32
				CPU.EIP.set(this.operand1.Read());
			}
		// Procedure Call - Far, absolute, address given in operand
		//	( other code segment / intersegment call )
		}, "CALLF_A": function () {
			/* ==== Malloc ==== */
			var sizeOperand_Bytes = this.sizeOperand_Bytes;
			var EIP = CPU.EIP.get();
			/* ==== /Malloc ==== */
			// General Protection fault / exception if InstructionPointer goes out of bounds for the current Code Segment
			if ( !this.InCodeSegmentLimits(EIP) ) { CPUException("GP", 0); return; }
			// Real or Virtual-8086 mode ( PE is the Protection Enable bit in CR0, VM is the EFLAGS's Virtual-8086 enable flag )
			if ( !CPU.PE.get() || (CPU.PE.get() && CPU.VM.get()) ) {
				// 16-bit
				if ( sizeOperand_Bytes == 2 ) {
					// Stack overflow error if no stack space ( 4 bytes / 16-bit CS + 16-bit IP )
					if ( this.getStackSpace() < 4 ) { CPUException("SS", 0); return; }
					// Push CS
					CPU.PushStack(CPU.CS.get() & 0xFFFF, 2);
					// Push only IP ( save another get by just masking out high word )
					CPU.PushStack(EIP & 0xFFFF, 2);
					// Destination is ptr16:16 or [m16:16]
					var dest = this.operand1.Read();
					CPU.CS.set(dest >> 16);
					CPU.EIP.set(dest & 0xFFFF);
				// 32-bit
				} else {
					// Stack overflow error if no stack space ( 6 bytes / 16-bit CS + 32-bit EIP )
					if ( this.getStackSpace() < 6 ) { CPUException("SS", 0); return; }
					// Push CS
					CPU.PushStack(CPU.CS.get() & 0xFFFF, 2);
					// Push full 32-bit wide EIP
					CPU.PushStack(EIP, 4);
					// Destination is ptr16:32 or [m16:32]
					var dest = this.operand1.Read();
					CPU.CS.set(dest >> 32);
					CPU.EIP.set(dest & 0xFFFFFFFF);
				}
			}
		// Procedure Call - Far, absolute indirect ( indirect means value is not encoded in insn - read from reg or mem )
		//	( other code segment / intersegment call )
		}, "CALLF_AI": function () {
			throw new Error( "Execute (CALLF_AI): unsupported" );
		// Convert Byte to Word, or Convert Word to Double in EAX
		}, "CBW": function () {
			/* ==== Malloc ==== */
			var AX;
			/* ==== /Malloc ==== */
			// Sign-extend AL into AH
			if ( this.sizeOperand_Bytes == 2 ) {
				CPU.AH.set((CPU.AL.get() >> 7) ? 0xFF : 0x00);
			// Sign-extend AX into high word of EAX
			} else {
				AX = CPU.AX.get();
				CPU.EAX.set(((AX >> 15) ? 0xFFFF0000 : 0x00) | AX);
			}
		// Convert Double to Quad ( 386+ )
		}, "CDQ": function () {
			throw new Error( "Execute (CDQ): unsupported" );
		// Clear Carry flag
		}, "CLC": function () {
			CPU.CF.clear();
		// Clear Direction flag
		}, "CLD": function () {
			CPU.DF.clear();
		// Clear Interrupt flag - disables the maskable hardware interrupts. NMI's and software interrupts are not inhibited.
		}, "CLI": function () {
			//	TODO: support VIF ( Virtual Interrupt Flag ( V86 mode ) )
			CPU.IF.clear();
		// Clear Task Switched flag ( 286+ privileged )
		}, "CLTS": function () {
			// Current Privilege Level must be zero in Protected Mode
			if ( CPU.PE.get() && CPU.CPL.get() > 0 ) { CPUException("GP", 0); }
			// Task-Switched flag cleared in CR0
			CPU.TS.clear();
		// Complement/toggle/invert Carry flag
		}, "CMC": function () {
			CPU.CF.Toggle();
		// Compare ( subtracts two operands, only modifies flags, discards result )
		//	TODO:	- probably has no reason to use lazy flags, as it will always be followed
		//			by a conditional jump. ( ie. should call CPU.ZF.set() etc. )
		}, "CMP": function () {
			/* ==== Malloc ==== */
			var val1 = this.operand1.Read();
			var val2 = this.operand2.Read();
			var res = val1 - val2;
			/* ==== /Malloc ==== */
			// Do not store result of subtraction; only flags
			this.setFlags(val1, val2, res);
		// Compare String ( Byte, Word or Dword )
		//	TODO:	- could be polymorphic, one func for each string-repeat type
		//			- probably has no reason to use lazy flags, as it will always be followed
		//				by a conditional jump. ( ie. should call CPU.ZF.set() etc. )
		}, "CMPS": function () {
			/* ==== Malloc ==== */
			var sizeOperand_Bytes = this.sizeOperand_Bytes;
			var val1 = 0;
			var val2 = 0;
			var res = 0;
			var idxESI;
			var idxEDI;
			var idxEndESI;
			var len;
			/* ==== /Malloc ==== */
			switch ( this.typeStringRepeat ) {
			// Common case; no repeat prefix
			case "":
				/* ==== Malloc ==== */
				val1 = this.operand1.Read();
				val2 = this.operand2.Read();
				res = val1 - val2;
				/* ==== /Malloc ==== */
				// Direction Flag set, decrement ( scan in reverse direction )
				if ( CPU.DF.get() ) {
					CPU.ESI.set(CPU.ESI.get() - 1);
					CPU.EDI.set(CPU.EDI.get() - 1);
				// Direction Flag clear, increment ( scan in forward direction )
				} else {
					CPU.ESI.set(CPU.ESI.get() + 1);
					CPU.EDI.set(CPU.EDI.get() + 1);
				}
				// Do not store result of subtraction; only flags
				this.setFlags(val1, val2, res);
				break;
			// Repeat CX times
			case "#REP":	// Deliberate fall-thru; see below
			// Repeat while Equal, max CX times
			case "#REPE":	// For CMPS, it would make little sense to use REP CMPS ( ... ),
							//	as it would only compare the last 2 characters, so these are tied together
				len = CPU.CX.get() + 1;	// Add 1 to allow more efficient pre-decrement ( see below )
				idxESI = CPU.ESI.get();
				idxEDI = CPU.EDI.get();
				// Direction Flag set, decrement ( scan in reverse direction )
				if ( CPU.DF.get() ) {
					// Loop CX times ( may exit early if NOT equal, see below )
					while ( --len ) {
						val1 = this.operand1.Read();
						val2 = this.operand2.Read();
						
						CPU.ESI.set(idxESI -= sizeOperand_Bytes);
						CPU.EDI.set(idxEDI -= sizeOperand_Bytes);
						
						// Stop checking if NOT equal
						if ( val1 !== val2 ) { break; }
					}
				// Direction Flag clear, increment ( scan in forward direction )
				} else {
					// Loop CX times ( may exit early if NOT equal, see below )
					while ( --len ) {
						val1 = this.operand1.Read();
						val2 = this.operand2.Read();
						
						CPU.ESI.set(idxESI += sizeOperand_Bytes);
						CPU.EDI.set(idxEDI += sizeOperand_Bytes);
						
						// Stop checking if NOT equal
						if ( val1 !== val2 ) { break; }
					}
				}
				// Do not store result of subtraction; only flags
				//	NB: it is worth noting that subtraction actually only has to take place here,
				//		after the tight ( hopefully efficient ) loop above
				this.setFlags(val1, val2, val1 - val2);
				CPU.CX.set(len);
				break;
			// Repeat while NOT Equal, max CX times
			case "#REPNE":
				len = CPU.CX.get() + 1;	// Add 1 to allow more efficient pre-decrement ( see below )
				idxESI = CPU.ESI.get();
				idxEDI = CPU.EDI.get();
				// Direction Flag set, decrement ( scan in reverse direction )
				if ( CPU.DF.get() ) {
					// Loop CX times ( may exit early if not equal, see below )
					while ( --len ) {
						val1 = this.operand1.Read();
						val2 = this.operand2.Read();
						
						CPU.ESI.set(idxESI -= sizeOperand_Bytes);
						CPU.EDI.set(idxEDI -= sizeOperand_Bytes);
						
						// Stop checking if equal
						if ( val1 === val2 ) { break; }
					}
				// Direction Flag clear, increment ( scan in forward direction )
				} else {
					// Loop CX times ( may exit early if not equal, see below )
					while ( --len ) {
						val1 = this.operand1.Read();
						val2 = this.operand2.Read();
						
						CPU.ESI.set(idxESI += sizeOperand_Bytes);
						CPU.EDI.set(idxEDI += sizeOperand_Bytes);
						
						// Stop checking if equal
						if ( val1 === val2 ) { break; }
					}
				}
				// Do not store result of subtraction; only flags
				//	NB: it is worth noting that subtraction actually only has to take place here,
				//		after the tight ( hopefully efficient ) loop above
				this.setFlags(val1, val2, val1 - val2);
				CPU.CX.set(len);
				break;
			default:
				throw new Error( "Execute (CMPS): invalid string repeat operation/prefix." );
			}
		// Compare and Exchange ( 486+ )
		}, "CMPXCHG": function () {
			/* ==== Malloc ==== */
			var val1 = this.operand1.Read();
			var val2 = this.operand2.Read();
			var res = val1 - val2;
			/* ==== /Malloc ==== */
			// NB: the Intel specs say just copy src -> dest or dest -> src;
			//	however, an XCHG would do an actual swap, so this may be incorrect
			if ( res === 0 ) {
				this.operand1.Write(val2);
			} else {
				this.operand2.Write(val1);
			}
			// Do not store result of subtraction; only flags
			this.setFlags(val1, val2, res);
		// Compare and Exchange 8 bytes ( Pentium+ )
		}, "CMPXCHG8": function () {
			/* ==== Malloc ==== */
			var val1 = this.operand1.Read();
			var val2 = (CPU.EDX.get() << 32) | CPU.EAX.get();
			var res = val1 - val2;
			/* ==== /Malloc ==== */
			// NB: the Intel specs say just copy src -> dest or dest -> src;
			//	however, an XCHG would do an actual swap, so this may be incorrect
			if ( res === 0 ) {
				// WARN! use of ECX:EBX here, _NOT_ the tested EDX:EAX!
				this.operand1.Write((CPU.ECX.get() << 32) | CPU.EBX.get());
			} else {
				CPU.EAX.set(val1 & 0xFFFFFFFF);
				CPU.EDX.set(val1 >> 32);
			}
			// Do not store result of subtraction; only flags
			this.setFlags(val1, val2, res);
		// Convert Word to Dword, or Dword to Quadword
		}, "CWD": function () {
			/* ==== Malloc ==== */
			var AX;
			/* ==== /Malloc ==== */
			// Sign-extend AX into DX:AX
			if ( this.sizeOperand_Bytes == 2 ) {
				CPU.DX.set((CPU.AX.get() >> 15) ? 0xFF : 0x00);
			// Sign-extend EAX into EDX
			} else {
				CPU.EDX.set(((CPU.EAX.get() >> 31) ? 0xFFFFFFFF : 0x00));
			}
		// Convert Word to Extended Dword ( 386+ )
		}, "CWDE": function () {
			throw new Error( "Execute (CWDE): unsupported" );
		// Decimal Adjust after Addition
		}, "DAA": function () {
			throw new Error( "Execute (DAA): unsupported" );
		// Decimal Adjust for Subtraction
		}, "DAS": function () {
			throw new Error( "Execute (DAS): unsupported" );
		// Decrement
		}, "DEC": function () {
			// NB: Addition and subtraction handle two's complement the same way
			//	for both unsigned and signed interpretations of numbers
			/* ==== Malloc ==== */
			var val = this.operand1.Read() - 1;
			/* ==== /Malloc ==== */
			this.operand1.Write(val);
			
			this.setFlags_Result(val);
		// Unsigned Divide
		}, "DIV": function () {
			/* ==== Malloc ==== */
			var sizeOperand_Bytes = this.sizeOperand_Bytes;
			// NB: Default is to interpret as UNsigned
			var dividend = this.operand1.Read();
			var divisor = this.operand2.Read();
			var res;
			/* ==== /Malloc ==== */
			// Divide by Zero - CPU Interrupt
			if ( /*dividend == 0 || */divisor == 0 ) { CPU.Interrupt(0); return; }
			// Integer result - truncated toward zero
			res = (dividend / divisor) >> 0;
			// Dividend is AX
			if ( sizeOperand_Bytes == 1 ) {
				// Integer result is written to quotient
				CPU.AL.set(res);
				// Remainder
				CPU.AH.set(dividend % divisor);
			// Dividend is DX:AX
			} else if ( sizeOperand_Bytes == 2 ) {
				// Integer result is written to quotient
				CPU.AX.set(res);
				// Remainder
				CPU.DX.set(dividend % divisor);
			// Dividend is EDX:EAX
			} else if ( sizeOperand_Bytes == 4 ) {
				// Integer result is written to quotient
				CPU.EAX.set(res);
				// Remainder
				CPU.EDX.set(dividend % divisor);
			}
			
			this.setFlags(dividend, divisor, res);
		// Make Stack Frame ( 80188+ )
		}, "ENTER": function () {
			/* ==== Malloc ==== */
			var sizeOperand_Bytes = this.sizeOperand_Bytes;
			var bytesStack = this.operand1.Read();
			var levelLexicalNesting = this.operand2.Read() % 32;
			var EBP = CPU.EBP.get();
			var ESP;
			/* ==== /Malloc ==== */
			
			if ( sizeOperand_Bytes == 2 ) {
				CPU.PushStack(EBP & 0xFF, 1);
			} else {
				CPU.PushStack(EBP, 2);
			}
			// Save Frame pointer
			//	( NB: this is done after the push() above, as SP would be modified )
			ESP = CPU.ESP.get();
			
			if ( levelLexicalNesting > 0 ) {
				for ( var i = 1 ; i < levelLexicalNesting ; ++i ) {
					if ( sizeOperand_Bytes == 2 ) {
						CPU.EBP.set(EBP = EBP - 2);
						CPU.PushStack(EBP & 0xFF, 1);
					} else {
						CPU.EBP.set(EBP = EBP - 4);
						CPU.PushStack(EBP, 2);
					}
				}
				CPU.PushStack(ESP, 2);
			}
			// Set Frame pointer to current Stack pointer
			CPU.EBP.set(ESP);
			// Subtract num bytes allocated from Stack pointer
			//	( NB: ESP re-read for here, push()s above will have changed it )
			CPU.ESP.set(CPU.ESP.get() - bytesStack);
		// Escape
		}, "ESC": function () {
			throw new Error( "Execute (ESC): unsupported" );
		// Halt CPU
		//	( Or jemul8 Hypervisor escape - see notes below )
		}, "HLT": function () {
			/* ========= Hypervisor escape ========= */
			/*
			 *	This command has been "overloaded" to facilitate the high-level
			 *	emulation of BIOS interrupts; the entries in the IDT MUST point
			 *	to valid code Instruction addresses, because real-mode programs
			 *	are free to "hook" Interrupts by reading the current Int CS:IP, storing
			 *	it in their own memory, replacing the entry with the address of their
			 *	own handler and calling the previous handler at the end of their own.
			 *	HLT is used as it is a reasonably rare Instruction, so the extra overhead
			 *	of handling Hypervisor escaping should not cause a problem.
			 
			var func_interruptHandler;
			// Look up this Instruction's address in the list of Hypervisor calls
			//	to internal Interrupt handlers
			if ( func_interruptHandler = CPU.arr_mapAbsoluteOffset_ToHLEInterruptHandler[this.offsetAddress] ) {
				// Quickly dispatch to internal Interrupt handler
				func_interruptHandler.call(CPU);
				return;
			}*/
			/* ========= /Hypervisor escape ========= */
			/**** If we reached this point, it was just a normal HLT command ****/
			
			CPU.Halt();
		// Signed Integer Division
		}, "IDIV": function () {
			/* ==== Malloc ==== */
			var sizeOperand_Bytes = this.sizeOperand_Bytes;
			// NB: Interpret as signed
			var dividend = this.SignExtend(this.operand1.Read());
			var divisor = this.SignExtend(this.operand2.Read());
			var res;
			/* ==== /Malloc ==== */
			// Divide by Zero - CPU Interrupt
			if ( divisor == 0 ) { CPU.Interrupt(0); return; }
			// Integer result - truncated toward zero
			res = (dividend / divisor) >> 0;
			// Dividend is AX
			if ( sizeOperand_Bytes == 1 ) {
				// Integer result is written to quotient
				CPU.AL.set(res);
				// Remainder
				CPU.AH.set(dividend % divisor);
			// Dividend is DX:AX
			} else if ( sizeOperand_Bytes == 2 ) {
				// Integer result is written to quotient
				CPU.AX.set(res);
				// Remainder
				CPU.DX.set(dividend % divisor);
			// Dividend is EDX:EAX
			} else if ( sizeOperand_Bytes == 4 ) {
				// Integer result is written to quotient
				CPU.EAX.set(res);
				// Remainder
				CPU.EDX.set(dividend % divisor);
			}
			
			this.setFlags(dividend, divisor, res);
		// Signed Multiply
		//	WARNING!!!!!!!!!!!!!!! there are other forms of this instruction that do not use these implicit accum. operands!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
		}, "IMUL": function () {
			/* ==== Malloc ==== */
			var sizeOperand_Bytes = this.sizeOperand_Bytes;
			// NB: Interpret as signed
			var multiplicand = this.SignExtend(this.operand1.Read());
			var multiplier = this.SignExtend(this.operand2.Read());
			var res;
			/* ==== /Malloc ==== */
			// Integer result - ( integer inputs guarantees integer result, 
			//	no need for truncating )
			res = multiplicand * multiplier;
			// Dividend is AX
			if ( sizeOperand_Bytes == 1 ) {
				// Integer result is written to AX
				CPU.AX.set(res);
			// Dividend is DX:AX
			} else if ( sizeOperand_Bytes == 2 ) {
				// Integer result is written to DX:AX
				CPU.DX.set((res & 0xFFFF0000) >> 16);
				CPU.AX.set(res & 0x0000FFFF);
			// Dividend is EDX:EAX
			} else if ( sizeOperand_Bytes == 4 ) {
				// Integer result is written to EDX:EAX
				CPU.EDX.set((res & 0xFFFFFFFF00000000) >> 16);
				CPU.EAX.set(res & 0x00000000FFFFFFFF);
			}
			
			this.setFlags(multiplicand, multiplier, res);
		// Input Byte or Word from Port
		}, "IN": function () {
			var addr_port = this.operand2.Read();
			var dest = this.operand1;
			var lenIO = this.sizeOperand_Bytes;
			// All ports are initialised with null handlers,
			//	so there will always be a valid port object available
			var port = machine.hsh_portIORead[ addr_port ];
			var result;
			
			if ( port.mask & lenIO ) {
				result = port.fn(port.device, addr_port, lenIO);
			} else {
				if ( lenIO === 1 ) { result = 0xFF;
				} else if ( lenIO === 2 ) { result = 0xFFFF;
				} else { result = 0xFFFFFFFF; }
				
				// Don't flood the logs when probing PCI (from Bochs)
				if ( addr_port !== 0x0CF8 ) {
					jemul8.Error("Execute (IN) :: Read from port " + jemul8.HexFormat(addr_port) + " with length " + lenIO + " ignored");
				}
			}
			dest.Write(result);
		// Increment
		}, "INC": function () {
			// NB: Addition and subtraction handle two's complement the same way
			//	for both unsigned and signed interpretations of numbers
			/* ==== Malloc ==== */
			var val = this.operand1.Read() + 1;
			/* ==== /Malloc ==== */
			this.operand1.Write(val);
			
			this.setFlags_Result(val);
		// Input String from Port ( 80188+ )
		}, "INS": function () {
			throw new Error( "Execute (INS) :: Not implemented yet" );
		// Software-generated interrupt
		}, "INT": function () {
			CPU.Interrupt(this.operand1.Read());
		// Interrupt 4 on Overflow
		}, "INTO": function () {
			// Interrupt number is implicitly 4 ( Overflow Exception ),
			//	and only called if Overflow Flag set
			if ( CPU.OF.get() ) {
				CPU.Interrupt(4);
			}
		// Invalidate Cache ( 486+ )
		}, "INVD": function () {
			throw new Error( "Execute (INVD): unsupported" );
		// Invalidate Translation Look-Aside Buffer Entry ( 486+ )
		}, "INVLPG": function () {
			throw new Error( "Execute (INVLPG): unsupported" );
		// Perform a far return after Interrupt handling
		//	NB: not used by internal Hypervisor Interrupt Service Routines, for speed
		//	as (E)FLAGS register never needs to be restored after their exec ( it is unaffected )
		//	Based on http://pdos.csail.mit.edu/6.828/2005/readings/i386/IRET.htm
		}, "IRET": function () {
			if ( this.sizeOperand_Bytes === 2 ) {
				CPU.IP.set(CPU.PopStack(2));
			} else {
				CPU.EIP.set(CPU.PopStack(4));
			}
			CPU.CS.set(CPU.PopStack(2));
			if ( this.sizeOperand_Bytes === 2 ) {
				CPU.FLAGS.set(CPU.PopStack(2));
			} else {
				CPU.EFLAGS.set(CPU.PopStack(4));
			}
		/* ======= Conditional Jump Instructions ======= */
		/*
		 *	Many of these conditions may be interpreted in one of
		 *	several ways; the mnemonics used here are the first
		 *	in the list provided in the Intel Instruction Formats & Encodings,
		 *	Table B-8.
		 *	( eg. JE (Jump if Equal) is identical to JZ (Jump if Zero),
		 *	as both will jump if the Zero Flag (ZF) is set. )
		 */
		// Jump if Overflow
		}, "JO": function () {
			// Quickly skip if condition not met
			if ( !CPU.OF.get() ) { return; }
			/* ==== Malloc ==== */
			// NB: Interpret as signed
			var EIPNew = CPU.EIP.get() + this.SignExtend(this.operand1.Read());
			/* ==== /Malloc ==== */
			// Wrap 16-bit addresses
			if ( this.sizeOperand_Bytes == 2 ) { EIPNew &= 0x0000FFFF; }
			CPU.EIP.set(EIPNew);
		// Jump if NO Overflow
		}, "JNO": function () {
			// Quickly skip if condition not met
			if ( CPU.OF.get() ) { return; }
			/* ==== Malloc ==== */
			// NB: Interpret as signed
			var EIPNew = CPU.EIP.get() + this.SignExtend(this.operand1.Read());
			/* ==== /Malloc ==== */
			// Wrap 16-bit addresses
			if ( this.sizeOperand_Bytes == 2 ) { EIPNew &= 0x0000FFFF; }
			CPU.EIP.set(EIPNew);
		// Jump if Below
		}, "JB": function () {
			// Quickly skip if condition not met
			if ( !CPU.CF.get() ) { return; }
			/* ==== Malloc ==== */
			// NB: Interpret as signed
			var EIPNew = CPU.EIP.get() + this.SignExtend(this.operand1.Read());
			/* ==== /Malloc ==== */
			// Wrap 16-bit addresses
			if ( this.sizeOperand_Bytes == 2 ) { EIPNew &= 0x0000FFFF; }
			CPU.EIP.set(EIPNew);
		// Jump if NOT Below
		}, "JNB": function () {
			// Quickly skip if condition not met
			if ( CPU.CF.get() ) { return; }
			/* ==== Malloc ==== */
			// NB: Interpret as signed
			var EIPNew = CPU.EIP.get() + this.SignExtend(this.operand1.Read());
			/* ==== /Malloc ==== */
			// Wrap 16-bit addresses
			if ( this.sizeOperand_Bytes == 2 ) { EIPNew &= 0x0000FFFF; }
			CPU.EIP.set(EIPNew);
		// Jump if Equal
		}, "JE": function () {
			// Quickly skip if condition not met
			if ( !CPU.ZF.get() ) { return; }
			/* ==== Malloc ==== */
			// NB: Interpret as signed
			var EIPNew = CPU.EIP.get() + this.SignExtend(this.operand1.Read());
			/* ==== /Malloc ==== */
			// Wrap 16-bit addresses
			if ( this.sizeOperand_Bytes == 2 ) { EIPNew &= 0x0000FFFF; }
			CPU.EIP.set(EIPNew);
		// Jump if NOT Equal
		}, "JNE": function () {
			// Quickly skip if condition not met
			if ( CPU.ZF.get() ) { return; }
			/* ==== Malloc ==== */
			// NB: Interpret as signed
			var EIPNew = CPU.EIP.get() + this.SignExtend(this.operand1.Read());
			/* ==== /Malloc ==== */
			// Wrap 16-bit addresses
			if ( this.sizeOperand_Bytes == 2 ) { EIPNew &= 0x0000FFFF; }
			CPU.EIP.set(EIPNew);
		// Jump if Below or Equal
		}, "JBE": function () {
			// Quickly skip if condition not met
			if ( !CPU.CF.get() && !CPU.ZF.get() ) { return; }
			/* ==== Malloc ==== */
			// NB: Interpret as signed
			var EIPNew = CPU.EIP.get() + this.SignExtend(this.operand1.Read());
			/* ==== /Malloc ==== */
			// Wrap 16-bit addresses
			if ( this.sizeOperand_Bytes == 2 ) { EIPNew &= 0x0000FFFF; }
			CPU.EIP.set(EIPNew);
		// Jump if NOT Below or Equal
		}, "JNBE": function () {
			// Quickly skip if condition not met
			if ( CPU.CF.get() || CPU.ZF.get() ) { return; }
			/* ==== Malloc ==== */
			// NB: Interpret as signed
			var EIPNew = CPU.EIP.get() + this.SignExtend(this.operand1.Read());
			/* ==== /Malloc ==== */
			// Wrap 16-bit addresses
			if ( this.sizeOperand_Bytes == 2 ) { EIPNew &= 0x0000FFFF; }
			CPU.EIP.set(EIPNew);
		// Jump if Sign
		}, "JS": function () {
			// Quickly skip if condition not met
			if ( !CPU.SF.get() ) { return; }
			/* ==== Malloc ==== */
			// NB: Interpret as signed
			var EIPNew = CPU.EIP.get() + this.SignExtend(this.operand1.Read());
			/* ==== /Malloc ==== */
			// Wrap 16-bit addresses
			if ( this.sizeOperand_Bytes == 2 ) { EIPNew &= 0x0000FFFF; }
			CPU.EIP.set(EIPNew);
		// Jump if NOT Sign
		}, "JNS": function () {
			// Quickly skip if condition not met
			if ( CPU.SF.get() ) { return; }
			/* ==== Malloc ==== */
			// NB: Interpret as signed
			var EIPNew = CPU.EIP.get() + this.SignExtend(this.operand1.Read());
			/* ==== /Malloc ==== */
			// Wrap 16-bit addresses
			if ( this.sizeOperand_Bytes == 2 ) { EIPNew &= 0x0000FFFF; }
			CPU.EIP.set(EIPNew);
		// Jump if Parity / Parity Even
		}, "JP": function () {
			// Quickly skip if condition not met
			if ( !CPU.PF.get() ) { return; }
			/* ==== Malloc ==== */
			// NB: Interpret as signed
			var EIPNew = CPU.EIP.get() + this.SignExtend(this.operand1.Read());
			/* ==== /Malloc ==== */
			// Wrap 16-bit addresses
			if ( this.sizeOperand_Bytes == 2 ) { EIPNew &= 0x0000FFFF; }
			CPU.EIP.set(EIPNew);
		// Jump if NOT Parity / Parity Even
		}, "JNP": function () {
			// Quickly skip if condition not met
			if ( CPU.PF.get() ) { return; }
			/* ==== Malloc ==== */
			// NB: Interpret as signed
			var EIPNew = CPU.EIP.get() + this.SignExtend(this.operand1.Read());
			/* ==== /Malloc ==== */
			// Wrap 16-bit addresses
			if ( this.sizeOperand_Bytes == 2 ) { EIPNew &= 0x0000FFFF; }
			CPU.EIP.set(EIPNew);
		// Jump if Less Than
		}, "JL": function () {
			// Quickly skip if condition not met
			if ( CPU.SF.get() === CPU.OF.get() ) { return; }
			/* ==== Malloc ==== */
			// NB: Interpret as signed
			var EIPNew = CPU.EIP.get() + this.SignExtend(this.operand1.Read());
			/* ==== /Malloc ==== */
			// Wrap 16-bit addresses
			if ( this.sizeOperand_Bytes == 2 ) { EIPNew &= 0x0000FFFF; }
			CPU.EIP.set(EIPNew);
		// Jump if NOT Less Than
		}, "JNL": function () {
			// Quickly skip if condition not met
			if ( CPU.SF.get() !== CPU.OF.get() ) { return; }
			/* ==== Malloc ==== */
			// NB: Interpret as signed
			var EIPNew = CPU.EIP.get() + this.SignExtend(this.operand1.Read());
			/* ==== /Malloc ==== */
			// Wrap 16-bit addresses
			if ( this.sizeOperand_Bytes == 2 ) { EIPNew &= 0x0000FFFF; }
			CPU.EIP.set(EIPNew);
		// Jump if Less Than or Equal
		}, "JLE": function () {
			// Quickly skip if condition not met
			if ( !CPU.ZF.get() && (CPU.SF.get() === CPU.OF.get()) ) { return; }
			/* ==== Malloc ==== */
			// NB: Interpret as signed
			var EIPNew = CPU.EIP.get() + this.SignExtend(this.operand1.Read());
			/* ==== /Malloc ==== */
			// Wrap 16-bit addresses
			if ( this.sizeOperand_Bytes == 2 ) { EIPNew &= 0x0000FFFF; }
			CPU.EIP.set(EIPNew);
		// Jump if NOT Less Than or Equal
		}, "JNLE": function () {
			// Quickly skip if condition not met
			if ( CPU.ZF.get() && (CPU.SF.get() !== CPU.OF.get()) ) { return; }
			/* ==== Malloc ==== */
			// NB: Interpret as signed
			var EIPNew = CPU.EIP.get() + this.SignExtend(this.operand1.Read());
			/* ==== /Malloc ==== */
			// Wrap 16-bit addresses
			if ( this.sizeOperand_Bytes == 2 ) { EIPNew &= 0x0000FFFF; }
			CPU.EIP.set(EIPNew);
		// Jump if Register CX is Zero
		// Jump if Register ECX is Zero ( 386+ )
		//	( NB: this conditional jump has no inverse )
		}, "JCXZ": function () {
			/* ==== Malloc ==== */
			var EIPNew;
			var sizeOperand_Bytes = this.sizeOperand_Bytes;
			/* ==== /Malloc ==== */
			// Quickly skip if condition not met
			// JCXZ
			if ( sizeOperand_Bytes == 2 ) {
				if ( CPU.CX.get() !== 0 ) { return; }
			// JECXZ
			} else {
				if ( CPU.ECX.get() !== 0 ) { return; }
			}
			
			// NB: Interpret as signed
			EIPNew = CPU.EIP.get() + this.SignExtend(this.operand1.Read());
			// Wrap 16-bit addresses
			if ( sizeOperand_Bytes == 2 ) { EIPNew &= 0x0000FFFF; }
			CPU.EIP.set(EIPNew);
		/* ======= /Conditional Jump Instructions ======= */
		
		// Unconditional Jump ( Short ( 8-bit ) / Near ( 16-bit ) - relative to next Instruction )
		}, "JMPN": function () {
			/* ==== Malloc ==== */
			// NB: Interpret as signed
			var EIPNew = CPU.EIP.get() + this.SignExtend(this.operand1.Read());
			/* ==== /Malloc ==== */
			// Wrap 16-bit addresses
			if ( this.sizeOperand_Bytes == 2 ) { EIPNew &= 0x0000FFFF; }
			CPU.EIP.set(EIPNew);
		// Unconditional Jump ( Far - ( if indirect, address is read from memory pointer or register ) )
		}, "JMPF": function () {
			/* ==== Malloc ==== */
			// NB: Do not interpret as signed; cannot have an absolute EIP that is negative
			var CS_EIP = this.operand1.Read();
			/* ==== /Malloc ==== */
			// 32-bit pointer
			if ( this.sizeOperand_Bytes == 4 ) {
				CPU.CS.set(CS_EIP >> 16);
				CPU.EIP.set(CS_EIP & 0xFFFF);
			// 48-bit pointer ( NOT 64-bit; even though EIP is 32-bit,
			//	CS is still 16-bit
			} else {
				CPU.CS.set(CS_EIP >> 32);
				CPU.EIP.set(CS_EIP & 0xFFFFFFFF);
			}
		// Load Flags into AH Register
		}, "LAHF": function () {
			// Transfer only the low byte of Flags word to AH
			CPU.AH.set(CPU.FLAGS.get() & 0xFF);
		// Load Access Rights Byte
		}, "LAR": function () {
			throw new Error( "Execute (LAR): unsupported" );
		// Load Effective Address
		}, "LEA": function () {
			// Just compute the Memory Address of second Operand and store it in the first one
			this.operand1.Write(this.ZeroExtend(this.operand2.getPointerAddress(), this.sizeOperand_Bytes));
		// High Level Procedure Exit
		}, "LEAVE": function () {
			// NB: Reverses the actions of the ENTER instruction. 
			//	By copying the frame pointer to the stack pointer,
			//	LEAVE releases the stack space used by a procedure for its local variables.
			if ( CPU.getStackAddressSize() == 16 ) {
				CPU.SP.set(CPU.BP.get());
			} else {
				CPU.ESP.set(CPU.EBP.get());
			}
			if ( this.sizeOperand_Bytes == 2 ) {
				CPU.BP.set(CPU.PopStack());
			} else {
				CPU.EBP.set(CPU.PopStack(4));
			}
		// Load Global Descriptor Table Register
		}, "LGDT": function () {
			throw new Error( "Execute (LGDT): unsupported" );
		// Load Interrupt Descriptor Table Register
		}, "LIDT": function () {
			throw new Error( "Execute (LIDT): unsupported" );
		// Load Full Pointer with DS
		}, "LDS": function () {
			// 16-bit
			if ( this.sizeOperand_Bytes == 2 ) {
				this.operand1.Write(this.operand2.Read());
				CPU.DS.set(DRAM.ReadBytes(this.operand2.getPointerAddress() + 2, 2));
				// In Protected Mode, load the descriptor into the segment register
			// 32-bit
			} else {
				this.operand1.Write(this.operand2.Read());
				CPU.DS.set(DRAM.ReadBytes(this.operand2.getPointerAddress() + 4, 2));
				// In Protected Mode, load the descriptor into the segment register
			}
		// Load Full Pointer with ES
		}, "LES": function () {
			// 16-bit
			if ( this.sizeOperand_Bytes == 2 ) {
				this.operand1.Write(this.operand2.Read());
				CPU.ES.set(DRAM.ReadBytes(this.operand2.getPointerAddress() + 2, 2));
				// In Protected Mode, load the descriptor into the segment register
			// 32-bit
			} else {
				this.operand1.Write(this.operand2.Read());
				CPU.ES.set(DRAM.ReadBytes(this.operand2.getPointerAddress() + 4, 2));
				// In Protected Mode, load the descriptor into the segment register
			}
		// Load Full Pointer with FS
		}, "LFS": function () {
			// 16-bit
			if ( this.sizeOperand_Bytes == 2 ) {
				this.operand1.Write(this.operand2.Read());
				CPU.FS.set(DRAM.ReadBytes(this.operand2.getPointerAddress() + 2, 2));
				// In Protected Mode, load the descriptor into the segment register
			// 32-bit
			} else {
				this.operand1.Write(this.operand2.Read());
				CPU.FS.set(DRAM.ReadBytes(this.operand2.getPointerAddress() + 4, 2));
				// In Protected Mode, load the descriptor into the segment register
			}
		// Load Full Pointer with GS
		}, "LGS": function () {
			// 16-bit
			if ( this.sizeOperand_Bytes == 2 ) {
				this.operand1.Write(this.operand2.Read());
				CPU.GS.set(DRAM.ReadBytes(this.operand2.getPointerAddress() + 2, 2));
				// In Protected Mode, load the descriptor into the segment register
			// 32-bit
			} else {
				this.operand1.Write(this.operand2.Read());
				CPU.GS.set(DRAM.ReadBytes(this.operand2.getPointerAddress() + 4, 2));
				// In Protected Mode, load the descriptor into the segment register
			}
		// Load Full Pointer with SS
		}, "LSS": function () {
			// 16-bit
			if ( this.sizeOperand_Bytes == 2 ) {
				this.operand1.Write(this.operand2.Read());
				CPU.SS.set(DRAM.ReadBytes(this.operand2.getPointerAddress() + 2, 2));
				// In Protected Mode, load the descriptor into the segment register
			// 32-bit
			} else {
				this.operand1.Write(this.operand2.Read());
				CPU.SS.set(DRAM.ReadBytes(this.operand2.getPointerAddress() + 4, 2));
				// In Protected Mode, load the descriptor into the segment register
			}
		// Load Local Descriptor Table Register
		}, "LLDT": function () {
			throw new Error( "Execute (LLDT): unsupported" );
		// Load Machine Status Word
		}, "LMSW": function () {
			throw new Error( "Execute (LMSW): unsupported" );
			// CPU.CR0
		// Load String ( Byte, Word or Dword )
		//	TODO: could be polymorphic, one func for each string-repeat type
		//	TODO: there is potential for speed ups here by using native .indexOf() / .slice() and similar
		//		array methods, instead of a possibly slow loop over each individual byte
		}, "LODS": function () {
			/* ==== Malloc ==== */
			var sizeOperand_Bytes = this.sizeOperand_Bytes;
			var val1;
			var val2;
			var res;
			var idxESI;
			var idxEDI;
			var idxEndESI;
			var len;
			/* ==== /Malloc ==== */
			switch ( this.typeStringRepeat ) {
			// Common case; no repeat prefix
			case "":
				// Load String Character ( Operand 1 is part of Accumulator, Operand 2
				//	will be a memory pointer using (E)SI )
				this.operand1.Write(this.operand2.Read());
				// Direction Flag set, decrement ( scan in reverse direction )
				if ( CPU.DF.get() ) {
					CPU.ESI.set(CPU.ESI.get() - sizeOperand_Bytes);
					CPU.EDI.set(CPU.EDI.get() - sizeOperand_Bytes);
				// Direction Flag clear, increment ( scan in forward direction )
				} else {
					CPU.ESI.set(CPU.ESI.get() + sizeOperand_Bytes);
					CPU.EDI.set(CPU.EDI.get() + sizeOperand_Bytes);
				}
				
				break;
			// Repeat CX times
			case "#REP":
				len = CPU.CX.get();
				idxESI = CPU.ESI.get();
				idxEDI = CPU.EDI.get();
				// Direction Flag set, decrement ( scan in reverse direction )
				if ( CPU.DF.get() ) {
					idxEndESI = idxESI - len * sizeOperand_Bytes;
					for ( ; idxESI >= idxEndESI ; idxESI -= sizeOperand_Bytes, idxEDI -= sizeOperand_Bytes ) {
						CPU.ESI.set(idxESI);
						CPU.EDI.set(idxEDI);
						// Load String Character ( Operand 1 is part of Accumulator, Operand 2
						//	will be a memory pointer using (E)SI )
						this.operand1.Write(this.operand2.Read());
					}
				// Direction Flag clear, increment ( scan in forward direction )
				} else {
					idxEndESI = idxESI + len * sizeOperand_Bytes;
					for ( ; idxESI < idxEndESI ; idxESI += sizeOperand_Bytes, idxEDI += sizeOperand_Bytes ) {
						CPU.ESI.set(idxESI);
						CPU.EDI.set(idxEDI);
						// Load String Character ( Operand 1 is part of Accumulator, Operand 2
						//	will be a memory pointer using (E)SI )
						this.operand1.Write(this.operand2.Read());
					}
				}
				CPU.ESI.set(idxESI);
				CPU.EDI.set(idxEDI);
				break;
			// Repeat while Equal, max CX times
			case "#REPE":
				len = CPU.CX.get();
				idxESI = CPU.ESI.get();
				idxEDI = CPU.EDI.get();
				// Direction Flag set, decrement ( scan in reverse direction )
				if ( CPU.DF.get() ) {
					idxEndESI = idxESI - len * sizeOperand_Bytes;
					for ( ; idxESI >= idxEndESI && CPU.ZF.get() ; idxESI -= sizeOperand_Bytes, idxEDI -= sizeOperand_Bytes ) {
						CPU.ESI.set(idxESI);
						CPU.EDI.set(idxEDI);
						// Load String Character ( Operand 1 is part of Accumulator, Operand 2
						//	will be a memory pointer using (E)SI )
						this.operand1.Write(this.operand2.Read());
					}
				// Direction Flag clear, increment ( scan in forward direction )
				} else {
					idxEndESI = idxESI + len * sizeOperand_Bytes;
					for ( ; idxESI < idxEndESI && CPU.ZF.get() ; idxESI += sizeOperand_Bytes, idxEDI += sizeOperand_Bytes ) {
						CPU.ESI.set(idxESI);
						CPU.EDI.set(idxEDI);
						// Load String Character ( Operand 1 is part of Accumulator, Operand 2
						//	will be a memory pointer using (E)SI )
						this.operand1.Write(this.operand2.Read());
					}
				}
				CPU.ESI.set(idxESI);
				CPU.EDI.set(idxEDI);
				break;
			// Repeat while Not Equal, max CX times
			case "#REPNE":
				len = CPU.CX.get();
				idxESI = CPU.ESI.get();
				idxEDI = CPU.EDI.get();
				// Direction Flag set, decrement ( scan in reverse direction )
				if ( CPU.DF.get() ) {
					idxEndESI = idxESI - len * sizeOperand_Bytes;
					for ( ; idxESI >= idxEndESI && !CPU.ZF.get() ; idxESI -= sizeOperand_Bytes, idxEDI -= sizeOperand_Bytes ) {
						CPU.ESI.set(idxESI);
						CPU.EDI.set(idxEDI);
						// Load String Character ( Operand 1 is part of Accumulator, Operand 2
						//	will be a memory pointer using (E)SI )
						this.operand1.Write(this.operand2.Read());
					}
				// Direction Flag clear, increment ( scan in forward direction )
				} else {
					idxEndESI = idxESI + len * sizeOperand_Bytes;
					for ( ; idxESI < idxEndESI && !CPU.ZF.get() ; idxESI += sizeOperand_Bytes, idxEDI += sizeOperand_Bytes ) {
						CPU.ESI.set(idxESI);
						CPU.EDI.set(idxEDI);
						// Load String Character ( Operand 1 is part of Accumulator, Operand 2
						//	will be a memory pointer using (E)SI )
						this.operand1.Write(this.operand2.Read());
					}
				}
				CPU.ESI.set(idxESI);
				CPU.EDI.set(idxEDI);
				break;
			default:
				throw new Error( "Execute (LODS): invalid string repeat operation/prefix." );
			}
		// Loop Control with CX Counter
		}, "LOOP": function () {
			/* ==== Malloc ==== */
			var regCount;
			var count;
			/* ==== /Malloc ==== */
			if ( this.sizeAddress_Bytes == 2 ) {
				regCount = CPU.CX;
			} else {
				regCount = CPU.ECX;
			}
			// Decrement counter ( & store result in local var to avoid another expensive Get() )
			regCount.set(count = regCount.get() - 1);
			
			if ( count != 0 ) {
				if ( this.sizeOperand_Bytes == 2 ) {
					// Sign-extend to signed int
					CPU.IP.set(CPU.IP.get() + this.SignExtend(this.operand1.Read()));
				} else {
					// Sign-extend to signed int
					CPU.EIP.set(CPU.EIP.get() + this.SignExtend(this.operand1.Read()));
				}
			}
		// Loop Control with CX Counter
		}, "LOOPE": function () {
			/* ==== Malloc ==== */
			var regCount;
			var count;
			/* ==== /Malloc ==== */
			if ( this.sizeAddress_Bytes == 2 ) {
				regCount = CPU.CX;
			} else {
				regCount = CPU.ECX;
			}
			// Decrement counter ( & store result in local var to avoid another expensive Get() )
			regCount.set(count = regCount.get() - 1);
			
			if ( count != 0 && CPU.ZF.get() ) {
				if ( this.sizeOperand_Bytes == 2 ) {
					// Sign-extend to signed int
					CPU.IP.set(CPU.IP.get() + this.SignExtend(this.operand1.Read()));
				} else {
					// Sign-extend to signed int
					CPU.EIP.set(CPU.EIP.get() + this.SignExtend(this.operand1.Read()));
				}
			}
		// Loop Control with CX Counter
		}, "LOOPNE": function () {
			/* ==== Malloc ==== */
			var regCount;
			var count;
			/* ==== /Malloc ==== */
			if ( this.sizeAddress_Bytes == 2 ) {
				regCount = CPU.CX;
			} else {
				regCount = CPU.ECX;
			}
			// Decrement counter ( & store result in local var to avoid another expensive Get() )
			regCount.set(count = regCount.get() - 1);
			
			if ( count != 0 && !CPU.ZF.get() ) {
				if ( this.sizeOperand_Bytes == 2 ) {
					// Sign-extend to signed int
					CPU.IP.set(CPU.IP.get() + this.SignExtend(this.operand1.Read()));
				} else {
					// Sign-extend to signed int
					CPU.EIP.set(CPU.EIP.get() + this.SignExtend(this.operand1.Read()));
				}
			}
		// Load Segment Limit
		}, "LSL": function () {
			throw new Error( "Execute (LSL): unsupported" );
		// Load Task Register
		}, "LTR": function () {
			throw new Error( "Execute (LTR): unsupported" );
		
		// Move ( Copy ) data
		}, "MOV": function () {
			this.operand1.Write(this.operand2.Read());
		// Move Data from String to String ( Byte, Word or Dword )
		//	TODO: could be polymorphic, one func for each string-repeat type
		//	TODO: there is potential for speed ups here by using native .indexOf() / .slice() and similar
		//		array methods, instead of a possibly slow loop over each individual byte
		}, "MOVS": function () {
			/* ==== Malloc ==== */
			var sizeOperand_Bytes = this.sizeOperand_Bytes;
			var val1;
			var val2;
			var res;
			var idxESI;
			var idxEDI;
			var idxEndESI;
			var len;
			/* ==== /Malloc ==== */
			switch ( this.typeStringRepeat ) {
			// Common case; no repeat prefix
			case "":
				// Load String Character ( Operand 1 is part of Accumulator, Operand 2
				//	will be a memory pointer using (E)SI )
				this.operand1.Write(this.operand2.Read());
				// Direction Flag set, decrement ( scan in reverse direction )
				if ( CPU.DF.get() ) {
					CPU.ESI.set(CPU.ESI.get() - sizeOperand_Bytes);
					CPU.EDI.set(CPU.EDI.get() - sizeOperand_Bytes);
				// Direction Flag clear, increment ( scan in forward direction )
				} else {
					CPU.ESI.set(CPU.ESI.get() + sizeOperand_Bytes);
					CPU.EDI.set(CPU.EDI.get() + sizeOperand_Bytes);
				}
				
				break;
			// Repeat CX times
			case "#REP":
				len = CPU.CX.get();
				idxESI = CPU.ESI.get();
				idxEDI = CPU.EDI.get();
				// Direction Flag set, decrement ( scan in reverse direction )
				if ( CPU.DF.get() ) {
					idxEndESI = idxESI - len * sizeOperand_Bytes;
					for ( ; idxESI >= idxEndESI ; idxESI -= sizeOperand_Bytes, idxEDI -= sizeOperand_Bytes ) {
						CPU.ESI.set(idxESI);
						CPU.EDI.set(idxEDI);
						// Load String Character ( Operand 1 is part of Accumulator, Operand 2
						//	will be a memory pointer using (E)SI )
						this.operand1.Write(this.operand2.Read());
					}
					CPU.ESI.set(idxESI);
					CPU.EDI.set(idxEDI);
				// Direction Flag clear, increment ( scan in forward direction )
				} else {
					idxEndESI = idxESI + len * sizeOperand_Bytes;
					for ( ; idxESI < idxEndESI ; idxESI += sizeOperand_Bytes, idxEDI += sizeOperand_Bytes ) {
						// Load String Character ( Operand 1 is part of Accumulator, Operand 2
						//	will be a memory pointer using (E)SI )
						this.operand1.Write(this.operand2.Read());
						CPU.ESI.set(idxESI);
						CPU.EDI.set(idxEDI);
					}
				}
				CPU.ESI.set(idxESI);
				CPU.EDI.set(idxEDI);
				break;
			// Repeat while Equal, max CX times
			case "#REPE":
				len = CPU.CX.get();
				idxESI = CPU.ESI.get();
				idxEDI = CPU.EDI.get();
				// Direction Flag set, decrement ( scan in reverse direction )
				if ( CPU.DF.get() ) {
					idxEndESI = idxESI - len * sizeOperand_Bytes;
					for ( ; idxESI >= idxEndESI && CPU.ZF.get() ; idxESI -= sizeOperand_Bytes, idxEDI -= sizeOperand_Bytes ) {
						CPU.ESI.set(idxESI);
						CPU.EDI.set(idxEDI);
						// Load String Character ( Operand 1 is part of Accumulator, Operand 2
						//	will be a memory pointer using (E)SI )
						this.operand1.Write(this.operand2.Read());
					}
				// Direction Flag clear, increment ( scan in forward direction )
				} else {
					idxEndESI = idxESI + len * sizeOperand_Bytes;
					for ( ; idxESI < idxEndESI && CPU.ZF.get() ; idxESI += sizeOperand_Bytes, idxEDI += sizeOperand_Bytes ) {
						CPU.ESI.set(idxESI);
						CPU.EDI.set(idxEDI);
						// Load String Character ( Operand 1 is part of Accumulator, Operand 2
						//	will be a memory pointer using (E)SI )
						this.operand1.Write(this.operand2.Read());
					}
				}
				CPU.ESI.set(idxESI);
				CPU.EDI.set(idxEDI);
				break;
			// Repeat while Not Equal, max CX times
			case "#REPNE":
				len = CPU.CX.get();
				idxESI = CPU.ESI.get();
				idxEDI = CPU.EDI.get();
				// Direction Flag set, decrement ( scan in reverse direction )
				if ( CPU.DF.get() ) {
					idxEndESI = idxESI - len * sizeOperand_Bytes;
					for ( ; idxESI >= idxEndESI && !CPU.ZF.get() ; idxESI -= sizeOperand_Bytes, idxEDI -= sizeOperand_Bytes ) {
						CPU.ESI.set(idxESI);
						CPU.EDI.set(idxEDI);
						// Load String Character ( Operand 1 is part of Accumulator, Operand 2
						//	will be a memory pointer using (E)SI )
						this.operand1.Write(this.operand2.Read());
					}
				// Direction Flag clear, increment ( scan in forward direction )
				} else {
					idxEndESI = idxESI + len * sizeOperand_Bytes;
					for ( ; idxESI < idxEndESI && !CPU.ZF.get() ; idxESI += sizeOperand_Bytes, idxEDI += sizeOperand_Bytes ) {
						CPU.ESI.set(idxESI);
						CPU.EDI.set(idxEDI);
						// Load String Character ( Operand 1 is part of Accumulator, Operand 2
						//	will be a memory pointer using (E)SI )
						this.operand1.Write(this.operand2.Read());
					}
				}
				CPU.ESI.set(idxESI);
				CPU.EDI.set(idxEDI);
				break;
			default:
				throw new Error( "Execute (MOVS): invalid string repeat operation/prefix." );
			}
		// Move with Sign Extend
		}, "MOVSX": function () {
			this.operand1.Write(this.SignExtend(this.operand2.Read()));
		// Move with Zero Extend
		}, "MOVZX": function () {
			this.operand1.Write(this.ZeroExtend(this.operand2.Read()));
		// UNsigned Multiply
		}, "MUL": function () {
			/* ==== Malloc ==== */
			var sizeOperand_Bytes = this.sizeOperand_Bytes;
			// NB: Default interpretation is UNsigned
			var multiplicand = this.operand1.Read();
			var multiplier = this.operand2.Read();
			var res;
			/* ==== /Malloc ==== */
			// Integer result - ( integer inputs guarantees integer result, 
			//	no need for truncating )
			res = multiplicand * multiplier;
			// Dividend is AX
			if ( sizeOperand_Bytes == 1 ) {
				// Integer result is written to AX
				CPU.AX.set(res);
			// Dividend is DX:AX
			} else if ( sizeOperand_Bytes == 2 ) {
				// Integer result is written to DX:AX
				CPU.DX.set(res >> 16);
				CPU.AX.set(res & 0x0000FFFF);
			// Dividend is EDX:EAX
			} else if ( sizeOperand_Bytes == 4 ) {
				// Integer result is written to EDX:EAX
				CPU.EDX.set(res >> 32);
				CPU.EAX.set(res & 0x00000000FFFFFFFF);
			}
			
			this.setFlags(multiplicand, multiplier, res);
		// Two's Complement negation
		}, "NEG": function () {
			// Note use of negation operator "-"
			this.operand1.Write(-this.SignExtend(this.operand2.Read()));
		// Do nothing. Occupies both time & space
		}, "NOP": function () {
			// ...
		// One's Complement negation ( Logical NOT )
		}, "NOT": function () {
			// Note use of bitwise inversion operator "~"
			this.operand1.Write(~this.SignExtend(this.operand2.Read()));
		// Logical OR
		}, "OR": function () {
			/* ==== Malloc ==== */
			var val1 = this.operand1.Read();
			var val2 = this.operand2.Read();
			var res = val1 | val2;
			/* ==== /Malloc ==== */
			this.operand1.Write(res);
			
			this.setFlags(val1, val2, res);
		// Output to Port
		}, "OUT": function () {
			var addr_port = this.operand1.Read();
			var val = this.operand2.Read();
			var lenIO = this.sizeOperand_Bytes;
			// All ports are initialised with null handlers,
			//	so there will always be a valid port object available
			var port = machine.hsh_portIOWrite[ addr_port ];
			
			if ( port.mask & lenIO ) {
				port.fn(port.device, addr_port, val, lenIO);
			// Don't flood the logs when probing PCI (from Bochs)
			} else if ( addr_port !== 0x0CF8 ) {
				jemul8.Error("Execute (OUT) :: Write to port " + jemul8.HexFormat(addr_port) + " with length " + lenIO + " ignored");
			}
		// Output String to Port
		}, "OUTS": function () {
			throw new Error( "Execute (OUTS) :: Not implemented yet" );
		// Pop word off stack top ( SS:SP )
		}, "POP": function () {
			this.operand1.Write(CPU.PopStack());
		// Pop all General Registers
		}, "POPA": function () {
			// POPA
			if ( this.sizeOperand_Bytes = 16 ) {
				CPU.DI.set(CPU.PopStack());
				CPU.SI.set(CPU.PopStack());
				CPU.BP.set(CPU.PopStack());
				CPU.PopStack();		// Skip SP
				CPU.BX.set(CPU.PopStack());
				CPU.DX.set(CPU.PopStack());
				CPU.CX.set(CPU.PopStack());
				CPU.AX.set(CPU.PopStack());
			// POPAD
			} else {
				CPU.EDI.set(CPU.PopStack(4));
				CPU.ESI.set(CPU.PopStack(4));
				CPU.EBP.set(CPU.PopStack(4));
				CPU.PopStack();		// Skip ESP
				CPU.EBX.set(CPU.PopStack(4));
				CPU.EDX.set(CPU.PopStack(4));
				CPU.ECX.set(CPU.PopStack(4));
				CPU.EAX.set(CPU.PopStack(4));
			}
		// Pop Stack into FLAGS / EFLAGS Register
		}, "POPF": function () {
			// NB: bits 16 and 17 ( VM & RF ) should not be affected by this
			
			// POPF
			if ( this.sizeOperand_Bytes = 16 ) {
				CPU.FLAGS.set(CPU.PopStack());
			// POPFD
			} else {
				CPU.EFLAGS.set(CPU.PopStack(4));
			}
		// Push data onto stack top ( SS:SP )
		}, "PUSH": function () {
			CPU.PushStack(this.operand1.Read(), this.sizeOperand_Bytes);
		// Push all General Registers
		}, "PUSHA": function () {
			/* ==== Malloc ==== */
			var ptrStack;
			/* ==== /Malloc ==== */
			// PUSHA
			if ( this.sizeOperand_Bytes = 16 ) {
				// Remember to save Stack Pointer, push()es will modify it
				ptrStack = CPU.SP.get();
				CPU.PushStack(CPU.AX.get(), 2);
				CPU.PushStack(CPU.CX.get(), 2);
				CPU.PushStack(CPU.DX.get(), 2);
				CPU.PushStack(CPU.BX.get(), 2);
				CPU.PushStack(ptrStack, 2);
				CPU.PushStack(CPU.BP.get(), 2);
				CPU.PushStack(CPU.SI.get(), 2);
				CPU.PushStack(CPU.DI.get(), 2);
			// PUSHAD
			} else {
				// Remember to save Stack Pointer, push()es will modify it
				ptrStack = CPU.ESP.get();
				CPU.PushStack(CPU.EAX.get(), 4);
				CPU.PushStack(CPU.ECX.get(), 4);
				CPU.PushStack(CPU.EDX.get(), 4);
				CPU.PushStack(CPU.EBX.get(), 4);
				CPU.PushStack(ptrStack, 4);
				CPU.PushStack(CPU.EBP.get(), 4);
				CPU.PushStack(CPU.ESI.get(), 4);
				CPU.PushStack(CPU.EDI.get(), 4);
			}
		// Push Flags Register onto Stack
		}, "PUSHF": function () {
			// PUSHF
			if ( this.sizeOperand_Bytes = 16 ) {
				CPU.PushStack(CPU.FLAGS.get(), 2);
			// PUSHFD
			} else {
				CPU.PushStack(CPU.EFLAGS.get(), 4);
			}
		// Rotate Bits Left
		}, "ROL": function () {
			// Fast left-rotation using masks instead of a loop
			/* ==== Malloc ==== */
			var bits = this.operand1.Read();
			var numBitsIn = this.sizeOperand_Bytes * 8;
			// Modulo, because shifting by bit-length of operand ( eg. 16/32 ) is same as shifting by zero
			var numBitsShift = this.operand2.Read() % numBitsIn;
			var numBitsRemaining = numBitsIn - numBitsShift;
			var bitsRemaining = (bits & ((1 << numBitsRemaining) - 1)) << numBitsShift;
			var bitsShiftedOut = bits >> numBitsRemaining;
			/* ==== /Malloc ==== */
			this.operand1.Write(bitsRemaining | bitsShiftedOut);
			// Carry Flag is set to LSB of bits shifted out ( if this had been a loop,
			//	the last bit shifted off the left and onto the right would be this one )
			CPU.CF.setBin(bitsShiftedOut & 0x01);
		// Rotate Bits Right
		}, "ROR": function () {
			// Fast right-rotation using masks instead of a loop
			/* ==== Malloc ==== */
			var bits = this.operand1.Read();
			var numBitsIn = this.sizeOperand_Bytes * 8;
			// Modulo, because shifting by bit-length of operand ( eg. 16/32 ) is same as shifting by zero
			//	( NB: was changed to & as 011111b is 31, bitwise-AND should be faster/cheaper than modulo ( in Chrome ),
			//		however after testing modulo % is actually faster ( in TM ) )
			var numBitsShift = this.operand2.Read() % numBitsIn;
			var numBitsRemaining = numBitsIn - numBitsShift;
			var bitsRemaining = bits >> numBitsShift;
			var bitsShiftedOut = (bits & ((1 << numBitsShift) - 1)) << numBitsRemaining;
			/* ==== /Malloc ==== */
			this.operand1.Write(bitsRemaining | bitsShiftedOut);
			// Carry Flag is set to MSB of bits shifted out ( if this had been a loop,
			//	the last bit shifted off the right and onto the left would be this one )
			CPU.CF.setBin(bitsShiftedOut & (1 << numBitsShift));
		// Rotate Bits Left with Carry Flag
		}, "RCL": function () {
			throw new Error( "Execute (RCL): unsupported" );
		// Rotate Bits Right with Carry Flag
		}, "RCR": function () {
			throw new Error( "Execute (RCR): unsupported" );
		// Return ( Near ) from Procedure
		}, "RETN": function () {
			if ( this.sizeOperand_Bytes == 2 ) {
				// ( NB: Will clear high word of EIP )
				CPU.EIP.set(CPU.PopStack(2));
			} else {
				CPU.EIP.set(CPU.PopStack(4));
			}
		// Return ( Far ) from Procedure
		}, "RETF": function () {
			/* ==== Malloc ==== */
			var sizeOperand_Bytes = this.sizeOperand_Bytes;
			var PE = CPU.PE.get();
			var VM = CPU.VM.get();
			/* ==== /Malloc ==== */
			// Real or Virtual-8086 mode ( PE is the Protection Enable bit in CR0, VM is the EFLAGS's Virtual-8086 enable flag )
			if ( !PE || (PE && VM) ) {
				// 16-bit
				if ( sizeOperand_Bytes == 2 ) {
					// Pop only IP ( save another get by just masking out high word )
					//	( NB: Will clear high word of EIP )
					CPU.EIP.set(CPU.PopStack());
					// Pop CS
					CPU.CS.set(CPU.PopStack());
				// 32-bit
				} else {
					// Pop only IP ( save another get by just masking out high word )
					//	( NB: Will clear high word of EIP )
					CPU.EIP.set(CPU.PopStack(4));
					// Pop CS ( 32-bit pop, high-order 16 bits discarded )
					CPU.CS.set(CPU.PopStack(4));
				}
			}
		// Return ( Near ) from Procedure and pop imm16 bytes of parameters
		}, "RETN_P": function () {
			if ( this.sizeOperand_Bytes == 2 ) {
				// Will clear high word of EIP
				CPU.EIP.set(CPU.PopStack(2));
			} else {
				CPU.EIP.set(CPU.PopStack(4));
			}
			// Pop imm16 bytes of parameters
			CPU.ESP.set(CPU.ESP.get() + this.operand1.Read());
		// Return ( Far ) from Procedure and pop imm16 bytes of parameters
		}, "RETF_P": function () {
			/* ==== Malloc ==== */
			var sizeOperand_Bytes = this.sizeOperand_Bytes;
			var PE = CPU.PE.get();
			var VM = CPU.VM.get();
			/* ==== /Malloc ==== */
			// Real or Virtual-8086 mode ( PE is the Protection Enable bit in CR0, VM is the EFLAGS's Virtual-8086 enable flag )
			if ( !PE || (PE && VM) ) {
				// 16-bit
				if ( sizeOperand_Bytes == 2 ) {
					// Pop only IP ( save another get by just masking out high word )
					//	( NB: Will clear high word of EIP )
					CPU.EIP.set(CPU.PopStack());
					// Pop CS
					CPU.CS.set(CPU.PopStack());
				// 32-bit
				} else {
					// Pop only IP ( save another get by just masking out high word )
					//	( NB: Will clear high word of EIP )
					CPU.EIP.set(CPU.PopStack(4));
					// Pop CS ( 32-bit pop, high-order 16 bits discarded )
					CPU.CS.set(CPU.PopStack(4));
				}
			}
			// Pop imm16 bytes of parameters
			CPU.ESP.set(CPU.ESP.get() + this.operand1.Read());
		// Store AH into Flags
		}, "SAHF": function () {
			// Mask out current values of Flags and replace with contents of AH
			CPU.FLAGS.set((CPU.FLAGS.get() & 0xFF00) | CPU.AH.get());
		// Shift Left / Shift Arithmetic Left
		}, "SHL": function () {
			/* ==== Malloc ==== */
			var bits = this.operand1.Read();
			var numBitsIn = this.sizeOperand_Bytes * 8;
			// Modulo, because shifting by bit-length of operand ( eg. 16/32 ) is same as shifting by zero
			var numBitsToShift = this.operand2.Read() % numBitsIn;
			var bitHigh;
			/* ==== /Malloc ==== */
			
			this.operand1.Write(bits << numBitsToShift);
			bitHigh = bits & (1 << (numBitsIn - 1));
			// High order-bit written to Carry Flag
			CPU.CF.setBin(bitHigh);
			// Overflow Flag defined only if single-shift
			if ( numBitsToShift == 1 ) {
				// OF set if high bit of answer is same as result of Carry Flag
				CPU.OF.setBin(bitHigh != (bits & (1 << (numBitsIn - 2))) ? 1 : 0);
			}
		// Shift Right ( with UNsigned divide )
		}, "SHR": function () {
			/* ==== Malloc ==== */
			var bits = this.operand1.Read();
			var numBitsIn = this.sizeOperand_Bytes * 8;
			// Modulo, because shifting by bit-length of operand ( eg. 16/32 ) is same as shifting by zero
			var numBitsToShift = this.operand2.Read() % numBitsIn;
			/* ==== /Malloc ==== */
			// Use JS operator for right-shift with zero extend ( shift on zeroes instead of sign bits )
			this.operand1.Write(bits >> numBitsToShift);
			// Low order-bit written to Carry Flag
			CPU.CF.setBin(bits & 0x01);
			// Overflow Flag defined only if single-shift
			if ( numBitsToShift == 1 ) {
				// OF set to high-order bit of original operand
				CPU.OF.setBin(bits & (1 << (numBitsIn - 1)));
			}
		// Shift Arithmetic Right ( with signed divide )
		}, "SAR": function () {
			/* ==== Malloc ==== */
			var bits = this.SignExtend(this.operand1.Read());
			var numBitsIn = this.sizeOperand_Bytes * 8;
			// Modulo, because shifting by bit-length of operand ( eg. 16/32 ) is same as shifting by zero
			var numBitsToShift = this.operand2.Read() % numBitsIn;
			/* ==== /Malloc ==== */
			// Use JS operator for right-shift with sign extend ( shift on sign bits instead of zeroes )
			this.operand1.Write(bits >>> numBitsToShift);
			// Low order-bit written to Carry Flag
			CPU.CF.setBin(bits & 0x01);
			// Overflow Flag defined only if single-shift
			if ( numBitsToShift == 1 ) {
				// OF always zero/cleared
				CPU.OF.clear();
			}
		// Integer Subtraction with Borrow
		}, "SBB": function () {
			// NB: Addition and subtraction handle two's complement the same way
			//	for both unsigned and signed interpretations of numbers
			/* ==== Malloc ==== */
			var val1 = this.operand1.Read();
			var val2 = this.operand2.Read();
			var res = val1 - (this.SignExtend(val2) + CPU.CF.get());
			/* ==== /Malloc ==== */
			this.operand1.Write(res);
			
			this.setFlags(val1, val2, res);
		// Integer Subtraction
		}, "SUB": function () {
			// NB: Addition and subtraction handle two's complement the same way
			//	for both unsigned and signed interpretations of numbers
			/* ==== Malloc ==== */
			var val1 = this.operand1.Read();
			var val2 = this.operand2.Read();
			var res = val1 - val2;
			/* ==== /Malloc ==== */
			this.operand1.Write(res);
			
			this.setFlags(val1, val2, res);
		// Scan/Compare String Data ( Byte, Word or Dword )
		//	TODO: could be polymorphic, one func for each string-repeat type
		//	TODO: there is potential for speed ups here by using native .indexOf() / .slice() and similar
		//		array methods, instead of a possibly slow loop over each individual byte
		}, "SCAS": function () {
			/* ==== Malloc ==== */
			var sizeOperand_Bytes = this.sizeOperand_Bytes;
			var val1;
			var val2;
			var res;
			var idxEDI;
			var idxEndEDI;
			var len;
			/* ==== /Malloc ==== */
			switch ( this.typeStringRepeat ) {
			// Common case; no repeat prefix
			case "":
				/* ==== Malloc ==== */
				val1 = this.operand1.Read();
				val2 = this.operand2.Read();
				res = val1 - val2;
				/* ==== /Malloc ==== */
				// Direction Flag set, decrement ( scan in reverse direction )
				if ( CPU.DF.get() ) {
					CPU.EDI.set(CPU.EDI.get() - 1);
				// Direction Flag clear, increment ( scan in forward direction )
				} else {
					CPU.EDI.set(CPU.EDI.get() + 1);
				}
				// Do not store result of subtraction; only flags
				this.setFlags(val1, val2, res);
				break;
			// Repeat CX times
			case "#REP":
				len = CPU.CX.get();
				idxEDI = CPU.EDI.get();
				// Direction Flag set, decrement ( scan in reverse direction )
				if ( CPU.DF.get() ) {
					idxEndEDI = idxEDI - len * sizeOperand_Bytes;
					for ( ; idxEDI >= idxEndEDI ; idxEDI -= sizeOperand_Bytes ) {
						CPU.EDI.set(idxEDI);
						val1 = this.operand1.Read();
						val2 = this.operand2.Read();
						res = val1 - val2;
						// Do not store result of subtraction; only flags
						this.setFlags(val1, val2, res);
					}
				// Direction Flag clear, increment ( scan in forward direction )
				} else {
					idxEndEDI = idxEDI + len * sizeOperand_Bytes;
					for ( ; idxEDI < idxEndEDI ; idxEDI += sizeOperand_Bytes ) {
						CPU.EDI.set(idxEDI);
						val1 = this.operand1.Read();
						val2 = this.operand2.Read();
						res = val1 - val2;
						// Do not store result of subtraction; only flags
						this.setFlags(val1, val2, res);
					}
				}
				CPU.EDI.set(idxEDI);
				break;
			// Repeat while Equal, max CX times
			case "#REPE":
				len = CPU.CX.get();
				idxEDI = CPU.EDI.get();
				// Direction Flag set, decrement ( scan in reverse direction )
				if ( CPU.DF.get() ) {
					idxEndEDI = idxEDI - len * sizeOperand_Bytes;
					for ( ; idxEDI >= idxEndEDI && CPU.ZF.get() ; idxEDI -= sizeOperand_Bytes ) {
						CPU.EDI.set(idxEDI);
						val1 = this.operand1.Read();
						val2 = this.operand2.Read();
						res = val1 - val2;
						// Do not store result of subtraction; only flags
						this.setFlags(val1, val2, res);
					}
				// Direction Flag clear, increment ( scan in forward direction )
				} else {
					idxEndEDI = idxEDI + len * sizeOperand_Bytes;
					for ( ; idxEDI < idxEndEDI && CPU.ZF.get() ; idxEDI += sizeOperand_Bytes ) {
						CPU.EDI.set(idxEDI);
						val1 = this.operand1.Read();
						val2 = this.operand2.Read();
						res = val1 - val2;
						// Do not store result of subtraction; only flags
						this.setFlags(val1, val2, res);
					}
				}
				CPU.EDI.set(idxEDI);
				break;
			// Repeat while Not Equal, max CX times
			case "#REPNE":
				len = CPU.CX.get();
				idxEDI = CPU.EDI.get();
				// Direction Flag set, decrement ( scan in reverse direction )
				if ( CPU.DF.get() ) {
					idxEndEDI = idxEDI - len * sizeOperand_Bytes;
					for ( ; idxEDI >= idxEndEDI && !CPU.ZF.get() ; idxEDI -= sizeOperand_Bytes ) {
						CPU.EDI.set(idxEDI);
						val1 = this.operand1.Read();
						val2 = this.operand2.Read();
						res = val1 - val2;
						// Do not store result of subtraction; only flags
						this.setFlags(val1, val2, res);
					}
				// Direction Flag clear, increment ( scan in forward direction )
				} else {
					idxEndEDI = idxEDI + len * sizeOperand_Bytes;
					for ( ; idxEDI < idxEndEDI && !CPU.ZF.get() ; idxEDI += sizeOperand_Bytes ) {
						CPU.EDI.set(idxEDI);
						val1 = this.operand1.Read();
						val2 = this.operand2.Read();
						res = val1 - val2;
						// Do not store result of subtraction; only flags
						this.setFlags(val1, val2, res);
					}
				}
				CPU.EDI.set(idxEDI);
				break;
			default:
				throw new Error( "Execute (SCAS): invalid string repeat operation/prefix." );
			}
		/* ======= Conditional Byte Set Instructions ======= */
		/*
		 *	Many of these conditions may be interpreted in one of
		 *	several ways; the mnemonics used here are the first
		 *	in the list provided in the Intel Instruction Formats & Encodings,
		 *	Table B-8.
		 */
		// Set Byte if Overflow
		}, "SETO": function () {
			// Condition met
			if ( CPU.OF.get() ) {
				this.operand1.Write(1);
			} else {
				this.operand1.Write(0);
			}
		// Set Byte if NO Overflow
		}, "SETNO": function () {
			// Condition met
			if ( !CPU.OF.get() ) {
				this.operand1.Write(1);
			} else {
				this.operand1.Write(0);
			}
		// Set Byte if Below
		}, "SETB": function () {
			// Condition met
			if ( CPU.CF.get() ) {
				this.operand1.Write(1);
			} else {
				this.operand1.Write(0);
			}
		// Set Byte if NOT Below
		}, "SETNB": function () {
			// Condition met
			if ( !CPU.CF.get() ) {
				this.operand1.Write(1);
			} else {
				this.operand1.Write(0);
			}
		// Set Byte if Equal
		}, "SETE": function () {
			// Condition met
			if ( CPU.ZF.get() ) {
				this.operand1.Write(1);
			} else {
				this.operand1.Write(0);
			}
		// Set Byte if NOT Equal
		}, "SETNE": function () {
			// Condition met
			if ( !CPU.ZF.get() ) {
				this.operand1.Write(1);
			} else {
				this.operand1.Write(0);
			}
		// Set Byte if Below or Equal
		}, "SETBE": function () {
			// Condition met
			if ( CPU.CF.get() || CPU.ZF.get() ) {
				this.operand1.Write(1);
			} else {
				this.operand1.Write(0);
			}
		// Set Byte if NOT Below or Equal
		}, "SETNBE": function () {
			// Condition met
			if ( !CPU.CF.get() && !CPU.ZF.get() ) {
				this.operand1.Write(1);
			} else {
				this.operand1.Write(0);
			}
		// Set Byte if Sign
		}, "SETS": function () {
			// Condition met
			if ( CPU.SF.get() ) {
				this.operand1.Write(1);
			} else {
				this.operand1.Write(0);
			}
		// Set Byte if NOT Sign
		}, "SETNS": function () {
			// Condition met
			if ( !CPU.SF.get() ) {
				this.operand1.Write(1);
			} else {
				this.operand1.Write(0);
			}
		// Set Byte if Parity / Parity Even
		}, "SETP": function () {
			// Condition met
			if ( CPU.PF.get() ) {
				this.operand1.Write(1);
			} else {
				this.operand1.Write(0);
			}
		// Set Byte if NOT Parity / Parity Even
		}, "SETNP": function () {
			// Condition met
			if ( !CPU.PF.get() ) {
				this.operand1.Write(1);
			} else {
				this.operand1.Write(0);
			}
		// Set Byte if Less Than
		}, "SETL": function () {
			// Condition met
			if ( CPU.SF.get() !== CPU.OF.get() ) {
				this.operand1.Write(1);
			} else {
				this.operand1.Write(0);
			}
		// Set Byte if NOT Less Than
		}, "SETNL": function () {
			// Condition met
			if ( CPU.SF.get() === CPU.OF.get() ) {
				this.operand1.Write(1);
			} else {
				this.operand1.Write(0);
			}
		// Set Byte if Less Than or Equal
		}, "SETLE": function () {
			// Condition met
			if ( CPU.ZF.get() && (CPU.SF.get() !== CPU.OF.get()) ) {
				this.operand1.Write(1);
			} else {
				this.operand1.Write(0);
			}
		// Set Byte if NOT Less Than or Equal
		}, "SETNLE": function () {
			// Condition met
			if ( !CPU.ZF.get() && (CPU.SF.get() === CPU.OF.get()) ) {
				this.operand1.Write(1);
			} else {
				this.operand1.Write(0);
			}
		/* ======= /Conditional Byte Set Instructions ======= */
		// Store Global Descriptor Table Register
		}, "SGDT": function () {
			throw new Error( "Execute (SGDT): unsupported" );
		// Store Interrupt Descriptor Table Register
		}, "SIDT": function () {
			throw new Error( "Execute (SIDT): unsupported" );
		// Shift Left - Double Precision
		}, "SHLD": function () {
			throw new Error( "Execute (SHLD): unsupported" );
		// Shift Right - Double Precision
		}, "SHRD": function () {
			throw new Error( "Execute (SHRD): unsupported" );
		// Store Local Descriptor Table Register
		}, "SLDT": function () {
			throw new Error( "Execute (SLDT): unsupported" );
		// Store Machine Status Word
		}, "SMSW": function () {
			this.operand1.Write(CPU.MSW.get());
		// Set Carry flag
		}, "STC": function () {
			CPU.CF.set();
		// Set Direction flag
		}, "STD": function () {
			CPU.DF.set();
		// Set Interrupt flag - enables recognition of all hardware interrupts.
		}, "STI": function () {
			CPU.IF.set();
		// Store String Data ( Byte, Word or Dword )
		//	TODO: could be polymorphic, one func for each string-repeat type
		//	TODO: there is potential for speed ups here by using native .indexOf() / .slice() and similar
		//		array methods, instead of a possibly slow loop over each individual byte
		}, "STOS": function () {
			/* ==== Malloc ==== */
			var sizeOperand_Bytes = this.sizeOperand_Bytes;
			var val1;
			var val2;
			var res;
			var idxEDI;
			var idxEndEDI;
			var len;
			/* ==== /Malloc ==== */
			switch ( this.typeStringRepeat ) {
			// Common case; no repeat prefix
			case "":
				/* ==== Malloc ==== */
				val1 = this.operand1.Read();
				val2 = this.operand2.Read();
				res = val1 - val2;
				/* ==== /Malloc ==== */
				// Direction Flag set, decrement ( scan in reverse direction )
				if ( CPU.DF.get() ) {
					CPU.EDI.set(CPU.EDI.get() - 1);
				// Direction Flag clear, increment ( scan in forward direction )
				} else {
					CPU.EDI.set(CPU.EDI.get() + 1);
				}
				// Do not store result of subtraction; only flags
				this.setFlags(val1, val2, res);
				break;
			// Repeat CX times
			case "#REP":
				len = CPU.CX.get();
				idxEDI = CPU.EDI.get();
				// Direction Flag set, decrement ( scan in reverse direction )
				if ( CPU.DF.get() ) {
					idxEndEDI = idxEDI - len * sizeOperand_Bytes;
					for ( ; idxEDI >= idxEndEDI ; idxEDI -= sizeOperand_Bytes ) {
						CPU.EDI.set(idxEDI);
						val1 = this.operand1.Read();
						val2 = this.operand2.Read();
						res = val1 - val2;
						// Do not store result of subtraction; only flags
						this.setFlags(val1, val2, res);
					}
				// Direction Flag clear, increment ( scan in forward direction )
				} else {
					idxEndEDI = idxEDI + len * sizeOperand_Bytes;
					for ( ; idxEDI < idxEndEDI ; idxEDI += sizeOperand_Bytes ) {
						CPU.EDI.set(idxEDI);
						val1 = this.operand1.Read();
						val2 = this.operand2.Read();
						res = val1 - val2;
						// Do not store result of subtraction; only flags
						this.setFlags(val1, val2, res);
					}
				}
				CPU.EDI.set(idxEDI);
				break;
			// Repeat while Equal, max CX times
			case "#REPE":
				len = CPU.CX.get();
				idxEDI = CPU.EDI.get();
				// Direction Flag set, decrement ( scan in reverse direction )
				if ( CPU.DF.get() ) {
					idxEndEDI = idxEDI - len * sizeOperand_Bytes;
					for ( ; idxEDI >= idxEndEDI && CPU.ZF.get() ; idxEDI -= sizeOperand_Bytes ) {
						CPU.EDI.set(idxEDI);
						val1 = this.operand1.Read();
						val2 = this.operand2.Read();
						res = val1 - val2;
						// Do not store result of subtraction; only flags
						this.setFlags(val1, val2, res);
					}
				// Direction Flag clear, increment ( scan in forward direction )
				} else {
					idxEndEDI = idxEDI + len * sizeOperand_Bytes;
					for ( ; idxEDI < idxEndEDI && CPU.ZF.get() ; idxEDI += sizeOperand_Bytes ) {
						CPU.EDI.set(idxEDI);
						val1 = this.operand1.Read();
						val2 = this.operand2.Read();
						res = val1 - val2;
						// Do not store result of subtraction; only flags
						this.setFlags(val1, val2, res);
					}
				}
				CPU.EDI.set(idxEDI);
				break;
			// Repeat while Not Equal, max CX times
			case "#REPNE":
				len = CPU.CX.get();
				idxEDI = CPU.EDI.get();
				// Direction Flag set, decrement ( scan in reverse direction )
				if ( CPU.DF.get() ) {
					idxEndEDI = idxEDI - len * sizeOperand_Bytes;
					for ( ; idxEDI >= idxEndEDI && !CPU.ZF.get() ; idxEDI -= sizeOperand_Bytes ) {
						CPU.EDI.set(idxEDI);
						val1 = this.operand1.Read();
						val2 = this.operand2.Read();
						res = val1 - val2;
						// Do not store result of subtraction; only flags
						this.setFlags(val1, val2, res);
					}
				// Direction Flag clear, increment ( scan in forward direction )
				} else {
					idxEndEDI = idxEDI + len * sizeOperand_Bytes;
					for ( ; idxEDI < idxEndEDI && !CPU.ZF.get() ; idxEDI += sizeOperand_Bytes ) {
						CPU.EDI.set(idxEDI);
						val1 = this.operand1.Read();
						val2 = this.operand2.Read();
						res = val1 - val2;
						// Do not store result of subtraction; only flags
						this.setFlags(val1, val2, res);
					}
				}
				CPU.EDI.set(idxEDI);
				break;
			default:
				throw new Error( "Execute (SCAS): invalid string repeat operation/prefix." );
			}
		// Store Task Register
		}, "STR": function () {
			throw new Error( "Execute (STR): unsupported" );
		// Integer Subtraction
		}, "SBB": function () {
			// NB: Addition and subtraction handle two's complement the same way
			//	for both unsigned and signed interpretations of numbers
			/* ==== Malloc ==== */
			var val1 = this.operand1.Read();
			var val2 = this.operand2.Read();
			var res = val1 - this.SignExtend(val2);
			/* ==== /Malloc ==== */
			this.operand1.Write(res);
			
			this.setFlags(val1, val2, res);
		// Logical Compare
		}, "TEST": function () {
			/* ==== Malloc ==== */
			var val1 = this.operand1.Read();
			var val2 = this.operand2.Read();
			var res = val1 & val2;
			/* ==== /Malloc ==== */
			// Do not store result of subtraction; only flags
			this.setFlags(val1, val2, res);
		// Verify a Segment for Reading
		}, "VERR": function () {
			throw new Error( "Execute (VERR): unsupported" );
		// Verify a Segment for Writing
		}, "VERW": function () {
			throw new Error( "Execute (VERW): unsupported" );
		// Wait until BUSY# Pin is Inactive ( HIGH )
		}, "WAIT": function () {
			// Suspend execution of 80386 Instructions until BUSY# is inactive;
			//	driven by numeric processor extension 80287
			
			// We do not use a math coprocessor, so this can safely be ignored for now.
		// Exchange Register/Memory with Register
		}, "XCHG": function () {
			// If a memory operand is involved, BUS LOCK is asserted during exchange,
			//	regardless of LOCK# prefix or IOPL value ( so always atomic ).
			/* ==== Malloc ==== */
			var valTemp = this.operand1.Read();
			/* ==== /Malloc ==== */
			this.operand1.Write(this.operand2.Read());
			this.operand2.Write(valTemp);
		// Table Look-up Translation
		}, "XLAT": function () {
			if ( this.sizeAddress_Bytes == 2 ) {
				CPU.AL.set(CPU.BX.get() + this.ZeroExtend(this.AL.get()));
			} else {
				CPU.AL.set(CPU.EBX.get() + this.ZeroExtend(this.AL.get()));
			}
		// Logical Exclusive OR
		}, "XOR": function () {
			/* ==== Malloc ==== */
			var val1 = this.operand1.Read();
			var val2 = this.operand2.Read();
			var res = val1 ^ val2;
			/* ==== /Malloc ==== */
			this.operand1.Write(res);
			
			this.setFlags(val1, val2, res);
		}
	};
	
	// Whether the specified InstructionPointer is within the bounds of the current Code Segment
	Instruction.prototype.InCodeSegmentLimits = function ( EIP ) {
		// TODO...
		return true;
	};
	// Return Stack space available ( in bytes )
	Instruction.prototype.getStackSpace = function () {
		// This will do for now...
		return 16;
	};
	
	// For reinterpreting a number as signed / "sign-extending" a number
	Instruction.prototype.SignExtend = function ( int_unsigned ) {
		/* ==== Malloc ==== */
		var numBits = this.sizeOperand_Bytes * 8;
		/* ==== /Malloc ==== */
		// Sign bit set
		if ( int_unsigned >> (numBits - 1) ) {
			return int_unsigned - (1 << numBits);
		} else {
			return int_unsigned;
		}
	};
	// For "zero-extending" a number
	Instruction.prototype.ZeroExtend = function ( int_unsigned ) {
		// Cut/mask-off higher bits ( will be filled with zeroes )
		return int_unsigned & ((1 << this.sizeOperand_Bytes * 8) - 1);
	};
	// Set flags after math operations based on result
	//	TODO: produce 2 more versions of this function, for only 1 or even 0 operands
	//	( eg. this.setFlags( val1, res ) and this.setFlags( res ) )
	//	... at the minute, zeroes are passed for the unnecessary params described above.
	Instruction.prototype.setFlagsDIS = function ( val1, val2, res ) {
		/* ==== Malloc ==== */
		var res_val1_xor_val2 = (val1 ^ val2);
		var res_val1_xor_res = (val1 ^ res);
		var bitmask = (1 << (this.sizeOperand_Bytes * 8)) - 1;
		/* ==== /Malloc ==== */
		
		// Whether operation went beyond UNsigned capacity of dest -
		//	based on sign changes between inputs and result
		// NB: these are derived from Bochs algorithm description here: http://bochs.sourceforge.net/VirtNoJit.pdf
		CPU.CF.setBin((res ^ (~res_val1_xor_val2 & res_val1_xor_res)) < 0 ? 1 : 0);
		// Simple lookup for parity of low 8 bits
		CPU.PF.setBin(mapParity[res & 0xFF]);
		// AF is carry-out of 4th LSB
		CPU.AF.setBin((res_val1_xor_val2 ^ res) & 0x10);
		CPU.ZF.setBin(res == 0 ? 1 : 0);
		// Sign flag set if negative ( use two's complement signed-bit check,
		//	cannot test if < 0 because value may not have been sign-extended )
		CPU.SF.setBin(res >> (this.sizeOperand_Bytes * 8 - 1) ? 1 : 0);
		// Whether operation went beyond signed capacity of dest -
		//	based on sign changes between inputs and result
		CPU.OF.setBin((res_val1_xor_val2 & res_val1_xor_res) < 0 ? 1 : 0);
	};
	
	/* ====== Private ====== */
	// To throw a CPU exception / fault ( eg. General Protection )
	function CPUException( type, code ) {
		jemul8.Debug("CPU exception: " + type + ", " + code);
	}
	
	/* ============ State storage for Lazy Flags eval later ============ */
	/* 	To be called after executing any Instruction which modifies
	 *	one or more flags. The different versions of the function
	 *	below are intended to save valuable time not storing data when
	 *	it is not needed; clearing the unused values is not needed either,
	 *	as the lazy evaluator will just ignore them.
	 */
	
	// Operand 1, 2 and result
	Instruction.prototype.setFlags = function ( val1, val2, res ) {
		CPU.valLast1 = val1;
		CPU.valLast2 = val2;
		CPU.resLast = res;
		CPU.size_insnLast_Bytes = this.sizeOperand_Bytes;
		CPU.name_insnLast = this.name;
		CPU.EFLAGS.bitsDirty = 0xFFFFFFFF;
	};
	// Operand 1 and result only
	Instruction.prototype.setFlags_Op1 = function ( val1, res ) {
		CPU.valLast1 = val1;
		CPU.resLast = res;
		CPU.size_insnLast_Bytes = this.sizeOperand_Bytes;
		CPU.name_insnLast = this.name;
		CPU.EFLAGS.bitsDirty = 0xFFFFFFFF;
	};
	// Operand 2 and result only
	Instruction.prototype.setFlags_Op2 = function ( val2, res ) {
		CPU.valLast2 = val2;
		CPU.resLast = res;
		CPU.size_insnLast_Bytes = this.sizeOperand_Bytes;
		CPU.name_insnLast = this.name;
		CPU.EFLAGS.bitsDirty = 0xFFFFFFFF;
	};
	// Result only
	Instruction.prototype.setFlags_Result = function ( res ) {
		CPU.resLast = res;
		CPU.size_insnLast_Bytes = this.sizeOperand_Bytes;
		CPU.name_insnLast = this.name;
		CPU.EFLAGS.bitsDirty = 0xFFFFFFFF;
	};
	
	// Bitwise OR the EFLAGS dirty mask with one of these to indicate
	//	that flag may have been modified
	var bit_ormask_CF = 1;
	var bit_ormask_PF = 2;
	var bit_ormask_AF = 4;
	var bit_ormask_ZF = 8;
	var bit_ormask_SF = 16;
	var bit_ormask_OF = 32;
	/* ============ /State storage for Lazy Flags eval later ============ */
	
	/* ====== /Private ====== */
	
	/* ==== Exports ==== */
	jemul8.Instruction = Instruction;
	/* ==== /Exports ==== */
});

// Add Module to emulator
jemul8.AddModule(mod);