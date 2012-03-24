/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *	
 *	MODULE: CPU Instruction execute methods
 */

define([
	"../../util"
	, "../math/int64"
	, "../memory/buffer"
], function ( util, Int64, Buffer ) { "use strict";
	
	// Execute static class constructor
	function Execute() {
		util.panic("Execute() is static-only!");
	}
	Execute.functions = {
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
			
			setFlags_Op1(this, cpu, val1, res);
		// ASCII adjust after Multiplication
		}, "AAM": function ( cpu ) {
			// Val1 will almost always be 0Ah ( 10d ), meaning to adjust for base-10 / decimal.
			var val1 = this.operand1.read()
				, AL = cpu.AL.get()
				, res = cpu.AH.get() * val1 + AL;
			
			cpu.AH.set((AL / 10) >> 0);
			cpu.AL.set(AL % 10);
			setFlags_Op1(this, cpu, val1, res);
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
			
			setFlags(this, cpu, val1, val2, res);
		// Arithmetic Addition
		}, "ADD": function ( cpu ) {
			var val1 = this.operand1.read()
				, val2 = this.operand2.signExtend()
			// Mask, because add operation can generate too-large numbers
				, res = (val1 + val2) & this.operand1.mask;
			
			this.operand1.write(res);
			
			setFlags(this, cpu, val1, val2, res);
		// Logical AND
		}, "AND": function ( cpu ) {
			var val1 = this.operand1.read()
				, val2 = this.operand2.signExtend()
				, res = val1 & val2;
			
			this.operand1.write(res);
			
			setFlags(this, cpu, val1, val2, res);
		// Adjusted Requested Privilege Level of Selector ( 286+ Protected Mode )
		}, "ARPL": function ( cpu ) {
			util.panic("Execute (ARPL) :: No Protected Mode support yet.");
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
			util.panic("Execute (BOUND) :: No Array bounds support yet.");
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
				jemul8.panic("CALLF_AI :: 48-bit handling needed");
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
		// Convert Byte to Word (CBW) - uses AX
		//  or Convert Word to Extended Dword (CWDE)
		//  - uses EAX (not AX:DX as in CWD/CDQ)
		}, "CBW": function ( cpu ) {
			var AX;
			
			// CBW: Sign-extend AL into AH
			if ( !this.operandSizeAttr ) {
				cpu.AH.set((cpu.AL.get() >> 7) ? 0xFF : 0x00);
			// CWDE: Sign-extend AX into high word of EAX
			} else {
				AX = cpu.AX.get();
				cpu.EAX.set(((AX >> 15) ? 0xFFFF0000 : 0x00) | AX);
			}
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
			setFlags(this, cpu, val1, val2, res);
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
				setFlags(this, cpu, val1, val2, res);
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
				setFlags(this, cpu, val1, val2, (val1 - val2) & this.operand1.mask);
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
				setFlags(this, cpu, val1, val2, (val1 - val2)
					& this.operand1.mask);
				cpu.CX.set(len);
				break;
			default:
				util.problem("Execute (CMPS) :: invalid string repeat operation/prefix.");
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
			setFlags(this, cpu, val_acc, val1, res);
		// Compare and Exchange 8 bytes (Pentium+)
		}, "CMPXCHG8": function ( cpu ) {
			var val1 = this.operand1.read();
			var val2 = (cpu.EDX.get() << 32) | cpu.EAX.get();
			var res = (val1 - val2) & this.operand1.mask;
			
			debugger;
			jemul8.panic("CMPXCHG8 - Needs testing");
			
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
			setFlags(this, cpu, val1, val2, res);
		// Convert Word to Dword (CWD), or Dword to Quadword (CDQ)
		}, "CWD": function ( cpu ) {
			// Sign-extend AX into DX:AX
			if ( !this.operandSizeAttr ) {
				cpu.DX.set((cpu.AX.get() >> 15) ? 0xFFFF : 0x0000);
			// Sign-extend EAX into EDX
			} else {
				cpu.EDX.set(((cpu.EAX.get() >> 31) ? 0xFFFFFFFF : 0x00000000));
			}
		// Decimal Adjust after Addition
		}, "DAA": function ( cpu ) {
			util.panic("Execute (DAA) :: unsupported");
		// Decimal Adjust for Subtraction
		}, "DAS": function ( cpu ) {
			debugger;
			util.panic("Execute (DAS) :: unsupported");
		// Decrement
		}, "DEC": function ( cpu ) {
			// NB: Addition and subtraction handle two's complement the same way
			//	for both unsigned and signed interpretations of numbers
			var val = (this.operand1.read() - 1) & this.operand1.mask;
			
			this.operand1.write(val);
			
			// Preserve state of Carry flag
			var cf = cpu.CF.get();
			setFlags_Result(this, cpu, val);
			cpu.CF.setBin(cf);
		// Unsigned Divide
		// - See http://faydoc.tripod.com/cpu/div.htm
		}, "DIV": function ( cpu ) {
			var sizeOperand = this.operand2.size
				, dividend
				, divisor = this.operand2.read()
				, res;
			
			// Divide by Zero - cpu Interrupt
			// FIXME: throw exception #DE (Divide Error)
			if ( /*dividend == 0 || */divisor == 0 ) { cpu.interrupt(0); return; }
			
			// Dividend is AX
			if ( sizeOperand == 1 ) {
				dividend = cpu.AX.get();
				// Truncate unsigned integer result (">>> 0") toward zero
				res = (dividend / divisor) >>> 0;
				cpu.AL.set(res); // Quotient
				cpu.AH.set(dividend % divisor); // Remainder
			// Dividend is DX:AX
			} else if ( sizeOperand == 2 ) {
				dividend = (cpu.DX.get() << 16) | cpu.AX.get();
				// Truncate unsigned integer result (">>> 0") toward zero
				res = (dividend / divisor) >>> 0;
				cpu.AX.set(res); // Quotient
				cpu.DX.set(dividend % divisor); // Remainder
			// Dividend is EDX:EAX
			} else if ( sizeOperand == 4 ) {
				dividend = Int64.fromBits(cpu.EAX.get(), cpu.EDX.get());
				divisor = Int64.fromNumber(divisor);
				res = dividend.div(divisor);
				cpu.EAX.set(res.getLowBits());
				cpu.EDX.set(dividend.modulo(divisor).getLowBits());
				util.warning("DIV insn :: setFlags needs to support Int64s");
			}
		// Make Stack Frame (80188+)
		}, "ENTER": function ( cpu ) {
			var operandSizeAttr = this.operandSizeAttr
				, operandSize = operandSizeAttr ? 4 : 2
				, stackSizeAttr = cpu.SS.cache.default32BitSize
				, BP = (stackSizeAttr ? cpu.EBP : cpu.BP)
				, SP = (stackSizeAttr ? cpu.ESP : cpu.SP)
				, stackSize = SP.size;
			var imm16 = this.operand1.read();
			var level = this.operand2.read();
			level &= 0x1F; // Between 0 and 31
			
			cpu.pushStack(BP.get(), stackSize);
			var frame_ptr = SP.get();
			
			if ( stackSizeAttr ) {
				var ebp = BP.get(); // Use temp copy for case of exception.
				
				if ( level > 0 ) {
					// Do level-1 times
					while ( --level ) {
						ebp -= 2;
						var temp = cpu.SS.readSegment(cpu.EBP.get(), operandSize);
						cpu.pushStack(temp, operandSize);
					}
					
					// Push frame pointer
					cpu.pushStack(frame_ptr, operandSize);
				}
				
				cpu.ESP.set(cpu.ESP.get() - imm16);
				
				// ENTER finishes with memory write check on the final stack pointer
				// the memory is touched but no write actually occurs
				// emulate it by doing RMW read access from SS:ESP
				//read_RMW_virtual_word(BX_SEG_REG_SS, ESP);
				cpu.SS.readSegment(cpu.ESP.get(), operandSize);
			} else {
				var bp = BP.get();
				
				if ( level > 0 ) {
					// Do level-1 times
					while ( --level ) {
						bp -= 2;
						var temp = cpu.SS.readSegment(cpu.BP.get(), operandSize);
						cpu.pushStack(temp, operandSize);
					}
					
					// Push frame pointer
					cpu.pushStack(frame_ptr, operandSize);
				}
				
				cpu.SP.set(cpu.SP.get() - imm16);
				
				// ENTER finishes with memory write check on the final stack pointer
				// the memory is touched but no write actually occurs
				// emulate it by doing RMW read access from SS:SP
				//read_RMW_virtual_word_32(BX_SEG_REG_SS, SP);
				cpu.SS.readSegment(cpu.SP.get(), operandSize);
			}
			
			BP.set(frame_ptr);
		// Escape
		}, "ESC": function ( cpu ) {
			util.panic("Execute (ESC) :: unsupported");
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
			var sizeOperand = this.operand1.size
				, dividend
				, divisor = this.operand1.read()
				, res;
			
			// Divide by Zero - cpu Interrupt
			// FIXME: throw exception #DE (Divide Error)
			if ( /*dividend == 0 || */divisor == 0 ) { cpu.interrupt(0); return; }
			
			// Dividend is AX
			if ( sizeOperand == 1 ) {
				// ">> 0" to interpret as signed
				dividend = cpu.AX.get() >> 0;
				// Integer result - truncated toward zero
				res = (dividend / divisor) >> 0;
				cpu.AL.set(res); // Quotient
				cpu.AH.set(dividend % divisor); // Remainder
			// Dividend is DX:AX
			} else if ( sizeOperand == 2 ) {
				// ">> 0" to interpret as signed
				dividend = ((cpu.DX.get() << 16) | cpu.AX.get()) >> 0;
				// Integer result - truncated toward zero
				res = (dividend / divisor) >> 0;
				cpu.AX.set(res); // Quotient
				cpu.DX.set(dividend % divisor); // Remainder
			// Dividend is EDX:EAX
			} else if ( sizeOperand == 4 ) {
				debugger;
				jemul8.warning("IDIV :: 64-bit SIGNED divide needs testing");
				dividend = Int64.fromBits(cpu.EAX.get(), cpu.EDX.get());
				divisor = Int64.fromNumber(divisor);
				res = dividend.div(divisor);
				cpu.EAX.set(res.getLowBits());
				cpu.EDX.set(dividend.modulo(divisor).getLowBits());
			}
			
			return;
			
			// Unlike IMUL to MUL, IDIV is identical to DIV (?)
			Execute.functions.DIV.call(this, cpu);
			return;
			
			debugger;
			util.panic("Needs to be as per IMUL below.");
			
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
			
			setFlags(this, cpu, dividend, divisor, res);
		// Signed Multiply
		// - See http://faydoc.tripod.com/cpu/imul.htm
		}, "IMUL": function ( cpu ) {
			var operandSize = this.operand1.size
				, multiplicand, multiplier
				, highBits, lowBits, res, isSignExtended;
			
			// IMUL r16, r/m16, imm16
			// IMUL r16, r/m16, imm8
			// IMUL r32, r/m32, imm32
			// IMUL r32, r/m32, imm8
			// IMUL r16, r/m16
			// IMUL r16, imm8
			// IMUL r32, r/m32
			// IMUL r32, imm8
			if ( this.operand3 || this.operand2 ) {
				if ( this.operand3 ) {
					multiplicand = this.operand2.signExtend();
					multiplier = this.operand3.signExtend();
				} else {
					multiplicand = this.operand1.read();
					multiplier = this.operand2.signExtend();
				}
				// 16-bit * 16-bit; product will fit in 32 bits
				if ( operandSize == 2 ) {
					res = multiplicand * multiplier;
					highBits = res >> 8;
					this.operand1.write(res);
				// 64-bit product
				} else {
					multiplicand = Int64.fromNumber(multiplicand);
					multiplier = Int64.fromNumber(multiplier);
					res = multiplicand.multiply(multiplier);
					highBits = res.getHighBits();
					lowBits = res.getLowBits();
					this.operand1.write(lowBits);
				}
			// 1-operand format is same as MUL instruction:
			// IMUL r/m8
			// IMUL r/m16
			// IMUL r/m32
			} else if ( this.operand1 ) {
				// Multiplicand is implicitly accumulator: see below
				multiplier = this.operand1.read();
				
				if ( operandSize == 1 ) {
					multiplicand = cpu.AL.get();
					res = multiplicand * multiplier;
					cpu.AX.set(res);
					highBits = res >> 8;
				} else if ( operandSize == 2 ) {
					multiplicand = cpu.AX.get();
					res = multiplicand * multiplier;
					cpu.DX.set(res >> 16); // Result written to DX:AX
					cpu.AX.set(res & 0xFFFF);
					highBits = res >> 16;
				} else if ( operandSize == 4 ) {
					multiplicand = Int64.fromNumber(cpu.EAX.get());
					multiplier = Int64.fromNumber(multiplier);
					res = multiplicand.multiply(multiplier);
					highBits = res.getHighBits();
					lowBits = res.getLowBits();
					cpu.EAX.set(lowBits);
					cpu.EDX.set(highBits);
				}
			} else {
				util.panic("IMUL :: Must have at least 1 operand");
			}
			
			// CF and OF set when significant bits are carried
			//  into upper half of result. Cleared when result
			//  fits exactly in the lower half
			if ( operandSize == 1 ) {
				isSignExtended = highBits && (res & 0x80);
			} else if ( operandSize == 2 ) {
				isSignExtended = highBits && (res & 0x8000);
			} else if ( operandSize == 4 ) {
				isSignExtended = highBits && (lowBits & 0x80000000);
				util.warning("IMUL :: setFlags needs to support Int64s");
			}
			
			if ( isSignExtended ) {
				cpu.OF.set(); cpu.CF.set();
			}
			
			setFlags(this, cpu, multiplicand, multiplier, res);
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
			
			// Preserve state of Carry flag
			var cf = cpu.CF.get();
			setFlags_Result(this, cpu, val);
			cpu.CF.setBin(cf);
		// Input String from Port ( 80188+ )
		}, "INS": function ( cpu ) {
			util.panic("Execute (INS) :: Not implemented yet");
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
		// Invalidate Cache (486+)
		}, "INVD": function ( cpu ) {
			util.warning("INVD :: Not fully implemented");
			
			// TODO: need a cpu.wipeCache() method?
			//       - also to be called in CS.set()
			cpu.cache_insn.length = 0;
		// Invalidate Translation Look-Aside Buffer Entry ( 486+ )
		}, "INVLPG": function ( cpu ) {
			util.panic("Execute (INVLPG) :: unsupported");
		// Perform a far return after Interrupt handling
		//	NB: not used by internal Hypervisor Interrupt Service Routines, for speed
		//	as (E)FLAGS register never needs to be restored after their exec ( it is unaffected )
		//	Based on http://pdos.csail.mit.edu/6.828/2005/readings/i386/IRET.htm
		}, "IRET": function ( cpu ) {
			cpu.interruptReturn(this.operandSizeAttr);
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
				jumpRelative(this, cpu);
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
				jumpRelative(this, cpu);
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
				jumpRelative(this, cpu);
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
				jumpRelative(this, cpu);
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
				jumpRelative(this, cpu);
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
				jumpRelative(this, cpu);
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
				jumpRelative(this, cpu);
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
				jumpRelative(this, cpu);
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
				jumpRelative(this, cpu);
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
				jumpRelative(this, cpu);
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
				jumpRelative(this, cpu);
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
				jumpRelative(this, cpu);
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
				jumpRelative(this, cpu);
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
				jumpRelative(this, cpu);
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
				jumpRelative(this, cpu);
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
				jumpRelative(this, cpu);
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
				jumpRelative(this, cpu);
			}
		/* ======= /Conditional Jump Instructions ======= */
		
		// Unconditional Far (32/48-bit) Jump
		//	- relative to next Instruction
		}, "JMPF": function ( cpu ) {
			// NB: Do not interpret as signed; cannot have
			//     an absolute EIP that is negative
			var cs_eip = this.operand1.read();
			
			// 32-bit pointer
			if ( !this.operandSizeAttr ) {
				cpu.CS.set(cs_eip >> 16);
				cpu.EIP.set(cs_eip & 0xFFFF);
			// 48-bit pointer (NOT 64-bit; even though EIP is 32-bit,
			//	CS is still 16-bit)
			} else {
				cpu.CS.set(cs_eip >> 32);
				cpu.EIP.set(cs_eip & 0xFFFFFFFF);
			}
		// Unconditional Near (16/32-bit) Jump
		//	- relative to next Instruction
		}, "JMPN": function ( cpu ) {
			var IP = this.operandSizeAttr ? cpu.EIP : cpu.IP
				, ip = this.operand1.read();
			
			// Relative jump - add to (E)IP
			if ( this.operand1.isRelativeJump ) {
				IP.set(IP.get() + ip);
			// Absolute jump - replace (E)IP
			} else {
				IP.set(ip);
			}
		// Unconditional Short (8-bit) Jump
		//	- relative to next Instruction, always relative
		}, "JMPS": function ( cpu ) {
			var IP = this.operandSizeAttr ? cpu.EIP : cpu.IP
				, ip = this.operand1.signExtend(this.operandSizeAttr ? 4 : 2);
			
			// Relative jump - add to (E)IP
			IP.set(IP.get() + ip);
		// Load Flags into AH Register
		}, "LAHF": function ( cpu ) {
			// Transfer only the low byte of Flags word to AH
			cpu.AH.set(cpu.FLAGS.get() & 0xFF);
		// Load Access Rights Byte
		}, "LAR": function ( cpu ) {
			util.panic("Execute (LAR) :: unsupported");
		// Load Effective Address
		}, "LEA": function ( cpu ) {
			// Just compute the Memory Address of the 2nd Operand
			//	and store it in the first
			this.operand1.write(
				this.operand2.getPointerAddress() & this.operand1.mask
			);
		// High Level Procedure Exit
		}, "LEAVE": function ( cpu ) {
			// NB: Reverses the actions of the ENTER instruction. 
			//	By copying the frame pointer to the stack pointer,
			//	LEAVE releases the stack space used by a procedure for its local variables.
			
			var operandSizeAttr = this.operandSizeAttr
				, operandSize = operandSizeAttr ? 4 : 2
				, stackSizeAttr = cpu.SS.cache.default32BitSize
				, BP = (stackSizeAttr ? cpu.EBP : cpu.BP)
				, SP = (stackSizeAttr ? cpu.ESP : cpu.SP)
				, stackSize = SP.size;
			var value;
			
			if ( stackSizeAttr ) {
				value = cpu.SS.readSegment(cpu.EBP.get(), operandSize);
				cpu.ESP.set(cpu.EBP.get() + operandSize);
			} else {
				value = cpu.SS.readSegment(cpu.BP.get(), operandSize);
				cpu.SP.set(cpu.BP.get() + operandSize);
			}
			
			(operandSizeAttr ? cpu.EBP : cpu.BP).set(value);
		// Load Global Descriptor Table Register
		}, "LGDT": function ( cpu ) {
			//util.panic("Execute (LGDT) :: unsupported");
			util.warning("LGDT :: Protected mode support incomplete");
			debugger;
			//cpu.GDTR.set(this.operand1.read());
			
			var base;
			// GDTR m16 & 32 - always 48-bit (6 bytes)
			cpu.GDTR.limit16 = this.operand1.read(0, 2); // Limit always 16-bit
			base = this.operand1.read(2, 4);             // Base 32- or 24-bit
			
			// 16-bit
			if ( !this.operandSizeAttr ) {
				base &= 0x00FFFFFF; // Only use 24-bits
			}
			// Base is 32-bit in 32-bit OpSize, 24-bit in 16-bit OpSize
			cpu.GDTR.base = base;
		// Load Interrupt Descriptor Table Register
		}, "LIDT": function ( cpu ) {
			//util.panic("Execute (LIDT) :: unsupported");
			util.warning("LIDT :: Protected mode support incomplete");
			debugger;
			cpu.IDTR.set(this.operand1.read());
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
				util.panic("LDS :: Not implemented");
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
				util.panic("LES :: Not implemented");
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
				util.panic("LFS :: Not implemented");
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
				util.panic("LGS :: Not implemented");
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
				util.panic("LSS :: Not implemented");
				// In Protected Mode, load the descriptor into the segment register
			}
		// Load Local Descriptor Table Register
		}, "LLDT": function ( cpu ) {
			util.panic("Execute (LLDT) :: unsupported");
		// Load Machine Status Word
		}, "LMSW": function ( cpu ) {
			util.panic("Execute (LMSW) :: unsupported");
			// cpu.CR0
		// Load String ( Byte, Word or Dword )
		//	TODO: could be polymorphic, one func for each string-repeat type
		//	TODO: there is potential for speed ups here by using native .indexOf() / .slice() and similar
		//		array methods, instead of a possibly slow loop over each individual byte
		}, "LODS": function ( cpu ) {
			var operandSize = this.operand1.size
				, CX = this.addressSizeAttr ? cpu.ECX : cpu.CX
				, SI = this.addressSizeAttr ? cpu.ESI : cpu.SI
				, val1, val2
				, esi, esiEnd, len;
			
			switch ( this.repeat ) {
			// Common case; no repeat prefix
			case "":
				// Load String Character ( Operand 1 is part of Accumulator, Operand 2
				//	will be a memory pointer using (E)SI )
				this.operand1.write(this.operand2.read());
				// Direction Flag set, decrement (scan in reverse direction)
				if ( cpu.DF.get() ) {
					SI.set(SI.get() - operandSize);
				// Direction Flag clear, increment (scan in forward direction)
				} else {
					SI.set(SI.get() + operandSize);
				}
				
				break;
			// Repeat CX times
			case "#REP/REPE":
				len = CX.get() * operandSize;
				esi = SI.get();
				// Direction Flag set, decrement (scan in reverse direction)
				if ( cpu.DF.get() ) {
					esiEnd = esi - len;
					for ( ; esi >= esiEnd ; esi -= operandSize ) {
						SI.set(esi);
						// Load String Character (Operand 1 is part
						//	of Accumulator, Operand 2
						//	will be a memory pointer using (E)SI)
						this.operand1.write(this.operand2.read());
					}
				// Direction Flag clear, increment (scan in forward direction)
				} else {
					esiEnd = esi + len;
					for ( ; esi < esiEnd ; esi += operandSize ) {
						SI.set(esi);
						// Load String Character (Operand 1 is part
						//	of Accumulator, Operand 2
						//	will be a memory pointer using (E)SI)
						this.operand1.write(this.operand2.read());
					}
				}
				SI.set(esi);
				CX.set(0);
				break;
			default:
				util.problem("Execute (LODS) ::"
					+ " invalid string repeat operation/prefix.");
			}
		// Loop Control with CX Counter
		}, "LOOP": function ( cpu ) {
			var regCount = this.addressSizeAttr ? cpu.ECX : cpu.CX;
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
			util.panic("Execute (LSL) :: unsupported");
		// Load Task Register
		}, "LTR": function ( cpu ) {
			util.panic("Execute (LTR) :: unsupported");
		// Move ( Copy ) data
		}, "MOV": function ( cpu ) {
			this.operand1.write(this.operand2.read());
		// Move Data from String to String ( Byte, Word or Dword )
		//	TODO: could be polymorphic, one func for each string-repeat type
		}, "MOVS": function ( cpu ) {
			var operandSize = this.operand1.size
				, CX = this.addressSizeAttr ? cpu.ECX : cpu.CX
				, SI = this.addressSizeAttr ? cpu.ESI : cpu.SI
				, DI = this.addressSizeAttr ? cpu.EDI : cpu.DI
				, val1, val2, res
				, esi, esiStart, esiEnd
				, edi, len, segreg1, segreg2;
			
			switch ( this.repeat ) {
			// Common case; no repeat prefix
			case "":
				// Load String Character (Operand 1 is part of Accumulator, Operand 2
				//	will be a memory pointer using (E)SI)
				this.operand2.write(this.operand1.read());
				// Direction Flag set, decrement (scan in reverse direction)
				if ( cpu.DF.get() ) {
					SI.set(SI.get() - operandSize);
					DI.set(DI.get() - operandSize);
				// Direction Flag clear, increment (scan in forward direction)
				} else {
					SI.set(SI.get() + operandSize);
					DI.set(DI.get() + operandSize);
				}
				break;
			// Repeat CX times
			case "#REP/REPE":
				len = CX.get() * operandSize;
				esi = SI.get();
				edi = DI.get();
				
				// Accelerated case: copy from buffer->buffer
				segreg1 = this.operand1.getSegReg();
				segreg2 = this.operand2.getSegReg();
				if ( segreg1.buf && segreg2.buf ) {
					// Direction Flag set, decrement (scan in reverse direction)
					if ( cpu.DF.get() ) {
						Buffer.copy(
							segreg1.buf
							, (segreg1.addrA20 + esi) - segreg1.addrStart_buf - len
							, segreg2.buf
							, (segreg2.addrA20 + edi) - segreg2.addrStart_buf - len
							, len
						);
						SI.set(esi - len);
						DI.set(edi - len);
					// Direction Flag clear, increment (scan in forward direction)
					} else {
						Buffer.copy(
							segreg1.buf
							, (segreg1.addrA20 + esi) - segreg1.addrStart_buf
							, segreg2.buf
							, (segreg2.addrA20 + edi) - segreg2.addrStart_buf
							, len
						);
						SI.set(esi + len);
						DI.set(edi + len);
					}
					CX.set(0);
					return;
				}
				
				// Direction Flag set, decrement (scan in reverse direction)
				if ( cpu.DF.get() ) {
					esiEnd = esi - len;
					for ( ; esi >= esiEnd
					; esi -= operandSize, edi -= operandSize ) {
						SI.set(esi);
						DI.set(edi);
						// Load String Character
						//	- Operand 1 is part of Accumulator
						//	- Operand 2 will be a memory pointer using (E)SI
						this.operand2.write(this.operand1.read());
					}
				// Direction Flag clear, increment (scan in forward direction)
				} else {
					esiEnd = esi + len;
					for ( ; esi < esiEnd
					; esi += operandSize, edi += operandSize ) {
						// Load String Character
						//	- Operand 1 is part of Accumulator
						//	- Operand 2 will be a memory pointer using (E)SI
						this.operand2.write(this.operand1.read());
						SI.set(esi);
						DI.set(edi);
					}
				}
				SI.set(esi);
				DI.set(edi);
				CX.set(0);
				break;
			default:
				util.problem("Execute (MOVS) :: Only REP/REPE prefix is valid.");
			}
		// Move with Sign Extend
		}, "MOVSX": function ( cpu ) {
			this.operand1.write(this.operand2.signExtend() & this.operand1.mask);
		// Move with Zero Extend
		}, "MOVZX": function ( cpu ) {
			this.operand1.write(this.operand2.read() & this.operand1.mask);
		// UNsigned Multiply
		}, "MUL": function ( cpu ) {
			var operandSize = this.operand2.size
				, multiplicand = this.operand1.read()
				, multiplier = this.operand2.read()
				, highBits
				, res;
			
			// Integer result - no truncation
			//  as integer inputs guarantee integer result
			res = (multiplicand * multiplier);
			
			if ( operandSize == 1 ) {
				cpu.AX.set(res);
				highBits = res >> 8;
			} else if ( operandSize == 2 ) {
				cpu.DX.set(res >> 16); // Result written to DX:AX
				cpu.AX.set(res & 0xFFFF);
				highBits = res >> 16;
			} else if ( operandSize == 4 ) {
				multiplicand = Int64.fromNumber(multiplicand);
				multiplier = Int64.fromNumber(multiplier);
				res = multiplicand.multiply(multiplier);
				highBits = res.getHighBits();
				cpu.EAX.set(res.getLowBits());
				cpu.EDX.set(highBits);
				util.warning("MUL insn :: setFlags needs to support Int64s");
			}
			
			setFlags(this, cpu, multiplicand, multiplier, res);
			
			// CF and OF cleared if high-order bits of product 0
			//  (this is the default behaviour - see lazy_flag.js);
			//  otherwise, flags are set
			if ( highBits ) { cpu.OF.set(); cpu.CF.set(); }
		// Two's Complement negation
		}, "NEG": function ( cpu ) {
			var val = this.operand1.read(), res;
			
			// NB: Use modulo arithmetic for two's complement,
			//     not negation operator ("-")
			switch ( this.operand1.size ) {
			case 1:
				res = ((~val) & 0xFF) + 1;
				break;
			case 2:
				res = ((~val) & 0xFFFF) + 1;
				break;
			case 4:
				res = ((~val) & 0xFFFFFFFF) + 1;
				break;
			}
			
			res &= this.operand1.mask;
			
			this.operand1.write(res);
			
			setFlags_Op1(this, cpu, val, res);
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
			
			setFlags(this, cpu, val1, val2, res);
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
			
			util.panic("Execute (OUTS) :: Not implemented yet");
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
			debugger;
			util.panic("Execute (RCL) :: unsupported");
		// Rotate Bits Right with Carry Flag
		}, "RCR": function ( cpu ) {
			var operandSize = this.operand1.size
				, val = this.operand1.read()
				, count = this.operand2.read()
				, res, cf, of;
			
			if ( operandSize === 2 ) {
				count = (count & 0x1f) % 17;
			} else {
				count &= 0x1f;
			}
			
			if ( count === 0 ) { return; }
			
			if ( operandSize === 2 ) {
				res = (val >> count)
					| (cpu.CF.get() << (16 - count))
					| (val << (17 - count));
			} else {
				if ( count === 1 ) {
					res = (val >> 1) | (cpu.CF.get() << 31);
				} else {
					res = (val >> count)
						| (cpu.CF.get() << (32 - count))
						| (val << (33 - count));
				}
			}
			
			this.operand1.write(res);
			
			if ( operandSize === 2 ) {
				cf = (val >> (count - 1)) & 0x1;
				of = ((((res << 1) ^ res) & 0xFFFF) >> 15) & 0x1; // of = result15 ^ result14
			} else {
				cf = (val >> (count - 1)) & 0x1;
				of = ((res << 1) ^ res) >> 31; // of = result30 ^ result31
			}
			
			cpu.CF.setBin(cf);
			cpu.OF.setBin(of);
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
		}, "RETN_P": function ( cpu ) {
			var stackSizeAttr = cpu.SS.cache.default32BitSize
				, SP = (stackSizeAttr ? cpu.ESP : cpu.SP);
			if ( !this.operandSizeAttr ) {
				// Will clear high word of EIP
				cpu.EIP.set(cpu.popStack(2));
			} else {
				cpu.EIP.set(cpu.popStack(4));
			}
			// Pop (& discard) [imm16] bytes of parameters (not just discard
			//  16 bits, discard the no. read)
			SP.set(SP.get() + this.operand1.read());
		// Return ( Far ) from Procedure and pop imm16 bytes of parameters
		}, "RETF_P": function ( cpu ) {
			// Needs testing!!!!!!!!!
			//debugger;
			
			var stackSizeAttr = cpu.SS.cache.default32BitSize
				, SP = (stackSizeAttr ? cpu.ESP : cpu.SP)
				, PE = cpu.PE.get()
				, VM = cpu.VM.get();
			
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
			// Pop (& discard) [imm16] bytes of parameters (not just discard
			//  16 bits, discard the no. read)
			SP.set(SP.get() + this.operand1.read());
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
			debugger;
			util.problem("We don't use negative numbers any more,"
				+ " instead keep in 2s complement (eg. -1 = 0xFFFF)"
				+ " so this won't work");
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
			
			setFlags(this, cpu, val1, val2, res);
		// Integer Subtraction
		}, "SUB": function ( cpu ) {
			// NB: Addition and subtraction handle two's complement the same way
			//	for both unsigned and signed interpretations of numbers
			var val1 = this.operand1.read()
				, val2 = this.operand2.signExtend()
				, res = (val1 - val2) & this.operand1.mask;
			
			this.operand1.write(res);
			
			setFlags(this, cpu, val1, val2, res);
		// Scan/Compare String Data (Byte, Word or Dword)
		//	TODO: could be polymorphic, one func for each string-repeat type
		//	TODO: there is potential for speed ups here by using native .indexOf() / .slice() and similar
		//		array methods, instead of a possibly slow loop over each individual byte
		}, "SCAS": function ( cpu ) {
			var operandSize = this.operand1.size
				, CX = this.addressSizeAttr ? cpu.ECX : cpu.CX
				, DI = this.addressSizeAttr ? cpu.EDI : cpu.DI
			// This is the difference between SCAS and CMPS: here,
			//	the value in AL/(E)AX is compared with the chars in string,
			//	so only needs to be read once
				, val1 = this.operand1.read(), val2
				, res
				, edi, ediStart, ediEnd
				, len;
			
			switch ( this.repeat ) {
			// Common case; no repeat prefix
			case "":
				val2 = this.operand2.read();
				res = (val1 - val2) & this.operand1.mask;
				
				// Direction Flag set, decrement (scan in reverse direction)
				if ( cpu.DF.get() ) {
					DI.set(DI.get() - operandSize);
				// Direction Flag clear, increment (scan in forward direction)
				} else {
					DI.set(DI.get() + operandSize);
				}
				break;
			// Repeat while Equal, max CX times
			case "#REP/REPE":
				len = CX.get() * operandSize;
				edi = ediStart = DI.get();
				// Direction Flag set, decrement (scan in reverse direction)
				if ( cpu.DF.get() ) {
					ediEnd = edi - len;
					for ( ; edi >= ediEnd ; edi -= operandSize ) {
						DI.set(edi);
						val2 = this.operand2.read();
						
						// NB: This test cannot be in the for(...) condition
						if ( val2 !== val1 ) { break; }
					}
					CX.set(CX.get() - (ediStart - edi) / operandSize + 1);
				// Direction Flag clear, increment (scan in forward direction)
				} else {
					ediEnd = edi + len;
					for ( ; edi < ediEnd ; edi += operandSize ) {
						DI.set(edi);
						val2 = this.operand2.read();
						
						// NB: This test cannot be in the for(...) condition
						if ( val2 !== val1 ) { break; }
					}
					CX.set(CX.get() - (edi - ediStart) / operandSize - 1);
				}
				DI.set(edi);
				break;
			// Repeat while Not Equal, max CX times
			case "#REPNE":
				len = CX.get() * operandSize;
				edi = ediStart = DI.get();
				// Direction Flag set, decrement (scan in reverse direction)
				if ( cpu.DF.get() ) {
					ediEnd = edi - len;
					for (; edi > ediEnd ; edi -= operandSize ) {
						DI.set(edi);
						val2 = this.operand2.read();
						
						// NB: This test cannot be in the for(...) condition
						if ( val2 === val1 ) { break; }
					}
					CX.set(CX.get() - (ediStart - edi) / operandSize + 1);
				// Direction Flag clear, increment (scan in forward direction)
				} else {
					ediEnd = edi + len;
					for (; edi < ediEnd ; edi += operandSize ) {
						DI.set(edi);
						val2 = this.operand2.read();
						
						// NB: This test cannot be in the for(...) condition
						if ( val2 === val1 ) { break; }
					}
					CX.set(CX.get() - (edi - ediStart) / operandSize - 1);
				}
				DI.set(edi);
				break;
			default:
				util.problem("Execute (SCAS) :: invalid string repeat operation/prefix.");
			}
			// Store the last comparison subtraction for flags calc
			res = (val1 - val2) & this.operand1.mask;
			setFlags(this, cpu, val1, val2, res);
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
			util.panic("Execute (SGDT) :: unsupported");
		// Store Interrupt Descriptor Table Register
		}, "SIDT": function ( cpu ) {
			util.panic("Execute (SIDT) :: unsupported");
		// Shift Left - Double Precision
		}, "SHLD": function ( cpu ) {
			util.panic("Execute (SHLD) :: unsupported");
		// Shift Right - Double Precision
		}, "SHRD": function ( cpu ) {
			util.panic("Execute (SHRD) :: unsupported");
		// Store Local Descriptor Table Register
		}, "SLDT": function ( cpu ) {
			util.panic("Execute (SLDT) :: unsupported");
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
		//  TODO: Optimise if writing to Buffer - most common use of STOS
		//        is to zero a block of memory with memset() - this case can
		//        be optimised for Buffers (see Buffer.zeroBuffer())
		}, "STOS": function ( cpu ) {
			var operandSize = this.operand1.size
				, CX = this.addressSizeAttr ? cpu.ECX : cpu.CX
				, DI = this.addressSizeAttr ? cpu.EDI : cpu.DI
				, val1, val2, res
				, edi, ediEnd
				, len;
			
			// Common case; no repeat prefix
			if ( !this.repeat ) {
				this.operand1.write(this.operand2.read());
				
				// Direction Flag set, decrement ( scan in reverse direction )
				if ( cpu.DF.get() ) {
					DI.set(DI.get() - operandSize);
				// Direction Flag clear, increment ( scan in forward direction )
				} else {
					DI.set(DI.get() + operandSize);
				}
				return;
			// Repeat CX times
			} else if ( this.repeat === "#REP/REPE" ) {
				len = CX.get() * operandSize;
				edi = DI.get();
				// Direction Flag set, decrement (scan in reverse direction)
				if ( cpu.DF.get() ) {
					ediEnd = edi - len;
					for ( ; edi >= ediEnd ; edi -= operandSize ) {
						DI.set(edi);
						this.operand1.write(this.operand2.read());
					}
				// Direction Flag clear, increment (scan in forward direction)
				} else {
					ediEnd = edi + len;
					for ( ; edi < ediEnd ; edi += operandSize ) {
						DI.set(edi);
						this.operand1.write(this.operand2.read());
					}
				}
				DI.set(edi);
				CX.set(0);
				return;
			}
			
			// Otherwise must have been #REPNE (#REPNZ)
			util.problem("Instruction.execute() :: STOS - #REPNE invalid");
		// Store Task Register
		}, "STR": function ( cpu ) {
			util.panic("Execute (STR) :: unsupported");
		// Logical Compare
		}, "TEST": function ( cpu ) {
			var val1 = this.operand1.read()
				, val2 = this.operand2.read()
				, res = val1 & val2;
			
			// Do not store result of subtraction; only flags
			setFlags(this, cpu, val1, val2, res);
		// Verify a Segment for Reading
		}, "VERR": function ( cpu ) {
			util.panic("Execute (VERR) :: unsupported");
		// Verify a Segment for Writing
		}, "VERW": function ( cpu ) {
			util.panic("Execute (VERW) :: unsupported");
		// Wait until BUSY# Pin is Inactive (HIGH)
		}, "WAIT": function ( cpu ) {
			// Suspend execution of 80386 Instructions until BUSY# is inactive;
			//  driven by numeric processor extension 80287
			
			// We do not use a math coprocessor, so this can safely be ignored for now.
		// Write Back & Invalidate Cache (486+)
		}, "WBINVD": function ( cpu ) {
			util.warning("WBINVD :: Not fully implemented");
			
			// TODO: need a cpu.wipeCache() method?
			//       - also to be called in CS.set()
			cpu.cache_insn.length = 0;
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
			cpu.AL.set(this.segreg.readSegment(
				(RBX.get() + cpu.AL.get()) & (this.addressSizeAttr ? 0xFFFF : 0xFF)
				, 1 // Always 1 byte read
			));
		// Logical Exclusive OR
		}, "XOR": function ( cpu ) {
			var val1 = this.operand1.read();
			var val2 = this.operand2.signExtend();
			var res = (val1 ^ val2) & this.operand1.mask;
			
			this.operand1.write(res);
			
			setFlags(this, cpu, val1, val2, res);
		}
	};
	
	/* ====== Private ====== */
	// To throw a cpu exception / fault ( eg. General Protection )
	function CPUException( type, code ) {
		util.debug("cpu exception: " + type + ", " + code);
	}
	
	// For the conditional (Jxx) instructions, jumps relative
	//  (ie. adds to (E)IP) either short (8-bit) or near (16-bit)
	function jumpRelative( insn, cpu ) {
		var IP = insn.operandSizeAttr ? cpu.EIP : cpu.IP
			, ip = insn.operand1.signExtend(IP.size);
		
		// Relative jump - add to (E)IP
		IP.set(IP.get() + ip);
	}
	
	/* ============ State storage for Lazy Flags eval later ============ */
	/* 	To be called after executing any Instruction which modifies
	 *	one or more flags. The different versions of the function
	 *	below are intended to save valuable time not storing data when
	 *	it is not needed; clearing the unused values is not needed either,
	 *	as the lazy evaluator will just ignore them.
	 */
	
	// Operand 1, 2 and result
	function setFlags( insn, cpu, val1, val2, res ) {
		cpu.valLast1 = val1;
		cpu.valLast2 = val2;
		cpu.resLast = res;
		cpu.insnLast = insn;
		//cpu.name_insnLast = this.name;
		cpu.EFLAGS.bitsDirty = 0xFFFFFFFF;
	};
	// Operand 1 and result only
	function setFlags_Op1( insn, cpu, val1, res ) {
		cpu.valLast1 = val1;
		cpu.valLast2 = null;
		cpu.resLast = res;
		cpu.insnLast = insn;
		//cpu.name_insnLast = this.name;
		cpu.EFLAGS.bitsDirty = 0xFFFFFFFF;
	};
	// Result only
	function setFlags_Result( insn, cpu, res ) {
		cpu.valLast1 = null;
		cpu.valLast2 = null;
		cpu.resLast = res;
		cpu.insnLast = insn;
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
	return Execute;
});
