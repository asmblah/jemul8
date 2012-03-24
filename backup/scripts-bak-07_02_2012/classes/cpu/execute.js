/*
 *	jsEmu - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: CPU Instruction class support
 */
var mod = new jsEmu.SecondaryModule( function ( jsEmu, machine, motherboard, CPU, FlashBIOSChip, BIOS, DRAM ) {

	// Run the CPU - start fetch/execute cycle
	jsEmu.x86CPU.prototype.Exec = function () {//alert("Exec!");
		/* ==== Malloc ==== */
		//var bitD_ProtectedMode_SegmentDesc = 0;
		// Size of memory addresses
		var sizeAddress_Bytes;
		var sizeAddress_Bytes_WithPrefix;
		// Size of operands
		var sizeOperand_Bytes;
		var sizeOperand_Bytes_WithPrefix;
		
		var arr_insnCache = this.arr_insnCache;
		var byt;
		//var colOpcodeMap;
		var dataOpcode;
		var dataExtension;
		var fieldMod;
		var fieldReg;
		var fieldRM;
		var insn;
		var typeStringRepeat = "";
		var nameInstruction = "";
		var nameMapFlags;
		var offset;
		var offsetStart;
		//var rowOpcodeMap;
		var textASM;
		var reg_segment = CPU.DS;
		/* ==== /Malloc ==== */
		
		// If in Protected Mode, segment descriptor will contain a D-bit, indicating
		//	that the function of the size prefixes should be reversed
		// Real Mode, or Protected Mode with D = 0
		//if ( bitD_ProtectedMode_SegmentDesc == 0 ) {
			sizeAddress_Bytes = sizeOperand_Bytes = 2;
			sizeAddress_Bytes_WithPrefix = sizeOperand_Bytes_WithPrefix = 4;
		// Protected mode with D = 1
		//} else {
		//	sizeAddress_Bytes = sizeOperand_Bytes = 4;
		//	sizeAddress_Bytes_WithPrefix = sizeOperand_Bytes_WithPrefix = 2;
		//}
		
		// Offset is current absolute Instruction address
		offset = (this.CS.Get() << 4) + this.EIP.Get();
		
		var temp = offset + 512;
		//var start = new Date().getTime();
		
		// After testing, current JS engines execute code significantly faster
		//	if it is looped over; unrolling large ( eg. several thousand ) Instructions
		//	into the equivalent JS commands is extremely slow
		// ( NB: see experiment results ( at top ) for why this is the optimum loop construct here. )
		while ( offset < temp ) {
			// Common case; Cache miss - Instruction not yet decoded into Instruction cache
			//	TODO: detect ( on memory writes ) whether that byte in RAM has been decoded,
			//	if so code is polymorphic, so ( for now ) just delete rest of cache after the changed instruction
			//	by setting the length property of the cache array
			if ( !(offset in arr_insnCache) ) {
				// Store start byte offset of instruction: will be needed later
				offsetStart = offset;
				
				/* ====== Process any prefixes ====== */
				//	( NB: see experiment results ( at top ) for why this is the optimum loop construct here. )
				while ( true ) {
					// Read next byte of code - may be an opcode or a prefix
					byt = DRAM.memData[offset];
					
					// Prefixes
					switch ( byt ) {
					/* ======= Segment overrides ======= */
					case 0x26:
						reg_segment = CPU.ES;
						++offset;	// Skip prefix byte & read next
						continue;
					case 0x2E:
						reg_segment = CPU.CS;
						++offset;	// Skip prefix byte & read next
						continue;
					case 0x36:
						reg_segment = CPU.SS;
						++offset;	// Skip prefix byte & read next
						continue;
					case 0x3E:
						reg_segment = CPU.DS;
						++offset;	// Skip prefix byte & read next
						continue;
					case 0x64:
						reg_segment = CPU.FS;
						++offset;	// Skip prefix byte & read next
						continue;
					case 0x65:
						reg_segment = CPU.GS;
						++offset;	// Skip prefix byte & read next
						continue;
					/* ======= /Segment overrides ======= */
					
					// Operand-Size Attribute
					case 0x66:
						sizeOperand_Bytes = sizeOperand_Bytes_WithPrefix;
						// Skip prefix byte & read next
						++offset;
						continue;
					// Address-Size Attribute
					case 0x67:
						sizeAddress_Bytes = sizeAddress_Bytes_WithPrefix;
						// Skip prefix byte & read next
						++offset;
						continue;
					// Assert LOCK# Signal
					case 0xF0:
						// In multiprocessor environments, this ensures exclusive use of any memory for the
						//	instruction it precedes. Ensures atomic operations.
						
						//	( For now, no multiprocessor support, so can safely be ignored. )
						
						// Skip prefix byte & read next
						++offset;
						continue;
					// REPNE - String repeat operation
					case 0xF2:
						typeStringRepeat = "#REPNE";
						// Skip prefix byte & read next
						++offset;
						continue;
					// REP - String repeat operation
					case 0xF3:
						typeStringRepeat = "#REP";
						// Skip prefix byte & read next
						++offset;
						continue;
					}
					// Fast exit from prefix loop
					break;
				}
				/* ====== /Process any prefixes ====== */
				
				// Skip opcode byte
				++offset;
				
				/* ====== Process Opcode Extensions & Escapes ====== */
				
				// 1-byte Opcodes ( may use an extension )
				if ( byt !== 0x0F ) {
					/* ====== Decode ModR/M byte ====== */
					// We may not use ModR/M byte, so don't skip past it after reading
					bytModRM = DRAM.memData[offset];
					fieldMod = bytModRM >> 6;				// Mod field is first 2 bits
					fieldReg = (bytModRM >> 3) & 0x07;		// Reg field is second 3 bits ( Reg 2 )
					fieldRM = bytModRM & 0x07;				// Register/Memory field is last 3 bits ( Reg 1 )
					/* ====== /Decode ModR/M byte ====== */
					
					// By default, assume Opcode is a 1-byte unextended; if not found in table,
					//	check Extensions table, using ModR/M Reg field as an Opcode Extension field ( bits )
					if ( !(dataOpcode = this.arr_mapOpcodes_1Byte[byt]) ) {
						dataOpcode = this.arr_mapOpcodeExtensions[(byt << 3) | fieldReg];
					}
				// 2-byte Opcode Escape ( may use an extension )
				} else {alert("GRUB MBR wants to exec a 2-byte opcode!");return;
					// Read next byte of code - 1st was 0Fh
					byt = DRAM.memData[offset];
					
					// Skip ( 2nd ) opcode byte
					++offset;
					
					/* ====== Decode ModR/M byte ====== */
					// We may not use ModR/M byte, so don't skip past it after reading
					bytModRM = DRAM.memData[offset];
					fieldMod = bytModRM >> 6;				// Mod field is first 2 bits
					fieldReg = (bytModRM >> 3) & 0x07;		// Reg field is second 3 bits ( Reg 2 )
					fieldRM = bytModRM & 0x07;				// Register/Memory field is last 3 bits ( Reg 1 )
					/* ====== /Decode ModR/M byte ====== */
					
					// By default, assume Opcode is a 2-byte unextended; if not found in table,
					//	check Extensions table, using ModR/M Reg field as an Opcode Extension field ( bits )
					if ( !(dataOpcode = this.arr_mapOpcodes_2Byte[byt]) ) {
						dataOpcode = this.arr_mapOpcodeExtensions[(byt << 3) | fieldReg];
					}
				}
				/* ====== /Process Opcode Extensions & Escapes ====== */
				
				// Read ASM mnemonic/name for instruction
				nameInstruction = dataOpcode[0];
				
				// Create new Instruction and store in array, indexed by address
				//	for fast lookups later
				insn = arr_insnCache[offsetStart] = new jsEmu.Instruction( offsetStart, nameInstruction, sizeAddress_Bytes, sizeOperand_Bytes );
				
				// If repeat prefix was used for a string operation, store it against the Instruction
				insn.typeStringRepeat = typeStringRepeat;
				
				// Instruction has operand(s) - ( one or none of dest and source ( possibly a third eg. imul ),
				//	these may be swapped with direction bit if present & applicable )
				if ( dataOpcode.length > 1 ) {
					/* ====== Decode first Operand ====== */
					// ( NB: already determined it must exist )
					insn.operand1 = new jsEmu.Operand(
							insn					// Give Operand a reference to its parent Instruction
							, offset				// Absolute offset of Operand's first byte
							, byt					// Instruction opcode
							, dataOpcode[1][0]		// Flags text for opcode from table
							, reg_segment
							, fieldMod, fieldReg, fieldRM, true
						);
					// Get offset after finishing decode ( move past Operand's bytes )
					offset = insn.operand1.offset;
					/* ====== /Decode first Operand ====== */
					
					/* ====== Decode second Operand ====== */
					// Check whether Instruction uses a second Operand
					if ( dataOpcode[1].length > 1 ) {
						insn.operand2 = new jsEmu.Operand(
								insn					// Give Operand a reference to its parent Instruction
								, offset				// Absolute offset of Operand's first byte
								, byt					// Instruction opcode
								, dataOpcode[1][1]		// Flags text for opcode from table
								, reg_segment
								, fieldMod, fieldReg, fieldRM, false
							);
						// Get offset after finishing decode ( move past Operand's bytes )
						offset = insn.operand2.offset;
					}
					/* ====== /Decode second Operand ====== */
					
					/* ====== Decode third Operand ====== */
					// Check whether Instruction uses a third Operand
					if ( dataOpcode[1].length > 2 ) {
						insn.operand3 = new jsEmu.Operand(
								insn					// Give Operand a reference to its parent Instruction
								, offset				// Absolute offset of Operand's first byte
								, byt					// Instruction opcode
								, dataOpcode[1][2]		// Flags text for opcode from table
								, reg_segment
								, fieldMod, fieldReg, fieldRM, false
							);
						// Get offset after finishing decode ( move past Operand's bytes )
						offset = insn.operand3.offset;
					}
					/* ====== /Decode third Operand ====== */
				}
				
				// Calculate length of Instruction in bytes
				insn.lenBytes = offset - offsetStart;
				
				/* ===== Build text ASM representation of Instruction ===== */
				textASM = "";
				if ( typeStringRepeat ) {
					textASM += typeStringRepeat + " ";
				}
				textASM += nameInstruction;
				if ( insn.operand1 ) {
					textASM += " " + insn.operand1.GetASMText();
				}
				if ( insn.operand2 ) {
					textASM += ", " + insn.operand2.GetASMText();
				}
				if ( insn.operand3 ) {
					textASM += ", " + insn.operand3.GetASMText();
				}
				//console.log(textASM);
				/* ===== /Build text ASM representation of Instruction ===== */
				
				//debugger;
				
				// Execute immediately
				CPU.EIP.Set(offset - (CPU.CS.Get() << 4));
				insn.Execute();
				offset = (CPU.CS.Get() << 4) + CPU.EIP.Get();
				
				if ( CPU.EIP.Get() == 0x7D80 ) {
				//if ( offset == 2073 ) {
					return;debugger;
				}
				
				/* ==== Cleanup ==== */
				reg_segment = CPU.DS;
				typeStringRepeat = "";
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
				CPU.EIP.Set(offset - (CPU.CS.Get() << 4));
				insn.Execute();
				offset = (CPU.CS.Get() << 4) + CPU.EIP.Get();
				
				if ( CPU.EIP.Get() == 0x7D80 ) {
					return;debugger;
				}
			}
		}
	};
	
	/* ==== Exports ==== */
	
	/* ==== /Exports ==== */
});

// Add Module to emulator
jsEmu.AddModule(mod);