/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *	
 *	MODULE: cpu Instruction class support
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("cpu/instruction", function ( $ ) { "use strict";
	var jemul8 = this.data("jemul8");
	
	// cpu Instruction ( eg. MOV, CMP ) class constructor
	function Instruction( machine, offset, name
						, reg_segment, addressSizeAttr, operandSizeAttr ) {
		/* ==== Guards ==== */
		//jemul8.assert(this && (this instanceof Instruction), "Instruction ctor ::"
		//	+ " error - constructor not called properly");
		/* ==== /Guards ==== */
		
		this.machine = machine;
		
		// Mnemonic / name of Instruction
		this.name = name;
		// Absolute offset address of Instruction 
		this.offset = offset;
		this.operand1 = null;
		this.operand2 = null;
		this.operand3 = null;
		// Length of Instruction in bytes
		this.lenBytes = null;
		
		// Repeat prefix for String Instructions (eg. MOVS, LODS, CMPS, SCAS)
		this.repeat = "";
		
		this.reg_segment = reg_segment;
		// Address-size attribute
		this.addressSizeAttr = addressSizeAttr;
		// Operand-size attribute
		this.operandSizeAttr = operandSizeAttr;
		
		// POLYMORPHIC: Load appropriate Execute function for Instruction
		this.execute = machine.cpu.hsh_fn_insnExecute[ name ];
	}
	// Generate a human-readable assembly instruction
	//	(useful for debugging etc.)
	Instruction.prototype.getASMText = function () {
		var textASM = (this.repeat ? this.repeat + " " : "") + this.name;
		
		if ( this.operand1 ) {
			textASM += " " + this.operand1.getASMText();
		}
		if ( this.operand2 ) {
			textASM += ", " + this.operand2.getASMText();
		}
		if ( this.operand3 ) {
			textASM += ", " + this.operand3.getASMText();
		}
		
		return textASM;
	};
	
	// Lookup hash of execution handlers for CPU instructions
	jemul8.x86CPU.prototype.hsh_fn_insnExecute = {
		// ASCII adjust after Addition
		//		Based on http://siyobik.info/index.php?module=x86&id=1
		//	TODO: how to handle other flags? Intel docs say undefined,
		//	but other sources say should be handled just as for other insns
		"AAA": function ( cpu ) {
			var AL = cpu.AL.get();
			
			if ( ((AL & 0x0F) > 9) || (cpu.AF.get()) ) {
				cpu.AL.set((AL + 6) & 0x0F);
				cpu.AH.set(cpu.AH.get() + 1);
				cpu.CF.set();
				cpu.AF.set();
			} else {
				cpu.AL.set(AL & 0x0F);
				cpu.CF.clear();
				cpu.AF.clear();
			}
		// ASCII adjust AX before Division
		}, "AAD": function ( cpu ) {
			// Val1 will almost always be 0Ah ( 10d ), meaning to adjust for base-10 / decimal.
			var val1 = this.operand1.read()
				, res = cpu.AH.get() * val1 + cpu.AL.get();
			
			cpu.AL.set(res & 0xFF);
			cpu.AH.set(0);
			
			this.setFlags_Op1(val1, res);
		// ASCII adjust after Multiplication
		}, "AAM": function ( cpu ) {
			// Val1 will almost always be 0Ah ( 10d ), meaning to adjust for base-10 / decimal.
			var val1 = this.operand1.read()
				, AL = cpu.AL.get()
				, res = cpu.AH.get() * val1 + AL;
			
			cpu.AH.set((AL / 10) >> 0);
			cpu.AL.set(AL % 10);
			this.setFlags_Op1(val1, res);
		// ASCII adjust AL after Subtraction
		//	TODO: how to handle other flags? Intel docs say undefined,
		//	but other sources say should be handled just as for other insns
		}, "AAS": function ( cpu ) {
			var AL = cpu.AL.get();
			
			if ( ((AL & 0x0F) > 9) || (cpu.AF.get()) ) {
				cpu.AL.set((AL - 6) & 0x0F);
				cpu.AH.set(cpu.AH.get() - 1);
				cpu.CF.set();
				cpu.AF.set();
			} else {
				cpu.AL.set(AL & 0x0F);
				cpu.CF.clear();
				cpu.AF.clear();
			}
		// Add with Carry
		}, "ADC": function ( cpu ) {
			var val1 = this.operand1.read()
				, val2 = this.operand2.signExtend()
			// Mask, because add operation can generate too-large numbers
				, res = (val1 + val2 + cpu.CF.get()) & this.operand1.mask;
			
			this.operand1.write(res);
			
			this.setFlags(val1, val2, res);
		// Arithmetic Addition
		}, "ADD": function ( cpu ) {
			var val1 = this.operand1.read()
				, val2 = this.operand2.signExtend()
			// Mask, because add operation can generate too-large numbers
				, res = (val1 + val2) & this.operand1.mask;
			
			this.operand1.write(res);
			
			this.setFlags(val1, val2, res);
		// Logical AND
		}, "AND": function ( cpu ) {
			var val1 = this.operand1.read()
				, val2 = this.operand2.signExtend()
				, res = val1 & val2;
			
			this.operand1.write(res);
			
			this.setFlags(val1, val2, res);
		// Adjusted Requested Privilege Level of Selector ( 286+ Protected Mode )
		}, "ARPL": function ( cpu ) {
			jemul8.problem("Execute (ARPL) :: No Protected Mode support yet.");
			return;
			
			var RPL_Source = this.operand2.getRPL();
			
			if ( this.operand1.getRPL() < RPL_Source ) {
				cpu.ZF.set();
				this.operand1.setRPL(RPL_Source);
			} else {
				cpu.ZF.clear();
			}
		// Array Index Bound Check ( 80188+ )
		//	Based on http://siyobik.info/index.php?module=x86&id=18
		}, "BOUND": function ( cpu ) {
			jemul8.problem("Execute (BOUND) :: No Array bounds support yet.");
		// Bit Scan Forward ( 386+ )
		//	TODO: how to handle other flags? Intel docs say undefined,
		//	but other sources say should be handled just as for other insns
		}, "BSF": function ( cpu ) {
			var sizeBits = this.operand1.size * 8;
			var val = this.operand2.read();
			
			// Find Least Significant Bit set
			for ( var idx_bit = 0 ; idx_bit < sizeBits ; ++idx_bit ) {
				// Found a set bit
				if ( (val >> idx_bit) & 0x01 ) {
					this.operand1.write(idx_bit);	//this.operand1.reg.set(idx_bit);
					cpu.ZF.clear();
					return;
				}
			}
			// At this point, dest operand's value is undefined ( no set bit found ),
			//	so we will use zero ( and flag explicitly with Zero Flag )
			this.operand1.write(0x00);	//this.operand1.reg.set(0x00);
			cpu.ZF.set();
		// Bit Scan Reverse ( 386+ )
		}, "BSR": function ( cpu ) {
			var sizeBits = this.operand1.size * 8;
			var val = this.operand2.read();
			
			// Find Most Significant Bit set
			for ( var idx_bit = sizeBits - 1 ; idx_bit >= 0 ; --idx_bit ) {
				// Found a set bit
				if ( (val >> idx_bit) & 0x01 ) {
					this.operand1.write(idx_bit);	//this.operand1.reg.set(idx_bit);
					cpu.ZF.clear();
					return;
				}
			}
			// At this point, dest operand's value is undefined ( no set bit found ),
			//	so we will use zero ( and flag explicitly with Zero Flag )
			this.operand1.write(0x00);	//this.operand1.reg.set(0x00);
			cpu.ZF.set();
		// Byte Swap (486+)
		//	- Reverses the byte order of a 32-bit register.
		}, "BSWAP": function ( cpu ) {
			var val = this.operand1.read();
			
			// Bits 0 through 7 are swapped with bits 24 through 31,
			//	and bits 8 through 15 are swapped with bits 16 through 23.
			this.operand1.write(
					((val & 0xFF000000) >> 24)
					| ((val & 0xFF0000) >> 8)
					| ((val & 0xFF00) << 8)
					| ((val & 0xFF) << 24)
				);
		// Bit Test ( 386+ )
		}, "BT": function ( cpu ) {
			// Read bit at specified offset & store in Carry Flag
			cpu.CF.setBit((this.operand1.read()
				>> this.operand2.read()) & 0x01);
		// Bit Test and Compliment ( 386+ )
		}, "BTC": function ( cpu ) {
			var offsetBit = this.operand2.read();
			var val = this.operand1.read();
			
			// Read bit at specified offset & store in Carry Flag
			cpu.CF.setBit((val >> offsetBit) & 0x01);
			// Complement / toggle the bit just read
			this.operand1.write(val ^ (1 << offsetBit));
		// Bit Test and Reset ( 386+ )
		}, "BTR": function ( cpu ) {
			var offsetBit = this.operand2.read();
			var val = this.operand1.read();
			
			// Read bit at specified offset & store in Carry Flag
			cpu.CF.setBit((val >> offsetBit) & 0x01);
			// Clear / reset the bit just read
			this.operand1.write(val & ~(1 << offsetBit));
		// Bit Test and Set ( 386+ )
		}, "BTS": function ( cpu ) {
			var offsetBit = this.operand2.read();
			var val = this.operand1.read();
			
			// Read bit at specified offset & store in Carry Flag
			cpu.CF.setBit((val >> offsetBit) & 0x01);
			// Set the bit just read
			this.operand1.write(val | (1 << offsetBit));
		// Procedure Call - Near, relative, displacement is relative to next instruction ( adding to EIP )
		//	( within current code segment / intrasegment call )
		}, "CALLN_R": function ( cpu ) {
			var EIP = cpu.EIP.get();
			
			// General Protection fault / exception if InstructionPointer goes out of bounds for the current Code Segment
			//if ( !this.inCodeSegmentLimits(EIP) ) { CPUException("GP", 0); return; }
			// 32-bit
			if ( this.operandSizeAttr ) {debugger;
				// Stack overflow error if no stack space ( 4 bytes / 32-bit )
				//if ( this.getStackSpace() < 4 ) { CPUException("SS", 0); return; }
				// Push full 32-bit wide EIP
				cpu.pushStack(EIP, 4);
				// Destination is rel32
				cpu.EIP.set(EIP + this.operand1.read());
			// 16-bit
			} else {
				// Stack overflow error if no stack space ( 2 bytes / 16-bit )
				//if ( this.getStackSpace() < 2 ) { CPUException("SS", 0); return; }
				// Push only IP ( save another get by just masking out high word )
				cpu.pushStack(EIP & 0x0000FFFF, 2);
				// Destination is rel16
				cpu.EIP.set((EIP + this.operand1.read()) & 0x0000FFFF);
			}
		// Procedure Call - Near, absolute indirect ( indirect means value is not encoded in insn - read from reg or mem )
		//	( within current code segment / intrasegment call )
		}, "CALLN_AI": function ( cpu ) {
			var EIP = cpu.EIP.get();
			
			// General Protection fault / exception if InstructionPointer goes out of bounds for the current Code Segment
			//if ( !this.inCodeSegmentLimits(EIP) ) { CPUException("GP", 0); return; }
			// 16-bit
			if ( !this.operandSizeAttr ) {
				// Stack overflow error if no stack space ( 2 bytes / 16-bit )
				//if ( this.getStackSpace() < 2 ) { CPUException("SS", 0); return; }
				// Push only IP ( save another get by just masking out high word )
				cpu.pushStack(EIP & 0xFFFF, 2);
				// Destination is r/m16
				cpu.EIP.set(this.operand1.read() & 0xFFFF);
			// 32-bit
			} else {
				// Stack overflow error if no stack space ( 4 bytes / 32-bit )
				//if ( this.getStackSpace() < 4 ) { CPUException("SS", 0); return; }
				// Push full 32-bit wide EIP
				cpu.pushStack(EIP, 4);
				// Destination is r/m32
				cpu.EIP.set(this.operand1.read());
			}
		// Procedure Call - Far, absolute, address given in operand
		//	( other code segment / intersegment call )
		}, "CALLF_A": function ( cpu ) {
			var EIP = cpu.EIP.get();
			
			// General Protection fault / exception if InstructionPointer goes out of bounds for the current Code Segment
			//if ( !this.inCodeSegmentLimits(EIP) ) { CPUException("GP", 0); return; }
			// Real or Virtual-8086 mode ( PE is the Protection Enable bit in CR0, VM is the EFLAGS's Virtual-8086 enable flag )
			//if ( !cpu.PE.get() || (cpu.PE.get() && cpu.VM.get()) ) {
				// 32-bit
				if ( !this.operandSizeAttr ) {
					// Stack overflow error if no stack space ( 4 bytes / 16-bit CS + 16-bit IP )
					//if ( this.getStackSpace() < 4 ) { CPUException("SS", 0); return; }
					// Push CS
					cpu.pushStack(cpu.CS.get() & 0xFFFF, 2);
					// Push only IP ( save another get by just masking out high word )
					cpu.pushStack(EIP & 0xFFFF, 2);
					// Destination is ptr16:16 or [m16:16]
					var dest = this.operand1.read();
					cpu.CS.set(dest >> 16);
					cpu.EIP.set(dest & 0xFFFF);
				// 48-bit
				} else {
					debugger;
					/** We must not use numbers > 32-bit, so we will need
						to read this from memory in two lots, 1 for the 16-bit
						CS val & 1 for the 32-bit EIP val **/
					// Stack overflow error if no stack space ( 6 bytes / 16-bit CS + 32-bit EIP )
					//if ( this.getStackSpace() < 6 ) { CPUException("SS", 0); return; }
					// Push CS
					cpu.pushStack(cpu.CS.get() & 0xFFFF, 2);
					// Push full 32-bit wide EIP
					cpu.pushStack(EIP, 4);
					// Destination is ptr16:32 or [m16:32]
					var dest = this.operand1.read();
					cpu.CS.set(dest >> 32);
					cpu.EIP.set(dest & 0xFFFFFFFF);
				}
			//}
		// Procedure Call - Far, absolute indirect
		//	(indirect means value is not encoded in insn - read from reg or mem)
		//	AKA an "intersegment" call
		}, "CALLF_AI": function ( cpu ) {
			var EIP = cpu.EIP.get();
			//alert(EIP.toString(16));
			// 32-bit
			if ( !this.operandSizeAttr ) {
				// Push CS
				cpu.pushStack(cpu.CS.get(), 2);
				// Push only IP ( save another get by just masking out high word )
				cpu.pushStack(EIP & 0xFFFF, 2);
				// Destination is ptr16:16 or [m16:16]
				var dest = this.operand1.read();
				cpu.CS.set(dest >> 16);
				cpu.EIP.set(dest & 0xFFFF);
			// 48-bit
			} else {
				debugger;
				/** We must not use numbers > 32-bit, so we will need
					to read this from memory in two lots, 1 for the 16-bit
					CS val & 1 for the 32-bit EIP val **/
				// Push CS
				cpu.pushStack(cpu.CS.get(), 4); // (Pad with 16 high-order bits)
				// Push full 32-bit wide EIP
				cpu.pushStack(EIP, 4);
				// Destination is ptr16:32 or [m16:32]
				var dest = this.operand1.read();
				cpu.CS.set(dest >> 32);
				cpu.EIP.set(dest);
			}
		// Convert Byte to Word, or Convert Word to Double in EAX
		}, "CBW": function ( cpu ) {
			var AX;
			
			// Sign-extend AL into AH
			if ( !this.operandSizeAttr ) {
				cpu.AH.set((cpu.AL.get() >> 7) ? 0xFF : 0x00);
			// Sign-extend AX into high word of EAX
			} else {
				AX = cpu.AX.get();
				cpu.EAX.set(((AX >> 15) ? 0xFFFF0000 : 0x00) | AX);
			}
		// Convert Double to Quad ( 386+ )
		}, "CDQ": function ( cpu ) {
			jemul8.problem("Execute (CDQ) :: unsupported");
		// Clear Carry flag
		}, "CLC": function ( cpu ) {
			cpu.CF.clear();
		// Clear Direction flag
		}, "CLD": function ( cpu ) {
			cpu.DF.clear();
		// Clear Interrupt flag - disables the maskable hardware interrupts. NMI's and software interrupts are not inhibited.
		}, "CLI": function ( cpu ) {
			//	TODO: support VIF ( Virtual Interrupt Flag ( V86 mode ) )
			cpu.IF.clear();
		// Clear Task Switched flag ( 286+ privileged )
		}, "CLTS": function ( cpu ) {
			// Current Privilege Level must be zero in Protected Mode
			if ( cpu.PE.get() && cpu.CPL.get() > 0 ) { CPUException("GP", 0); }
			// Task-Switched flag cleared in CR0
			cpu.TS.clear();
		// Complement/toggle/invert Carry flag
		}, "CMC": function ( cpu ) {
			cpu.CF.toggle();
		// Compare (subtracts two operands, only modifies flags, discards result)
		//	TODO:	- probably has no reason to use lazy flags, as it will always be followed
		//			by a conditional jump. ( ie. should call cpu.ZF.set() etc. )
		}, "CMP": function ( cpu ) {
			var val1 = this.operand1.read()
				, val2 = this.operand2.signExtend()
				, res = (val1 - val2) & this.operand1.mask;
			
			// Do not store result of subtraction; only flags
			this.setFlags(val1, val2, res);
		// Compare String (Byte, Word or Dword)
		//	TODO:	- could be polymorphic, one func for each string-repeat type
		//			- probably has no reason to use lazy flags, as it will always be followed
		//				by a conditional jump. (ie. should call cpu.ZF.set() etc.)
		}, "CMPS": function ( cpu ) {
			var sizeOperand = this.operand1.size;
			var val1 = 0;
			var val2 = 0;
			var res = 0;
			var esi;
			var edi;
			var esiEnd;
			var len;
			
			switch ( this.repeat ) {
			// Common case; no repeat prefix
			case "":
				val1 = this.operand1.read();
				val2 = this.operand2.signExtend();
				res = (val1 - val2) & this.operand1.mask;
				
				// Direction Flag set, decrement ( scan in reverse direction )
				if ( cpu.DF.get() ) {
					cpu.ESI.set(
						(cpu.ESI.get() - sizeOperand)
					);
					cpu.EDI.set(
						(cpu.EDI.get() - sizeOperand)
					);
				// Direction Flag clear, increment ( scan in forward direction )
				} else {
					cpu.ESI.set(
						(cpu.ESI.get() + sizeOperand)
					);
					cpu.EDI.set(
						(cpu.EDI.get() + sizeOperand)
					);
				}
				// Do not store result of subtraction; only flags
				this.setFlags(val1, val2, res);
				break;
			// Repeat while Equal, max CX times
			case "#REP/REPE": // For CMPS, it would make little sense to use REP CMPS ( ... ),
						      //	as it would only compare the last 2 characters, so these are tied together
				len = cpu.CX.get() + 1;	// Add 1 to allow more efficient pre-decrement ( see below )
				esi = cpu.ESI.get();
				edi = cpu.EDI.get();
				// Direction Flag set, decrement ( scan in reverse direction )
				if ( cpu.DF.get() ) {
					// Loop CX times ( may exit early if NOT equal, see below )
					while ( --len ) {
						val1 = this.operand1.read();
						val2 = this.operand2.signExtend();
						
						cpu.ESI.set(
							esi = (esi - sizeOperand)
						);
						cpu.EDI.set(
							edi = (edi - sizeOperand)
						);
						
						// Stop checking if NOT equal
						if ( val1 !== val2 ) { break; }
					}
				// Direction Flag clear, increment ( scan in forward direction )
				} else {
					// Loop CX times ( may exit early if NOT equal, see below )
					while ( --len ) {
						val1 = this.operand1.read();
						val2 = this.operand2.signExtend();
						
						cpu.ESI.set(
							esi = (esi + sizeOperand)
						);
						cpu.EDI.set(
							edi = (edi + sizeOperand)
						);
						
						// Stop checking if NOT equal
						if ( val1 !== val2 ) { break; }
					}
				}
				// Do not store result of subtraction; only flags
				//	NB: it is worth noting that subtraction actually only has to take place here,
				//		after the tight ( hopefully efficient ) loop above
				this.setFlags(val1, val2, (val1 - val2) & this.operand1.mask);
				cpu.CX.set(len);
				break;
			// Repeat while NOT Equal, max CX times
			case "#REPNE":
				len = cpu.CX.get() + 1;	// Add 1 to allow more efficient pre-decrement ( see below )
				esi = cpu.ESI.get();
				edi = cpu.EDI.get();
				// Direction Flag set, decrement ( scan in reverse direction )
				if ( cpu.DF.get() ) {
					// Loop CX times ( may exit early if not equal, see below )
					while ( --len ) {
						val1 = this.operand1.read();
						val2 = this.operand2.read();
						
						cpu.ESI.set(
							esi = (esi - sizeOperand)
						);
						cpu.EDI.set(
							edi = (edi - sizeOperand)
						);
						
						// Stop checking if equal
						if ( val1 === val2 ) { break; }
					}
				// Direction Flag clear, increment ( scan in forward direction )
				} else {
					// Loop CX times ( may exit early if not equal, see below )
					while ( --len ) {
						val1 = this.operand1.read();
						val2 = this.operand2.read();
						
						cpu.ESI.set(
							esi = (esi + sizeOperand)
						);
						cpu.EDI.set(
							edi = (edi + sizeOperand)
						);
						
						// Stop checking if equal
						if ( val1 === val2 ) { break; }
					}
				}
				// Do not store result of subtraction; only flags
				//	NB: it is worth noting that subtraction actually only
				//	has to take place here, after the tight
				//	(hopefully efficient) loop above
				this.setFlags(val1, val2, (val1 - val2)
					& this.operand1.mask);
				cpu.CX.set(len);
				break;
			default:
				jemul8.problem("Execute (CMPS) :: invalid string repeat operation/prefix.");
			}
		// Compare and Exchange (486+)
		}, "CMPXCHG": function ( cpu ) {
			var reg_acc = cpu.accumulator[ this.operand1.size ]
				, val_acc = reg_acc.get()
				, val1 = this.operand1.read()
				, val2 // Only needed for 1 of the conditions
				, res = (val_acc - val1) & this.operand1.mask;
			
			// NB: the Intel specs say just copy src -> dest or dest -> src;
			//	however, an XCHG would do an actual swap, so this may be incorrect
			if ( res === 0 ) {
				val2 = this.operand2.signExtend();
				this.operand1.write(val2); // Write src -> dest
			} else {
				reg_acc.set(val1); // Write dest -> accumulator
			}
			// Do not store result of subtraction; only flags
			this.setFlags(val_acc, val1, res);
		// Compare and Exchange 8 bytes (Pentium+)
		}, "CMPXCHG8": function ( cpu ) {
			var val1 = this.operand1.read();
			var val2 = (cpu.EDX.get() << 32) | cpu.EAX.get();
			var res = (val1 - val2) & this.operand1.mask;
			
			// NB: the Intel specs say just copy src -> dest or dest -> src;
			//	however, an XCHG would do an actual swap, so this may be incorrect
			if ( res === 0 ) {
				// WARN! use of ECX:EBX here, _NOT_ the tested EDX:EAX!
				this.operand1.write((cpu.ECX.get() << 32) | cpu.EBX.get());
			} else {
				cpu.EAX.set(val1 & 0xFFFFFFFF);
				cpu.EDX.set(val1 >> 32);
			}
			// Do not store result of subtraction; only flags
			this.setFlags(val1, val2, res);
		// Convert Word to Dword, or Dword to Quadword
		}, "CWD": function ( cpu ) {
			// Sign-extend AX into DX:AX
			if ( !this.operandSizeAttr ) {
				cpu.DX.set((cpu.AX.get() >> 15) ? 0xFFFF : 0x0000);
			// Sign-extend EAX into EDX
			} else {
				cpu.EDX.set(((cpu.EAX.get() >> 31) ? 0xFFFFFFFF : 0x00000000));
			}
		// Convert Word to Extended Dword ( 386+ )
		}, "CWDE": function ( cpu ) {
			jemul8.problem("Execute (CWDE) :: unsupported");
		// Decimal Adjust after Addition
		}, "DAA": function ( cpu ) {
			jemul8.problem("Execute (DAA) :: unsupported");
		// Decimal Adjust for Subtraction
		}, "DAS": function ( cpu ) {
			debugger;
			jemul8.problem("Execute (DAS) :: unsupported");
		// Decrement
		}, "DEC": function ( cpu ) {
			// NB: Addition and subtraction handle two's complement the same way
			//	for both unsigned and signed interpretations of numbers
			var val = (this.operand1.read() - 1) & this.operand1.mask;
			
			this.operand1.write(val);
			
			this.setFlags_Result(val);
		// Unsigned Divide
		// - See http://faydoc.tripod.com/cpu/div.htm
		}, "DIV": function ( cpu ) {
			var sizeOperand = this.operand2.size
			// NB: Default is to interpret as UNsigned
				, dividend /* NOT = this.operand1.read() */
				, divisor = this.operand2.read()
				, res;
			
			// Divide by Zero - cpu Interrupt
			if ( /*dividend == 0 || */divisor == 0 ) { cpu.interrupt(0); return; }
			
			// Dividend is AX
			if ( sizeOperand == 1 ) {
				dividend = cpu.AX.get();
				// Integer result - truncated toward zero
				res = (dividend / divisor) >> 0;
				cpu.AL.set(res); // Quotient
				cpu.AH.set(dividend % divisor); // Remainder
			// Dividend is DX:AX
			} else if ( sizeOperand == 2 ) {
				dividend = (cpu.DX.get() << 16) | cpu.AX.get();
				// Integer result - truncated toward zero
				res = (dividend / divisor) >> 0;
				cpu.AX.set(res); // Quotient
				cpu.DX.set(dividend % divisor); // Remainder
			// Dividend is EDX:EAX
			} else if ( sizeOperand == 4 ) {//debugger;
				//jemul8.problem("Cannot support 64-bit divide.");
				//return;
				dividend = jemul8.Int64.fromNumber(dividend);
				divisor = jemul8.Int64.fromNumber(divisor);
				res = dividend.div(divisor);
				cpu.EAX.set(res.getLowBits());
				cpu.EDX.set(dividend.modulo(divisor).getLowBits());
				jemul8.warning("DIV insn :: setFlags needs to support Int64s");
			}
			
			this.setFlags(dividend, divisor, res);
		// Make Stack Frame ( 80188+ )
		}, "ENTER": function ( cpu ) {debugger;
			var sizeOperand = this.operand1.size;
			var bytesStack = this.operand1.read();
			var levelLexicalNesting = this.operand2.read() % 32;
			var EBP = cpu.EBP.get();
			var ESP;
			
			
			if ( sizeOperand <= 2 ) {
				cpu.pushStack(EBP & 0xFF, 1);
			} else {
				cpu.pushStack(EBP, 2);
			}
			// Save Frame pointer
			//	( NB: this is done after the push() above, as SP would be modified )
			ESP = cpu.ESP.get();
			
			if ( levelLexicalNesting > 0 ) {
				for ( var i = 1 ; i < levelLexicalNesting ; ++i ) {
					if ( sizeOperand <= 2 ) {
						cpu.EBP.set(EBP = EBP - 2);
						cpu.pushStack(EBP & 0xFF, 1);
					} else {
						cpu.EBP.set(EBP = EBP - 4);
						cpu.pushStack(EBP, 2);
					}
				}
				cpu.pushStack(ESP, 2);
			}
			// Set Frame pointer to current Stack pointer
			cpu.EBP.set(ESP);
			// Subtract num bytes allocated from Stack pointer
			//	( NB: ESP re-read for here, push()s above will have changed it )
			cpu.ESP.set(cpu.ESP.get() - bytesStack);
		// Escape
		}, "ESC": function ( cpu ) {
			jemul8.problem("Execute (ESC) :: unsupported");
		// Halt cpu
		//	( Or jemul8 Hypervisor escape - see notes below )
		}, "HLT": function ( cpu ) {
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
			if ( func_interruptHandler = cpu.arr_mapAbsoluteOffset_ToHLEInterruptHandler[this.offset] ) {
				// Quickly dispatch to internal Interrupt handler
				func_interruptHandler.call(cpu);
				return;
			}*/
			/* ========= /Hypervisor escape ========= */
			/**** If we reached this point, it was just a normal HLT command ****/
			//alert("cpu halted");
			cpu.halt();
		// Signed Integer Division
		}, "IDIV": function ( cpu ) {
			debugger;
			jemul8.panic("Needs to be as per IMUL below.");
			
			var sizeOperand = this.operand1.size;
			// NB: Interpret as signed
			var dividend = this.operand1.read();
			var divisor = this.operand2.signExtend();
			var res;
			
			// Divide by Zero - cpu Interrupt
			if ( divisor == 0 ) { cpu.interrupt(0); return; }
			// Integer result - truncated toward zero
			res = (dividend / divisor) >> 0;
			// Dividend is AX
			if ( sizeOperand == 1 ) {
				// Integer result is written to quotient
				cpu.AL.set(res);
				// Remainder
				cpu.AH.set(dividend % divisor);
			// Dividend is DX:AX
			} else if ( sizeOperand == 2 ) {
				// Integer result is written to quotient
				cpu.AX.set(res);
				// Remainder
				cpu.DX.set(dividend % divisor);
			// Dividend is EDX:EAX
			} else if ( sizeOperand == 4 ) {
				// Integer result is written to quotient
				cpu.EAX.set(res);
				// Remainder
				cpu.EDX.set(dividend % divisor);
			}
			
			this.setFlags(dividend, divisor, res);
		// Signed Multiply
		// - See http://faydoc.tripod.com/cpu/imul.htm
		}, "IMUL": function ( cpu ) {
			var multiplicand, multiplier, res;
			
			if ( this.operand3 ) {
				multiplicand = this.operand2.signExtend();
				multiplier = this.operand3.signExtend();
			} else if ( this.operand2 ) {
				multiplicand = this.operand1.read();
				multiplier = this.operand2.signExtend();
			// Hand off to MUL instruction
			} else if ( this.operand1 ) {
				cpu.hsh_fn_insnExecute.MUL.call(this, cpu);
				return;
			} else {
				jemul8.panic("IMUL :: Must have at least 1 operand");
			}
			res = (multiplicand * multiplier) & this.operand1.mask;
			this.operand1.write(res);
			
			this.setFlags(multiplicand, multiplier, res);
		// Input Byte or Word from Port
		}, "IN": function ( cpu ) {
			this.operand1.write(cpu.machine.io.read(
				this.operand2.read()	// Port
				, this.operand1.size)	// IO length
			);
		// Increment
		}, "INC": function ( cpu ) {
			// NB: Addition and subtraction handle two's complement the same way
			//	for both unsigned and signed interpretations of numbers
			var val = (this.operand1.read() + 1) & this.operand1.mask;
			
			this.operand1.write(val);
			
			this.setFlags_Result(val);
		// Input String from Port ( 80188+ )
		}, "INS": function ( cpu ) {
			jemul8.problem("Execute (INS) :: Not implemented yet");
		// Software-generated interrupt
		}, "INT": function ( cpu ) {
			if ( this.operandSizeAttr ) { debugger; }
			cpu.interrupt(this.operand1.read());
		// Interrupt 4 on Overflow
		}, "INTO": function ( cpu ) {
			// Interrupt number is implicitly 4 (Overflow Exception #OF),
			//	and only called if Overflow Flag set
			if ( cpu.OF.get() ) {
				cpu.interrupt(4);
			}
		// Invalidate Cache ( 486+ )
		}, "INVD": function ( cpu ) {
			jemul8.problem("Execute (INVD) :: unsupported");
		// Invalidate Translation Look-Aside Buffer Entry ( 486+ )
		}, "INVLPG": function ( cpu ) {
			jemul8.problem("Execute (INVLPG) :: unsupported");
		// Perform a far return after Interrupt handling
		//	NB: not used by internal Hypervisor Interrupt Service Routines, for speed
		//	as (E)FLAGS register never needs to be restored after their exec ( it is unaffected )
		//	Based on http://pdos.csail.mit.edu/6.828/2005/readings/i386/IRET.htm
		}, "IRET": function ( cpu ) {
			var eflags;
			if ( !this.operandSizeAttr ) {
				// Set all of EIP to zero-out high word
				cpu.EIP.set(cpu.popStack(2));
				cpu.CS.set(cpu.popStack(2));	// 16-bit pop
				// Don't clear high EFLAGS word (is this right??)
				cpu.FLAGS.set(cpu.popStack(2));
			} else {debugger;
				cpu.EIP.set(cpu.popStack(4));
				// Yes, we must pop 32 bits but discard high word
				cpu.CS.set(cpu.popStack(4));
				eflags = cpu.popStack(4);
				cpu.EFLAGS.set((eflags & 0x257FD5)
					| (cpu.EFLAGS.get() & 0x1A0000));
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
		}, "JO": function ( cpu ) {
			// Quickly skip if condition not met
			//if ( !cpu.OF.get() ) { return; }
			// NB: Interpret as signed
			//var EIPNew = cpu.EIP.get() + this.operand1.read();
			
			// Wrap 16-bit addresses
			//if ( this.sizeOperand == 2 ) { EIPNew &= 0x0000FFFF; }
			//cpu.EIP.set(EIPNew);
			
			if ( cpu.OF.get() ) {
				jumpShortOrNear(this);
			}
		// Jump if NO Overflow
		}, "JNO": function ( cpu ) {
			// Quickly skip if condition not met
			//if ( cpu.OF.get() ) { return; }
			// NB: Interpret as signed
			//var EIPNew = cpu.EIP.get() + this.operand1.read();
			
			// Wrap 16-bit addresses
			//if ( this.sizeOperand == 2 ) { EIPNew &= 0x0000FFFF; }
			//cpu.EIP.set(EIPNew);
			
			if ( !cpu.OF.get() ) {
				jumpShortOrNear(this);
			}
		// Jump if Below
		}, "JB": function ( cpu ) {
			// Quickly skip if condition not met
			//if ( !cpu.CF.get() ) { return; }
			// NB: Interpret as signed
			//var EIPNew = cpu.EIP.get() + this.operand1.read();
			
			// Wrap 16-bit addresses
			//if ( this.sizeOperand == 2 ) { EIPNew &= 0x0000FFFF; }
			//cpu.EIP.set(EIPNew);
			
			if ( cpu.CF.get() ) {
				jumpShortOrNear(this);
			}
		// Jump if NOT Below
		}, "JNB": function ( cpu ) {
			// Quickly skip if condition not met
			//if ( cpu.CF.get() ) { return; }
			// NB: Interpret as signed
			//var EIPNew = cpu.EIP.get() + this.operand1.read();
			
			// Wrap 16-bit addresses
			//if ( this.sizeOperand == 2 ) { EIPNew &= 0x0000FFFF; }
			//cpu.EIP.set(EIPNew);
			
			if ( !cpu.CF.get() ) {
				jumpShortOrNear(this);
			}
		// Jump if Equal
		}, "JE": function ( cpu ) {
			// Quickly skip if condition not met
			//if ( !cpu.ZF.get() ) { return; }
			// NB: Interpret as signed
			//var EIPNew = cpu.EIP.get() + this.operand1.read();
			
			// Wrap 16-bit addresses
			//if ( this.sizeOperand == 2 ) { EIPNew &= 0x0000FFFF; }
			//cpu.EIP.set(EIPNew);
			
			if ( cpu.ZF.get() ) {
				jumpShortOrNear(this);
			}
		// Jump if NOT Equal
		}, "JNE": function ( cpu ) {
			// Quickly skip if condition not met
			//if ( cpu.ZF.get() ) { return; }
			// NB: Interpret as signed
			//var EIPNew = cpu.EIP.get() + this.operand1.read();
			
			// Wrap 16-bit addresses
			//if ( this.sizeOperand == 2 ) { EIPNew &= 0x0000FFFF; }
			//cpu.EIP.set(EIPNew);
			
			if ( !cpu.ZF.get() ) {
				jumpShortOrNear(this);
			}
		// Jump if Below or Equal
		}, "JBE": function ( cpu ) {
			// Quickly skip if condition not met
			//if ( !cpu.CF.get() && !cpu.ZF.get() ) { return; }
			// NB: Interpret as signed
			//var EIPNew = cpu.EIP.get() + this.operand1.read();
			
			// Wrap 16-bit addresses
			//if ( this.sizeOperand == 2 ) { EIPNew &= 0x0000FFFF; }
			//cpu.EIP.set(EIPNew);
			
			if ( cpu.ZF.get() || cpu.CF.get() ) {
				jumpShortOrNear(this);
			}
		// Jump if NOT Below or Equal
		}, "JNBE": function ( cpu ) {
			// Quickly skip if condition not met
			//if ( cpu.CF.get() && cpu.ZF.get() ) { return; }
			// NB: Interpret as signed
			//var EIPNew = cpu.EIP.get() + this.operand1.read();
			
			// Wrap 16-bit addresses
			//if ( this.sizeOperand == 2 ) { EIPNew &= 0x0000FFFF; }
			//cpu.EIP.set(EIPNew);
			
			if ( !cpu.ZF.get() && !cpu.CF.get() ) {
				jumpShortOrNear(this);
			}
		// Jump if Sign
		}, "JS": function ( cpu ) {
			// Quickly skip if condition not met
			//if ( !cpu.SF.get() ) { return; }
			// NB: Interpret as signed
			//var EIPNew = cpu.EIP.get() + this.operand1.read();
			
			// Wrap 16-bit addresses
			//if ( this.sizeOperand == 2 ) { EIPNew &= 0x0000FFFF; }
			//cpu.EIP.set(EIPNew);
			
			if ( cpu.SF.get() ) {
				jumpShortOrNear(this);
			}
		// Jump if NOT Sign
		}, "JNS": function ( cpu ) {
			// Quickly skip if condition not met
			//if ( cpu.SF.get() ) { return; }
			// NB: Interpret as signed
			//var EIPNew = cpu.EIP.get() + this.operand1.read();
			
			// Wrap 16-bit addresses
			//if ( this.sizeOperand == 2 ) { EIPNew &= 0x0000FFFF; }
			//cpu.EIP.set(EIPNew);
			
			if ( !cpu.SF.get() ) {
				jumpShortOrNear(this);
			}
		// Jump if Parity / Parity Even
		}, "JP": function ( cpu ) {
			// Quickly skip if condition not met
			//if ( !cpu.PF.get() ) { return; }
			// NB: Interpret as signed
			//var EIPNew = cpu.EIP.get() + this.operand1.read();
			
			// Wrap 16-bit addresses
			//if ( this.sizeOperand == 2 ) { EIPNew &= 0x0000FFFF; }
			//cpu.EIP.set(EIPNew);
			
			if ( cpu.PF.get() ) {
				jumpShortOrNear(this);
			}
		// Jump if NOT Parity / Parity Even
		}, "JNP": function ( cpu ) {
			// Quickly skip if condition not met
			//if ( cpu.PF.get() ) { return; }
			// NB: Interpret as signed
			//var EIPNew = cpu.EIP.get() + this.operand1.read();
			
			// Wrap 16-bit addresses
			//if ( this.sizeOperand == 2 ) { EIPNew &= 0x0000FFFF; }
			//cpu.EIP.set(EIPNew);
			
			if ( !cpu.PF.get() ) {
				jumpShortOrNear(this);
			}
		// Jump if Less Than
		}, "JL": function ( cpu ) {
			// Quickly skip if condition not met
			//if ( cpu.ZF.get() || (cpu.SF.get() === cpu.OF.get()) ) { return; }
			// NB: Interpret as signed
			//var EIPNew = cpu.EIP.get() + this.operand1.read();
			
			// Wrap 16-bit addresses
			//if ( this.sizeOperand == 2 ) { EIPNew &= 0x0000FFFF; }
			//cpu.EIP.set(EIPNew);
			
			if ( /*!cpu.ZF.get() && */(cpu.SF.get() !== cpu.OF.get()) ) {
				jumpShortOrNear(this);
			}
		// Jump if NOT Less Than
		}, "JNL": function ( cpu ) {
			// Quickly skip if condition not met
			//if ( cpu.SF.get() !== cpu.OF.get() ) { return; }
			// NB: Interpret as signed
			//var EIPNew = cpu.EIP.get() + this.operand1.read();
			
			// Wrap 16-bit addresses
			//if ( this.sizeOperand == 2 ) { EIPNew &= 0x0000FFFF; }
			//cpu.EIP.set(EIPNew);
			
			if ( cpu.SF.get() === cpu.OF.get() ) {
				jumpShortOrNear(this);
			}
		// Jump if Less Than or Equal
		}, "JLE": function ( cpu ) {
			// Quickly skip if condition not met
			//if ( !cpu.ZF.get() && (cpu.SF.get() === cpu.OF.get()) ) { return; }
			// NB: Interpret as signed
			//var EIPNew = cpu.EIP.get() + this.operand1.read();
			
			// Wrap 16-bit addresses
			//if ( this.sizeOperand == 2 ) { EIPNew &= 0x0000FFFF; }
			//cpu.EIP.set(EIPNew);
			
			if ( cpu.ZF.get() || (cpu.SF.get() !== cpu.OF.get()) ) {
				jumpShortOrNear(this);
			}
		// Jump if NOT Less Than or Equal
		}, "JNLE": function ( cpu ) {
			// Quickly skip if condition not met
			//if ( !cpu.ZF.get() && (cpu.SF.get() === cpu.OF.get()) ) { return; }
			// NB: Interpret as signed
			//var EIPNew = cpu.EIP.get() + this.operand1.read();
			
			// Wrap 16-bit addresses
			//if ( this.sizeOperand == 2 ) { EIPNew &= 0x0000FFFF; }
			//cpu.EIP.set(EIPNew);
			if ( !cpu.ZF.get() && (cpu.SF.get() === cpu.OF.get()) ) {
				jumpShortOrNear(this);
			}
		// Jump if Register CX is Zero
		// Jump if Register ECX is Zero ( 386+ )
		//	( NB: this conditional jump has no inverse )
		}, "JCXZ": function ( cpu ) {
			//var EIPNew;
			//var sizeOperand = this.sizeOperand;
			
			// Quickly skip if condition not met
			// JCXZ
			//if ( sizeOperand == 2 ) {
			//	if ( cpu.CX.get() !== 0 ) { return; }
			// JECXZ
			//} else {
			//	if ( cpu.ECX.get() !== 0 ) { return; }
			//}
			
			// NB: Interpret as signed
			//EIPNew = cpu.EIP.get() + this.operand1.read();
			// Wrap 16-bit addresses
			//if ( sizeOperand == 2 ) { EIPNew &= 0x0000FFFF; }
			//cpu.EIP.set(EIPNew);
			
			// Quickly skip if condition not met
			if ( (this.operandSizeAttr ? cpu.ECX : cpu.CX) // Base on op-size
					.get() === 0 ) {
				jumpShortOrNear(this);
			}
		/* ======= /Conditional Jump Instructions ======= */
		
		// Unconditional Jump (Short 8-bit / Near 16-bit)
		//	- relative to next Instruction
		}, "JMPN": function ( cpu ) {
			// NB: Interpret as signed
			//var EIPNew = cpu.EIP.get() + this.operand1.read();
			
			// Wrap 16-bit addresses
			//if ( this.sizeOperand <= 2 ) { EIPNew &= 0x0000FFFF; }
			//cpu.EIP.set(EIPNew);
			
			jumpShortOrNear(this);
		// Unconditional Jump (Far - if indirect then address
		//	is read from memory pointer or register)
		}, "JMPF": function ( cpu ) {//debugger;
			// NB: Do not interpret as signed; cannot have an absolute EIP that is negative
			var CS_EIP = this.operand1.read();
			
			// 32-bit pointer
			if ( !this.operandSizeAttr ) {
				cpu.CS.set(CS_EIP >> 16);
				cpu.EIP.set(CS_EIP & 0xFFFF);
			// 48-bit pointer (NOT 64-bit; even though EIP is 32-bit,
			//	CS is still 16-bit)
			} else {
				cpu.CS.set(CS_EIP >> 32);
				cpu.EIP.set(CS_EIP & 0xFFFFFFFF);
			}
		// Load Flags into AH Register
		}, "LAHF": function ( cpu ) {
			// Transfer only the low byte of Flags word to AH
			cpu.AH.set(cpu.FLAGS.get() & 0xFF);
		// Load Access Rights Byte
		}, "LAR": function ( cpu ) {
			jemul8.problem("Execute (LAR) :: unsupported");
		// Load Effective Address
		}, "LEA": function ( cpu ) {
			// Just compute the Memory Address of the 2nd Operand
			//	and store it in the first
			this.operand1.write(
				this.operand2.getPointerAddress() & this.operand1.mask
			);
		// High Level Procedure Exit
		}, "LEAVE": function ( cpu ) {debugger;
			// NB: Reverses the actions of the ENTER instruction. 
			//	By copying the frame pointer to the stack pointer,
			//	LEAVE releases the stack space used by a procedure for its local variables.
			if ( cpu.getStackAddressSize() === 16 ) {
				cpu.SP.set(cpu.BP.get());
			} else {
				cpu.ESP.set(cpu.EBP.get());
			}
			if ( !this.operandSizeAttr ) {
				cpu.BP.set(cpu.popStack(2));
			} else {
				cpu.EBP.set(cpu.popStack(4));
			}
		// Load Global Descriptor Table Register
		}, "LGDT": function ( cpu ) {
			jemul8.problem("Execute (LGDT) :: unsupported");
		// Load Interrupt Descriptor Table Register
		}, "LIDT": function ( cpu ) {
			jemul8.problem("Execute (LIDT) :: unsupported");
		// Load Full Pointer with DS
		}, "LDS": function ( cpu ) {
			var farPointer = this.operand2.read();
			
			// 16-bit
			if ( !this.operandSizeAttr ) {
				/*
				 *  Example:
				 *  LDS AX, m
				 *  m   DW 1234h
				 *      DW 5678h
				 *  ... will set AX=1234h, DS=5678h
				 */
				// TODO: Remove this mask? (should be covered in .write())
				this.operand1.write(farPointer & 0xFFFF);
				// TODO: Remove this mask? (should be covered in .set())
				cpu.DS.set((farPointer >> 16) & 0xFFFF);
				
				// In Protected Mode, load the descriptor into the segment register
			// 32-bit
			} else {debugger;
				this.operand1.write(this.operand2.read());
				jemul8.panic("LDS :: Not implemented");
				// In Protected Mode, load the descriptor into the segment register
			}
		// Load Full Pointer with ES
		}, "LES": function ( cpu ) {
			var farPointer = this.operand2.read();
			
			// 16-bit
			if ( !this.operandSizeAttr ) {
				/*
				 *  Example:
				 *  LES AX, m
				 *  m   DW 1234h
				 *      DW 5678h
				 *  ... will set AX=1234h, ES=5678h
				 */
				// TODO: Remove this mask? (should be covered in .write())
				this.operand1.write(farPointer & 0xFFFF);
				// TODO: Remove this mask? (should be covered in .set())
				cpu.ES.set((farPointer >> 16) & 0xFFFF);
				
				// In Protected Mode, load the descriptor into the segment register
			// 32-bit
			} else {debugger;
				this.operand1.write(this.operand2.read());
				jemul8.panic("LES :: Not implemented");
				// In Protected Mode, load the descriptor into the segment register
			}
		// Load Full Pointer with FS
		}, "LFS": function ( cpu ) {
			var farPointer = this.operand2.read();
			
			// 16-bit
			if ( !this.operandSizeAttr ) {
				/*
				 *  Example:
				 *  LFS AX, m
				 *  m   DW 1234h
				 *      DW 5678h
				 *  ... will set AX=1234h, FS=5678h
				 */
				// TODO: Remove this mask? (should be covered in .write())
				this.operand1.write(farPointer & 0xFFFF);
				// TODO: Remove this mask? (should be covered in .set())
				cpu.FS.set((farPointer >> 16) & 0xFFFF);
				
				// In Protected Mode, load the descriptor into the segment register
			// 32-bit
			} else {debugger;
				this.operand1.write(this.operand2.read());
				jemul8.panic("LFS :: Not implemented");
				// In Protected Mode, load the descriptor into the segment register
			}
		// Load Full Pointer with GS
		}, "LGS": function ( cpu ) {
			var farPointer = this.operand2.read();
			
			// 16-bit
			if ( !this.operandSizeAttr ) {
				/*
				 *  Example:
				 *  LGS AX, m
				 *  m   DW 1234h
				 *      DW 5678h
				 *  ... will set AX=1234h, GS=5678h
				 */
				// TODO: Remove this mask? (should be covered in .write())
				this.operand1.write(farPointer & 0xFFFF);
				// TODO: Remove this mask? (should be covered in .set())
				cpu.GS.set((farPointer >> 16) & 0xFFFF);
				
				// In Protected Mode, load the descriptor into the segment register
			// 32-bit
			} else {debugger;
				this.operand1.write(this.operand2.read());
				jemul8.panic("LGS :: Not implemented");
				// In Protected Mode, load the descriptor into the segment register
			}
		// Load Full Pointer with SS
		}, "LSS": function ( cpu ) {
			var farPointer = this.operand2.read();
			
			// 16-bit
			if ( !this.operandSizeAttr ) {
				/*
				 *  Example:
				 *  LSS AX, m
				 *  m   DW 1234h
				 *      DW 5678h
				 *  ... will set AX=1234h, SS=5678h
				 */
				// TODO: Remove this mask? (should be covered in .write())
				this.operand1.write(farPointer & 0xFFFF);
				// TODO: Remove this mask? (should be covered in .set())
				cpu.SS.set((farPointer >> 16) & 0xFFFF);
				
				// In Protected Mode, load the descriptor into the segment register
			// 32-bit
			} else {debugger;
				this.operand1.write(this.operand2.read());
				jemul8.panic("LSS :: Not implemented");
				// In Protected Mode, load the descriptor into the segment register
			}
		// Load Local Descriptor Table Register
		}, "LLDT": function ( cpu ) {
			jemul8.problem("Execute (LLDT) :: unsupported");
		// Load Machine Status Word
		}, "LMSW": function ( cpu ) {
			jemul8.problem("Execute (LMSW) :: unsupported");
			// cpu.CR0
		// Load String ( Byte, Word or Dword )
		//	TODO: could be polymorphic, one func for each string-repeat type
		//	TODO: there is potential for speed ups here by using native .indexOf() / .slice() and similar
		//		array methods, instead of a possibly slow loop over each individual byte
		}, "LODS": function ( cpu ) {
			var sizeOperand = this.operand1.size;
			var val1;
			var val2;
			var res;
			var esi, esiStart, esiEnd;
			var edi;
			var len;
			
			switch ( this.repeat ) {
			// Common case; no repeat prefix
			case "":
				// Load String Character ( Operand 1 is part of Accumulator, Operand 2
				//	will be a memory pointer using (E)SI )
				this.operand1.write(this.operand2.read());
				// Direction Flag set, decrement ( scan in reverse direction )
				if ( cpu.DF.get() ) {
					cpu.ESI.set(
						(cpu.ESI.get() - sizeOperand)
					);
					cpu.EDI.set(
						(cpu.EDI.get() - sizeOperand)
					);
				// Direction Flag clear, increment ( scan in forward direction )
				} else {
					cpu.ESI.set(
						(cpu.ESI.get() + sizeOperand)
					);
					cpu.EDI.set(
						(cpu.EDI.get() + sizeOperand)
					);
				}
				
				break;
			// Repeat CX times
			case "#REP/REPE":
				len = cpu.CX.get() * sizeOperand;
				esi = cpu.ESI.get();
				edi = cpu.EDI.get();
				// Direction Flag set, decrement (scan in reverse direction)
				if ( cpu.DF.get() ) {
					esiEnd = esi - len;
					for ( ; esi >= esiEnd
					; esi -= sizeOperand, edi -= sizeOperand ) {
						cpu.ESI.set(esi);
						cpu.EDI.set(edi);
						// Load String Character (Operand 1 is part
						//	of Accumulator, Operand 2
						//	will be a memory pointer using (E)SI)
						this.operand1.write(this.operand2.read());
					}
				// Direction Flag clear, increment (scan in forward direction)
				} else {
					esiEnd = esi + len;
					for ( ; esi < esiEnd
					; esi += sizeOperand, edi += sizeOperand ) {
						cpu.ESI.set(esi);
						cpu.EDI.set(edi);
						// Load String Character (Operand 1 is part
						//	of Accumulator, Operand 2
						//	will be a memory pointer using (E)SI)
						this.operand1.write(this.operand2.read());
					}
				}
				cpu.ESI.set(esi);
				cpu.EDI.set(edi);
				cpu.CX.set(0);
				break;
			default:
				jemul8.problem("Execute (LODS) ::"
					+ " invalid string repeat operation/prefix.");
			}
		// Loop Control with CX Counter
		}, "LOOP": function ( cpu ) {
			var regCount = (this.addressSizeAttr) ? cpu.ECX : cpu.CX;
			var count = regCount.get() - 1; // Decrement the counter!
			
			regCount.set(count);
			
			// Loop round by jumping to the address in operand1,
			//	if counter has not yet reached zero
			if ( count !== 0 ) {
				if ( !this.operandSizeAttr ) {
					// Sign-extend to signed int
					cpu.IP.set(cpu.IP.get() + this.operand1.signExtend(2));
				} else {
					// Sign-extend to signed int
					cpu.EIP.set(cpu.EIP.get() + this.operand1.signExtend(4));
				}
			}
		// Loop Control with CX Counter
		}, "LOOPE": function ( cpu ) {
			var regCount;
			var count;
			
			regCount = this.addressSizeAttr ? cpu.ECX : cpu.CX;
			
			// Decrement counter ( & store result in local var to avoid another expensive Get() )
			regCount.set(count = regCount.get() - 1);
			
			if ( count != 0 && cpu.ZF.get() ) {
				if ( !this.operandSizeAttr ) {
					// Sign-extend to signed int
					cpu.IP.set(cpu.IP.get() + this.operand1.read());
				} else {
					// Sign-extend to signed int
					cpu.EIP.set(cpu.EIP.get() + this.operand1.read());
				}
			}
		// Loop Control with CX Counter
		}, "LOOPNE": function ( cpu ) {
			var regCount;
			var count;
			
			regCount = this.addressSizeAttr ? cpu.ECX : cpu.CX;
			
			// Decrement counter ( & store result in local var to avoid another expensive Get() )
			regCount.set(count = regCount.get() - 1);
			
			if ( count != 0 && !cpu.ZF.get() ) {
				if ( !this.operandSizeAttr ) {
					// Sign-extend to signed int
					cpu.IP.set(cpu.IP.get() + this.operand1.read());
				} else {
					// Sign-extend to signed int
					cpu.EIP.set(cpu.EIP.get() + this.operand1.read());
				}
			}
		// Load Segment Limit
		}, "LSL": function ( cpu ) {
			jemul8.problem("Execute (LSL) :: unsupported");
		// Load Task Register
		}, "LTR": function ( cpu ) {
			jemul8.problem("Execute (LTR) :: unsupported");
		// Move ( Copy ) data
		}, "MOV": function ( cpu ) {
			this.operand1.write(this.operand2.read());
		// Move Data from String to String ( Byte, Word or Dword )
		//	TODO: could be polymorphic, one func for each string-repeat type
		//	TODO: there is potential for speed ups here by using native .indexOf() / .slice() and similar
		//		array methods, instead of a possibly slow loop over each individual byte
		//	- Use ArrayBuffer .set() method for fast copying!!!
		}, "MOVS": function ( cpu ) {
			var sizeOperand = this.operand1.size;
			var val1;
			var val2;
			var res;
			var esi, esiStart, esiEnd;
			var edi;
			var len;
			
			switch ( this.repeat ) {
			// Common case; no repeat prefix
			case "":
				// Load String Character (Operand 1 is part of Accumulator, Operand 2
				//	will be a memory pointer using (E)SI)
				this.operand2.write(this.operand1.read());
				// Direction Flag set, decrement (scan in reverse direction)
				if ( cpu.DF.get() ) {
					cpu.ESI.set(cpu.ESI.get() - sizeOperand);
					cpu.EDI.set(cpu.EDI.get() - sizeOperand);
				// Direction Flag clear, increment (scan in forward direction)
				} else {
					cpu.ESI.set(cpu.ESI.get() + sizeOperand);
					cpu.EDI.set(cpu.EDI.get() + sizeOperand);
				}
				break;
			// Repeat CX times
			case "#REP/REPE":
				len = cpu.CX.get() * sizeOperand;
				esi = cpu.ESI.get();
				edi = cpu.EDI.get();
				// Direction Flag set, decrement (scan in reverse direction)
				if ( cpu.DF.get() ) {
					esiEnd = esi - len;
					for ( ; esi >= esiEnd
					; esi -= sizeOperand, edi -= sizeOperand ) {
						cpu.ESI.set(esi);
						cpu.EDI.set(edi);
						// Load String Character
						//	- Operand 1 is part of Accumulator
						//	- Operand 2 will be a memory pointer using (E)SI
						this.operand2.write(this.operand1.read());
					}
				// Direction Flag clear, increment (scan in forward direction)
				} else {
					esiEnd = esi + len;
					for ( ; esi < esiEnd
					; esi += sizeOperand, edi += sizeOperand ) {
						// Load String Character
						//	- Operand 1 is part of Accumulator
						//	- Operand 2 will be a memory pointer using (E)SI
						this.operand2.write(this.operand1.read());
						cpu.ESI.set(esi);
						cpu.EDI.set(edi);
					}
				}
				cpu.ESI.set(esi);
				cpu.EDI.set(edi);
				cpu.CX.set(0);
				break;
			default:
				jemul8.problem("Execute (MOVS) :: Only REP/REPE prefix is valid.");
			}
		// Move with Sign Extend
		}, "MOVSX": function ( cpu ) {
			this.operand1.write(this.operand2.signExtend() & this.operand1.mask);
		// Move with Zero Extend
		}, "MOVZX": function ( cpu ) {
			this.operand1.write(this.operand2.read() & this.operand1.mask);
		// UNsigned Multiply
		}, "MUL": function ( cpu ) {
			var sizeOperand = this.operand2.size
			// NB: Default is to interpret as UNsigned
				, multiplicand = this.operand1.read()
				, multiplier = this.operand2.read()
				, res;
			
			// Integer result - no truncation
			//  as integer inputs guarantee integer result
			res = (multiplicand * multiplier) & this.operand1.mask;
			
			if ( sizeOperand == 1 ) {
				cpu.AX.set(res);
			
			} else if ( sizeOperand == 2 ) {
				cpu.DX.set(res >> 16); // Result written to DX:AX
				cpu.AX.set(res & 0xFFFF);
			
			} else if ( sizeOperand == 4 ) {//debugger;
				//jemul8.problem("Cannot support 64-bit multiply.");
				//return;
				multiplicand = jemul8.Int64.fromNumber(multiplicand/*cpu.EAX.get()*/);
				multiplier = jemul8.Int64.fromNumber(multiplier);
				res = multiplicand.multiply(multiplier);
				cpu.EAX.set(res.getLowBits());
				cpu.EDX.set(res.getHighBits());
				jemul8.warning("MUL insn :: setFlags needs to support Int64s");
			}
			
			this.setFlags(multiplicand, multiplier, res);
		// Two's Complement negation
		}, "NEG": function ( cpu ) {
			// Note use of negation operator "-"
			this.operand1.write(-this.operand2.signExtend());
		// Do nothing. Occupies both time & space
		}, "NOP": function ( cpu ) {
			// ...
		// One's Complement negation ( Logical NOT )
		}, "NOT": function ( cpu ) {
			// TEMP: There is a NOT in the extensions table
			//	that has no operands... ???? :S ???? AX??
			if ( !this.operand1 ) { debugger; }
			
			// Note use of bitwise inversion operator "~"
			this.operand1.write(~this.operand1.read());
			
			// TODO: setFlags() ... ??
		// Logical OR
		}, "OR": function ( cpu ) {
			var val1 = this.operand1.read()
				, val2 = this.operand2.signExtend()
				, res = val1 | val2;
			
			this.operand1.write(res);
			
			this.setFlags(val1, val2, res);
		// Output to Port
		}, "OUT": function ( cpu ) {
			cpu.machine.io.write(
				this.operand1.read()	// Port
				, this.operand2.read()	// Value
				, this.operand2.size	// IO length
			);
		// Output String to Port
		}, "OUTS": function ( cpu ) {
			debugger;
			
			jemul8.problem("Execute (OUTS) :: Not implemented yet");
		// Pop a value from the Stack (SS:SP)
		}, "POP": function ( cpu ) {
			this.operand1.write(cpu.popStack(this.operand1.size));
		// Pop all General Registers
		}, "POPA": function ( cpu ) {
			// POPA
			if ( !this.operandSizeAttr ) {
				cpu.DI.set(cpu.popStack(2));
				cpu.SI.set(cpu.popStack(2));
				cpu.BP.set(cpu.popStack(2));
				cpu.popStack(2);		// Skip SP
				cpu.BX.set(cpu.popStack(2));
				cpu.DX.set(cpu.popStack(2));
				cpu.CX.set(cpu.popStack(2));
				cpu.AX.set(cpu.popStack(2));
			// POPAD
			} else {debugger;
				cpu.EDI.set(cpu.popStack(4));
				cpu.ESI.set(cpu.popStack(4));
				cpu.EBP.set(cpu.popStack(4));
				cpu.popStack(4);		// Skip ESP
				cpu.EBX.set(cpu.popStack(4));
				cpu.EDX.set(cpu.popStack(4));
				cpu.ECX.set(cpu.popStack(4));
				cpu.EAX.set(cpu.popStack(4));
			}
		// Pop Stack into FLAGS / EFLAGS Register
		}, "POPF": function ( cpu ) {
			// NB: bits 16 and 17 ( VM & RF ) should not be affected by this
			//	(TODO: mask... ^!)
			//debugger;
			
			// POPF
			if ( !this.operandSizeAttr ) {
				cpu.FLAGS.set(cpu.popStack(2));
			// POPFD
			} else {debugger;
				cpu.EFLAGS.set(cpu.popStack(4));
			}
		// Push data onto stack top ( SS:SP )
		}, "PUSH": function ( cpu ) {
			cpu.pushStack(this.operand1.read(), this.operand1.size);
		// Push all General Registers
		}, "PUSHA": function ( cpu ) {
			var ptrStack;
			
			// PUSHA
			if ( !this.operandSizeAttr ) {
				// Remember to save Stack Pointer, push()es will modify it
				ptrStack = cpu.SP.get();
				cpu.pushStack(cpu.AX.get(), 2);
				cpu.pushStack(cpu.CX.get(), 2);
				cpu.pushStack(cpu.DX.get(), 2);
				cpu.pushStack(cpu.BX.get(), 2);
				cpu.pushStack(ptrStack, 2);
				cpu.pushStack(cpu.BP.get(), 2);
				cpu.pushStack(cpu.SI.get(), 2);
				cpu.pushStack(cpu.DI.get(), 2);
			// PUSHAD
			} else {debugger;
				// Remember to save Stack Pointer, push()es will modify it
				ptrStack = cpu.ESP.get();
				cpu.pushStack(cpu.EAX.get(), 4);
				cpu.pushStack(cpu.ECX.get(), 4);
				cpu.pushStack(cpu.EDX.get(), 4);
				cpu.pushStack(cpu.EBX.get(), 4);
				cpu.pushStack(ptrStack, 4);
				cpu.pushStack(cpu.EBP.get(), 4);
				cpu.pushStack(cpu.ESI.get(), 4);
				cpu.pushStack(cpu.EDI.get(), 4);
			}
		// Push Flags Register onto Stack
		}, "PUSHF": function ( cpu ) {
			//debugger;
			
			// PUSHF
			if ( !this.operandSizeAttr ) {
				cpu.pushStack(cpu.FLAGS.get(), 2);
			// PUSHFD
			} else {debugger;
				cpu.pushStack(cpu.EFLAGS.get(), 4);
			}
		// Rotate Bits Left
		}, "ROL": function ( cpu ) {//debugger;
			// Fast left-rotation using masks instead of a loop
			var bits = this.operand1.read();
			var numBitsIn = this.operand1.size * 8;
			// Modulo, because shifting by bit-length of operand ( eg. 16/32 ) is same as shifting by zero
			var numBitsShift = this.operand2.read() % numBitsIn;
			var numBitsRemaining = numBitsIn - numBitsShift;
			var bitsRemaining = (bits & ((1 << numBitsRemaining) - 1)) << numBitsShift;
			var bitsShiftedOut = bits >> numBitsRemaining;
			
			this.operand1.write(bitsRemaining | bitsShiftedOut);
			// Carry Flag is set to LSB of bits shifted out (if this had been a loop,
			//	the last bit shifted off the left and onto the right would be this one)
			cpu.CF.setBin(bitsShiftedOut & 0x01);
		// Rotate Bits Right
		}, "ROR": function ( cpu ) {//debugger;
			// Fast right-rotation using masks instead of a loop
			var bits = this.operand1.read();
			var numBitsIn = this.operand1.size * 8;
			// Modulo, because shifting by bit-length of operand ( eg. 16/32 ) is same as shifting by zero
			//	( NB: was changed to & as 011111b is 31, bitwise-AND should be faster/cheaper than modulo ( in Chrome ),
			//		however after testing modulo % is actually faster ( in TM ) )
			var numBitsShift = this.operand2.read() % numBitsIn;
			var numBitsRemaining = numBitsIn - numBitsShift;
			var bitsRemaining = bits >> numBitsShift;
			var bitsShiftedOut = (bits & ((1 << numBitsShift) - 1)) << numBitsRemaining;
			
			this.operand1.write(bitsRemaining | bitsShiftedOut);
			// Carry Flag is set to MSB of bits shifted out ( if this had been a loop,
			//	the last bit shifted off the right and onto the left would be this one )
			cpu.CF.setBin(bitsShiftedOut & (1 << numBitsShift));
		// Rotate Bits Left with Carry Flag
		}, "RCL": function ( cpu ) {
			jemul8.problem("Execute (RCL) :: unsupported");
		// Rotate Bits Right with Carry Flag
		}, "RCR": function ( cpu ) {
			jemul8.problem("Execute (RCR) :: unsupported");
		// Return ( Near ) from Procedure
		}, "RETN": function ( cpu ) {
			if ( !this.operandSizeAttr ) {
				// ( NB: Will clear high word of EIP )
				cpu.EIP.set(cpu.popStack(2));
			} else {debugger;
				cpu.EIP.set(cpu.popStack(4));
			}
			
			//if ( cpu.IP.get() === 0xFFF6 ) { debugger; }
		// Return ( Far ) from Procedure
		}, "RETF": function ( cpu ) {
			// Needs testing!!!!!!!!!
			//debugger;
			
			//var sizeOperand = this.sizeOperand;
			//var PE = cpu.PE.get();
			//var VM = cpu.VM.get();
			
			// Real or Virtual-8086 mode ( PE is the Protection Enable bit in CR0, VM is the EFLAGS's Virtual-8086 enable flag )
			//if ( !PE || (PE && VM) ) {
				// 16-bit
				if ( !this.operandSizeAttr ) {
					// (NB: Will clear high word of EIP)
					cpu.EIP.set(cpu.popStack(2));
					// Pop CS
					cpu.CS.set(cpu.popStack(2));
				// 32-bit
				} else {debugger;
					// Pop only IP ( save another get by just masking out high word )
					//	( NB: Will clear high word of EIP )
					cpu.EIP.set(cpu.popStack(4));
					// Pop CS ( 32-bit pop, high-order 16 bits discarded )
					cpu.CS.set(cpu.popStack(4));
				}
			//}
		// Return (Near) from Procedure and pop imm16 bytes of parameters
		}, "RETN_P": function ( cpu ) {debugger;
			if ( !this.operandSizeAttr ) {
				// Will clear high word of EIP
				cpu.EIP.set(cpu.popStack(2));
			} else {
				cpu.EIP.set(cpu.popStack(4));
			}
			// Pop (& discard) imm16 bytes of parameters
			cpu.ESP.set(cpu.ESP.get() + this.operand1.read());
		// Return ( Far ) from Procedure and pop imm16 bytes of parameters
		}, "RETF_P": function ( cpu ) {
			// Needs testing!!!!!!!!!
			debugger;
			
			var sizeOperand = this.operand1.size;
			var PE = cpu.PE.get();
			var VM = cpu.VM.get();
			
			// Real or Virtual-8086 mode ( PE is the Protection Enable bit in CR0, VM is the EFLAGS's Virtual-8086 enable flag )
			//if ( !PE || (PE && VM) ) {
				// 16-bit
				if ( !this.operandSizeAttr ) {
					// Pop only IP ( save another get by just masking out high word )
					//	( NB: Will clear high word of EIP )
					cpu.EIP.set(cpu.popStack(2));
					// Pop CS
					cpu.CS.set(cpu.popStack(2));
				// 32-bit
				} else {
					// Pop only IP ( save another get by just masking out high word )
					//	( NB: Will clear high word of EIP )
					cpu.EIP.set(cpu.popStack(4));
					// Pop CS ( 32-bit pop, high-order 16 bits discarded )
					cpu.CS.set(cpu.popStack(4));
				}
			//}
			// Pop imm16 bytes of parameters
			// ????!??!? WHAT this looks wrong.....
			cpu.ESP.set(cpu.ESP.get() + this.operand1.read());
		// Store AH into Flags
		}, "SAHF": function ( cpu ) {
			// Mask out current values of Flags and replace with contents of AH
			cpu.FLAGS.set((cpu.FLAGS.get() & 0xFF00) | cpu.AH.get());
		// Shift Left / Shift Arithmetic Left
		}, "SHL": function ( cpu ) {
			var bits = this.operand1.read();
			var numBitsIn = this.operand1.size * 8;
			// Modulo, because shifting by bit-length of operand ( eg. 16/32 ) is same as shifting by zero
			var numBitsToShift = this.operand2.read() % numBitsIn;
			var bitHigh;
			//debugger;
			this.operand1.write((bits << numBitsToShift) & this.operand1.mask);
			bitHigh = bits & (1 << (numBitsIn - 1));
			// High order-bit written to Carry Flag
			cpu.CF.setBin(bitHigh);
			// Overflow Flag defined only if single-shift
			if ( numBitsToShift == 1 ) {
				// OF set if high bit of answer is same as result of Carry Flag
				cpu.OF.setBin(bitHigh != (bits & (1 << (numBitsIn - 2))) ? 1 : 0);
			}
		// Shift Right ( with UNsigned divide )
		}, "SHR": function ( cpu ) {
			var bits = this.operand1.read();
			var numBitsIn = this.operand1.size * 8;
			// Modulo, because shifting by bit-length of operand ( eg. 16/32 ) is same as shifting by zero
			var numBitsToShift = this.operand2.read() % numBitsIn;
			
			// Use JS operator for right-shift with zero extend ( shift on zeroes instead of sign bits )
			this.operand1.write((bits >> numBitsToShift) & this.operand1.mask);
			// Low order-bit written to Carry Flag
			cpu.CF.setBin(bits & 0x01);
			// Overflow Flag defined only if single-shift
			if ( numBitsToShift == 1 ) {
				// OF set to high-order bit of original operand
				cpu.OF.setBin(bits & (1 << (numBitsIn - 1)));
			}
		// Shift Arithmetic Right ( with signed divide )
		}, "SAR": function ( cpu ) {
			var bits = this.operand1.read();
			var numBitsIn = this.operand1.size * 8;
			// Modulo, because shifting by bit-length of operand ( eg. 16/32 ) is same as shifting by zero
			var numBitsToShift = this.operand2.read() % numBitsIn;
			
			// Use JS operator for right-shift with sign extend ( shift on sign bits instead of zeroes )
			this.operand1.write(bits >>> numBitsToShift);
			// Low order-bit written to Carry Flag
			cpu.CF.setBin(bits & 0x01);
			// Overflow Flag defined only if single-shift
			if ( numBitsToShift == 1 ) {
				// OF always zero/cleared
				cpu.OF.clear();
			}
		// Integer Subtraction with Borrow
		}, "SBB": function ( cpu ) {
			//debugger;
			
			// NB: Addition and subtraction handle two's complement the same way
			//	for both unsigned and signed interpretations of numbers
			var val1 = this.operand1.read()
				, val2 = this.operand2.signExtend()
				, res = (val1 - (val2 + cpu.CF.get())) & this.operand1.mask;
			
			this.operand1.write(res);
			
			this.setFlags(val1, val2, res);
		// Integer Subtraction
		}, "SUB": function ( cpu ) {
			// NB: Addition and subtraction handle two's complement the same way
			//	for both unsigned and signed interpretations of numbers
			var val1 = this.operand1.read()
				, val2 = this.operand2.signExtend()
				, res = (val1 - val2) & this.operand1.mask;
			
			this.operand1.write(res);
			
			this.setFlags(val1, val2, res);
		// Scan/Compare String Data (Byte, Word or Dword)
		//	TODO: could be polymorphic, one func for each string-repeat type
		//	TODO: there is potential for speed ups here by using native .indexOf() / .slice() and similar
		//		array methods, instead of a possibly slow loop over each individual byte
		}, "SCAS": function ( cpu ) {
			var sizeOperand = this.operand1.size;
			// This is the difference between SCAS and CMPS: here,
			//	the value in AL/(E)AX is compared with the chars in string,
			//	so only needs to be read once
			var val1 = this.operand1.read(), val2
				, res
				, cx, edi, ediStart, ediEnd
				, len;
			
			switch ( this.repeat ) {
			// Common case; no repeat prefix
			case "":
				val2 = this.operand2.read();
				res = (val1 - val2) & this.operand1.mask;
				
				// Direction Flag set, decrement (scan in reverse direction)
				if ( cpu.DF.get() ) {
					cpu.EDI.set(cpu.EDI.get() - sizeOperand);
				// Direction Flag clear, increment (scan in forward direction)
				} else {
					cpu.EDI.set(cpu.EDI.get() + sizeOperand);
				}
				// Do not store result of sub/compare; only flags
				this.setFlags(val1, val2, res);
				break;
			// Repeat while Equal, max CX times
			case "#REP/REPE":
				cx = cpu.CX.get();
				len = cx * sizeOperand;
				edi = ediStart = cpu.EDI.get();
				// Direction Flag set, decrement (scan in reverse direction)
				if ( cpu.DF.get() ) {
					ediEnd = edi - len;
					for ( ; edi >= ediEnd ; edi -= sizeOperand ) {
						cpu.EDI.set(edi);
						val2 = this.operand2.read();
						res = (val1 - val2) & this.operand1.mask;
						// Do not store result of subtraction; only flags
						this.setFlags(val1, val2, res);
						// NB: This test cannot be in the for(...) condition
						if ( !cpu.ZF.get() ) { break; }
					}
					cpu.CX.set(cx - (ediStart - edi) / sizeOperand + 1);
				// Direction Flag clear, increment (scan in forward direction)
				} else {
					ediEnd = edi + len;
					for ( ; edi < ediEnd ; edi += sizeOperand ) {
						cpu.EDI.set(edi);
						val2 = this.operand2.read();
						res = (val1 - val2) & this.operand1.mask;
						// Do not store result of subtraction; only flags
						this.setFlags(val1, val2, res);
						// NB: This test cannot be in the for(...) condition
						if ( !cpu.ZF.get() ) { break; }
					}
					cpu.CX.set(cx - (edi - ediStart) / sizeOperand - 1);
				}
				cpu.EDI.set(edi);
				break;
			// Repeat while Not Equal, max CX times
			case "#REPNE":
				cx = cpu.CX.get();
				len = cx * sizeOperand;
				edi = ediStart = cpu.EDI.get();
				// Direction Flag set, decrement (scan in reverse direction)
				if ( cpu.DF.get() ) {
					ediEnd = edi - len;
					for (; edi > ediEnd ; edi -= sizeOperand ) {
						cpu.EDI.set(edi);
						val2 = this.operand2.read();
						
						// NB: This test cannot be in the for(...) condition
						if ( val2 === val1 ) { break; }
						
						/*res = (val1 - val2) & this.mask_sizeOperand;
						// Do not store result of subtraction; only flags
						this.setFlags(val1, val2, res);
						// NB: This test cannot be in the for(...) condition
						if ( cpu.ZF.get() ) { break; }*/
					}
					cpu.CX.set(cx - (ediStart - edi) / sizeOperand + 1);
				// Direction Flag clear, increment (scan in forward direction)
				} else {
					ediEnd = edi + len;
					for (; edi < ediEnd ; edi += sizeOperand ) {
						cpu.EDI.set(edi);
						val2 = this.operand2.read();
						
						// NB: This test cannot be in the for(...) condition
						if ( val2 === val1 ) { break; }
						
						/*res = (val1 - val2) & this.mask_sizeOperand;
						// Do not store result of subtraction; only flags
						this.setFlags(val1, val2, res);
						// NB: This test cannot be in the for(...) condition
						if ( cpu.ZF.get() ) { break; }*/
					}
					cpu.CX.set(cx - (edi - ediStart) / sizeOperand - 1);
				}
				// Store the last comparison subtraction for flags calc
				res = (val1 - val2) & this.operand1.mask;
				this.setFlags(val1, val2, res);
				
				cpu.EDI.set(edi);
				break;
			default:
				jemul8.problem("Execute (SCAS) :: invalid string repeat operation/prefix.");
			}
		/* ======= Conditional Byte Set Instructions ======= */
		/*
		 *	Many of these conditions may be interpreted in one of
		 *	several ways; the mnemonics used here are the first
		 *	in the list provided in the Intel Instruction Formats & Encodings,
		 *	Table B-8.
		 */
		// Set Byte if Overflow
		}, "SETO": function ( cpu ) {
			// Condition met
			if ( cpu.OF.get() ) {
				this.operand1.write(1);
			} else {
				this.operand1.write(0);
			}
		// Set Byte if NO Overflow
		}, "SETNO": function ( cpu ) {
			// Condition met
			if ( !cpu.OF.get() ) {
				this.operand1.write(1);
			} else {
				this.operand1.write(0);
			}
		// Set Byte if Below
		}, "SETB": function ( cpu ) {
			// Condition met
			if ( cpu.CF.get() ) {
				this.operand1.write(1);
			} else {
				this.operand1.write(0);
			}
		// Set Byte if NOT Below
		}, "SETNB": function ( cpu ) {
			// Condition met
			if ( !cpu.CF.get() ) {
				this.operand1.write(1);
			} else {
				this.operand1.write(0);
			}
		// Set Byte if Equal
		}, "SETE": function ( cpu ) {
			// Condition met
			if ( cpu.ZF.get() ) {
				this.operand1.write(1);
			} else {
				this.operand1.write(0);
			}
		// Set Byte if NOT Equal
		}, "SETNE": function ( cpu ) {
			// Condition met
			if ( !cpu.ZF.get() ) {
				this.operand1.write(1);
			} else {
				this.operand1.write(0);
			}
		// Set Byte if Below or Equal
		}, "SETBE": function ( cpu ) {
			// Condition met
			if ( cpu.CF.get() || cpu.ZF.get() ) {
				this.operand1.write(1);
			} else {
				this.operand1.write(0);
			}
		// Set Byte if NOT Below or Equal
		}, "SETNBE": function ( cpu ) {
			// Condition met
			if ( !cpu.CF.get() && !cpu.ZF.get() ) {
				this.operand1.write(1);
			} else {
				this.operand1.write(0);
			}
		// Set Byte if Sign
		}, "SETS": function ( cpu ) {
			// Condition met
			if ( cpu.SF.get() ) {
				this.operand1.write(1);
			} else {
				this.operand1.write(0);
			}
		// Set Byte if NOT Sign
		}, "SETNS": function ( cpu ) {
			// Condition met
			if ( !cpu.SF.get() ) {
				this.operand1.write(1);
			} else {
				this.operand1.write(0);
			}
		// Set Byte if Parity / Parity Even
		}, "SETP": function ( cpu ) {
			// Condition met
			if ( cpu.PF.get() ) {
				this.operand1.write(1);
			} else {
				this.operand1.write(0);
			}
		// Set Byte if NOT Parity / Parity Even
		}, "SETNP": function ( cpu ) {
			// Condition met
			if ( !cpu.PF.get() ) {
				this.operand1.write(1);
			} else {
				this.operand1.write(0);
			}
		// Set Byte if Less Than
		}, "SETL": function ( cpu ) {
			// Condition met
			if ( cpu.SF.get() !== cpu.OF.get() ) {
				this.operand1.write(1);
			} else {
				this.operand1.write(0);
			}
		// Set Byte if NOT Less Than
		}, "SETNL": function ( cpu ) {
			// Condition met
			if ( cpu.SF.get() === cpu.OF.get() ) {
				this.operand1.write(1);
			} else {
				this.operand1.write(0);
			}
		// Set Byte if Less Than or Equal
		}, "SETLE": function ( cpu ) {
			// Condition met
			if ( cpu.ZF.get() && (cpu.SF.get() !== cpu.OF.get()) ) {
				this.operand1.write(1);
			} else {
				this.operand1.write(0);
			}
		// Set Byte if NOT Less Than or Equal
		}, "SETNLE": function ( cpu ) {
			// Condition met
			if ( !cpu.ZF.get() && (cpu.SF.get() === cpu.OF.get()) ) {
				this.operand1.write(1);
			} else {
				this.operand1.write(0);
			}
		/* ======= /Conditional Byte Set Instructions ======= */
		// Store Global Descriptor Table Register
		}, "SGDT": function ( cpu ) {
			jemul8.problem("Execute (SGDT) :: unsupported");
		// Store Interrupt Descriptor Table Register
		}, "SIDT": function ( cpu ) {
			jemul8.problem("Execute (SIDT) :: unsupported");
		// Shift Left - Double Precision
		}, "SHLD": function ( cpu ) {
			jemul8.problem("Execute (SHLD) :: unsupported");
		// Shift Right - Double Precision
		}, "SHRD": function ( cpu ) {
			jemul8.problem("Execute (SHRD) :: unsupported");
		// Store Local Descriptor Table Register
		}, "SLDT": function ( cpu ) {
			jemul8.problem("Execute (SLDT) :: unsupported");
		// Store Machine Status Word
		}, "SMSW": function ( cpu ) {
			this.operand1.write(cpu.MSW.get());
		// Set Carry flag
		}, "STC": function ( cpu ) {
			cpu.CF.set();
		// Set Direction flag
		}, "STD": function ( cpu ) {
			cpu.DF.set();
		// Set Interrupt flag - enables recognition of all hardware interrupts
		}, "STI": function ( cpu ) {
			cpu.IF.set();
		// Store String Data ( Byte, Word or Dword )
		//	TODO: could be polymorphic, one func for each string-repeat type
		//	TODO: there is potential for speed ups here by using native .indexOf() / .slice() and similar
		//		array methods, instead of a possibly slow loop over each individual byte
		//	- No flags affected
		}, "STOS": function ( cpu ) {
			var sizeOperand = this.operand1.size
				, val1, val2, res
				, edi, ediEnd
				, len;
			
			// Common case; no repeat prefix
			if ( !this.repeat ) {
				this.operand1.write(this.operand2.read());
				
				// Direction Flag set, decrement ( scan in reverse direction )
				if ( cpu.DF.get() ) {
					cpu.EDI.set(cpu.EDI.get() - sizeOperand);
				// Direction Flag clear, increment ( scan in forward direction )
				} else {
					cpu.EDI.set(cpu.EDI.get() + sizeOperand);
				}
				return;
			// Repeat CX times
			} else if ( this.repeat === "#REP/REPE" ) {
				len = cpu.CX.get() * sizeOperand;
				edi = cpu.EDI.get();
				// Direction Flag set, decrement (scan in reverse direction)
				if ( cpu.DF.get() ) {
					ediEnd = edi - len;
					for ( ; edi >= ediEnd ; edi -= sizeOperand ) {
						cpu.EDI.set(edi);
						this.operand1.write(this.operand2.read());
					}
				// Direction Flag clear, increment (scan in forward direction)
				} else {
					ediEnd = edi + len;
					for ( ; edi <= ediEnd ; edi += sizeOperand ) {
						cpu.EDI.set(edi);
						this.operand1.write(this.operand2.read());
					}
				}
				cpu.EDI.set(edi);
				cpu.CX.set(0);
				return;
			}
			
			// Otherwise must have been #REPE or #REPNE
			jemul8.problem("Instruction.execute() ::"
				+ " STOS - #REPE/#REPNE invalid");
		// Store Task Register
		}, "STR": function ( cpu ) {
			jemul8.problem("Execute (STR) :: unsupported");
		// Logical Compare
		}, "TEST": function ( cpu ) {
			var val1 = this.operand1.read()
				, val2 = this.operand2.read()
				, res = val1 & val2;
			
			// Do not store result of subtraction; only flags
			this.setFlags(val1, val2, res);
		// Verify a Segment for Reading
		}, "VERR": function ( cpu ) {
			jemul8.problem("Execute (VERR) :: unsupported");
		// Verify a Segment for Writing
		}, "VERW": function ( cpu ) {
			jemul8.problem("Execute (VERW) :: unsupported");
		// Wait until BUSY# Pin is Inactive (HIGH)
		}, "WAIT": function ( cpu ) {
			// Suspend execution of 80386 Instructions until BUSY# is inactive;
			//	driven by numeric processor extension 80287
			
			// We do not use a math coprocessor, so this can safely be ignored for now.
		// Exchange Register/Memory with Register
		}, "XCHG": function ( cpu ) {
			// If a memory operand is involved, BUS LOCK is asserted during exchange,
			//	regardless of LOCK# prefix or IOPL value ( so always atomic ).
			var temp = this.operand1.read();
			
			this.operand1.write(this.operand2.read());
			this.operand2.write(temp);
		// Table Look-up Translation
		// - See http://faydoc.tripod.com/cpu/xlat.htm
		}, "XLAT": function ( cpu ) {
			var RBX = this.addressSizeAttr ? cpu.EBX : cpu.BX;
			cpu.AL.set(this.reg_segment.readSegment(
				(RBX.get() + cpu.AL.get()) & (this.addressSizeAttr ? 0xFFFF : 0xFF)
				, 1 // Always 1 byte read
			));
		// Logical Exclusive OR
		}, "XOR": function ( cpu ) {
			var val1 = this.operand1.read();
			var val2 = this.operand2.signExtend();
			var res = (val1 ^ val2) & this.operand1.mask;
			
			this.operand1.write(res);
			
			this.setFlags(val1, val2, res);
		}
	};
	
	// Whether the specified InstructionPointer is within the bounds of the current Code Segment
	Instruction.prototype.inCodeSegmentLimits = function ( eip ) {
		// TODO...
		return true;
	};
	// Return Stack space available ( in bytes )
	Instruction.prototype.getStackSpace = function () {
		// This will do for now...
		return 16;
	};
	
	/* ====== Private ====== */
	// To throw a cpu exception / fault ( eg. General Protection )
	function CPUException( type, code ) {
		jemul8.debug("cpu exception: " + type + ", " + code);
	}
	
	// For the conditional (Jxx) instructions
	function jumpShortOrNear( insn ) {
		var op1 = insn.operand1
			, cpu = insn.machine.cpu
			, val;
		
		// 1-byte operand; jump "short",
		if ( insn.operand1.size === 1 ) {
			// Sign-extend the 1-byte jump distance, so that
			//	it will wrap if negative
			val = op1.signExtend(2);
			// Address is relative to EIP if not a pointer,
			//	otherwise it is "absolute indirect" (a non-relative
			//	address to jump to that is stored in memory)
			if ( !op1.isPointer ) {
				val += cpu.IP.get();
			}
		// 2/4-byte operand; jump "near"
		} else/* if ( insn.sizeOperand >= 2 )*/ {
			// 2-byte: No point/need for sign-extension, as IP & operand
			//	are both 2-bytes wide.
			// 4-byte: Definitely no sign-extension...
			val = op1.read();
			// Address is relative to EIP if not a pointer,
			//	otherwise it is "absolute indirect" (a non-relative
			//	address to jump to that is stored in memory)
			if ( !op1.isPointer ) {
				val += cpu.EIP.get();
			}
		}
		
		// Wrap 16-bit addresses
		if ( !insn.operandSizeAttr ) {
			cpu.EIP.set(val & 0x0000FFFF); // Zero-out high word of EIP
		} else { // 32-bit wrapped in .set()
			cpu.EIP.set(val);
		}
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
		var cpu = this.machine.cpu;
		
		cpu.valLast1 = val1;
		cpu.valLast2 = val2;
		cpu.resLast = res;
		cpu.insnLast = this;
		//cpu.name_insnLast = this.name;
		cpu.EFLAGS.bitsDirty = 0xFFFFFFFF;
	};
	// Operand 1 and result only
	Instruction.prototype.setFlags_Op1 = function ( val1, res ) {
		var cpu = this.machine.cpu;
		
		cpu.valLast1 = val1;
		cpu.resLast = res;
		cpu.insnLast = this;
		//cpu.name_insnLast = this.name;
		cpu.EFLAGS.bitsDirty = 0xFFFFFFFF;
	};
	// Operand 2 and result only
	Instruction.prototype.setFlags_Op2 = function ( val2, res ) {
		var cpu = this.machine.cpu;
		
		cpu.valLast2 = val2;
		cpu.resLast = res;
		cpu.insnLast = this;
		//cpu.name_insnLast = this.name;
		cpu.EFLAGS.bitsDirty = 0xFFFFFFFF;
	};
	// Result only
	Instruction.prototype.setFlags_Result = function ( res ) {
		var cpu = this.machine.cpu;
		
		cpu.resLast = res;
		cpu.insnLast = this;
		//cpu.name_insnLast = this.name;
		cpu.EFLAGS.bitsDirty = 0xFFFFFFFF;
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
	
	// Exports
	jemul8.Instruction = Instruction;
});
