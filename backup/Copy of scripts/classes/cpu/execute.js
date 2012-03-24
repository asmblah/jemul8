/*
 *	jsEmu - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: CPU Instruction class support
 */
var mod = new jsEmu.SecondaryModule( function ( jsEmu, machine, motherboard, CPU, FlashBIOSChip, BIOS, DRAM ) {

	// Run the CPU - start fetch/execute cycle
	jsEmu.x86CPU.prototype.Exec = function () {
		/* ==== Malloc ==== */
		//var bitD_ProtectedMode_SegmentDesc = 0;
		// Size of memory addresses
		var attr_sizeAddress;
		var attr_sizeAddress_WithPrefix;
		// Size of operands
		var attr_sizeOperand;
		var attr_sizeOperand_WithPrefix;
		
		var arr_insnCache = this.arr_insnCache;
		var byt;
		var colOpcodeMap;
		var dataOpcode;
		var dataExtension;
		var fieldMod;
		var fieldReg;
		var fieldRM;
		var insn;
		var lenBytes;
		var nameStringRepeat = "";
		var nameInstruction = "";
		var nameMapFlags;
		var offset;
		var offsetStart;
		var operand1;
		var operand2;
		var rowOpcodeMap;
		var textASM;
		var reg_segment = CPU.DS;
		/* ==== /Malloc ==== */
		
		// If in Protected Mode, segment descriptor will contain a D-bit, indicating
		//	that the function of the size prefixes should be reversed
		// Real Mode, or Protected Mode with D = 0
		//if ( bitD_ProtectedMode_SegmentDesc == 0 ) {
			attr_sizeAddress = attr_sizeOperand = 2;
			attr_sizeAddress_WithPrefix = attr_sizeOperand_WithPrefix = 4;
		// Protected mode with D = 1
		//} else {
		//	attr_sizeAddress = attr_sizeOperand = 4;
		//	attr_sizeAddress_WithPrefix = attr_sizeOperand_WithPrefix = 2;
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
			if ( 1 || !(offset in arr_insnCache) ) {
				// Store start byte offset of instruction: will be needed later
				offsetStart = offset;
				/* ====== Process any prefixes etc. ====== */
				//	( NB: see experiment results ( at top ) for why this is the optimum loop construct here. )
				while ( true ) {
					// Read next byte of code - may be an opcode or a prefix
					byt = DRAM.memData[offset];
					
					// Get references to cell in opcode map / table from the opcode byte
					// TODO: change to 1D array, just using byt as index ( use hash { } as array length etc. not needed )
					colOpcodeMap = byt & 0x0F;	// In low nibble
					rowOpcodeMap = byt >> 4;	// In high nibble
					
					// Read data from map / table
					dataOpcode = this.arr_mapOpcodes_1Byte[rowOpcodeMap][colOpcodeMap];
					
					// Opcode extension was used
					if ( dataOpcode[0].substr(0, 5) === "#EXT_" ) {
						/* ====== Decode ModR/M byte ====== */
						// We will use ModR/M byte, so skip to it to read
						bytModRM = DRAM.memData[++offset];
						//fieldMod = bytModRM >> 6;				// Mod field is first 2 bits
						fieldReg = (bytModRM >> 3) & 0x07;		// Reg field is second 3 bits ( Reg 2 )
						//fieldRM = bytModRM & 0x07;				// Register/Memory field is last 3 bits ( Reg 1 )
						/* ====== /Decode ModR/M byte ====== */
						
						// Use ModR/M Reg field as opcode extension field
						dataExtension = this.arr_mapOpcodes_1Byte_Extensions[dataOpcode[0].substr(5) - 1][fieldReg];
						// We are going to need a new set of opcode data
						dataOpcode_New = [ dataExtension[0] ];
						//alert(new Date().getTime() - start);
						//debugger;
						//return;
						// Extension table defines data for the Operands
						if ( dataExtension.length > 1 ) {
							// Original table defines a switch between possible Operand data items in extension table
							if ( dataOpcode.length > 2 ) {
								var arr_dataOperand = dataExtension[1][0].split("/");
								dataOpcode_New[1] = [ dataOpcode[1][0], arr_dataOperand[dataOpcode[2]] ];
							// No switch; use data from original table if provided
							} else /*if ( dataOpcode.length > 1 )*/ {
								dataOpcode_New[1] = dataOpcode[1];
							}
						// Extension table does NOT define data for the Operands;
						//	read it directly from the original table
						} else if ( dataOpcode.length > 1 ) {
							dataOpcode_New[1] = dataOpcode[1];
						}
						
						// Use our newly constructed opcode & operand data
						dataOpcode = dataOpcode_New;
					} else {
						// Prefix
						switch ( dataOpcode[0] ) {
						// Segment override ( prefix )
						case "#SEG=":
							reg_segment = CPU.hsh_reg[dataOpcode[1][0]];
							// Skip prefix byte & read next
							++offset;
							continue;
						// Operand-Size Attribute ( prefix )
						case "#OP_SIZE":
							attr_sizeOperand = attr_sizeOperand_WithPrefix;
							// Skip prefix byte & read next
							++offset;
							continue;
						// Address-Size Attribute ( prefix )
						case "#ADDR_SIZE":
							attr_sizeAddress = attr_sizeAddress_WithPrefix;
							// Skip prefix byte & read next
							++offset;
							continue;
						// String repeat operation ( prefix )
						case "#REP":
						case "#REPNE":
							nameStringRepeat = dataOpcode[0];
							// Skip prefix byte & read next
							++offset;
							continue;
						// Assert LOCK# Signal ( prefix )
						case "#LOCK":
							// In multiprocessor environments, this ensures exclusive use of any memory for the
							//	instruction it precedes. Ensures atomic operations.
							
							//	( For now, no multiprocessor support, so can safely be ignored. )
							
							// Skip prefix byte & read next
							++offset;
							continue;
						}
					}
					// Fast exit from prefix loop
					break;
				}
				/* ====== /Process any prefixes etc. ====== */
				
				// Read ASM mnemonic/name for instruction
				nameInstruction = dataOpcode[0];
				
				// Skip opcode byte
				++offset;
				
				// Instruction has operand(s) - ( one or none of dest and source,
				//	these may be swapped with direction bit if present & applicable )
				if ( dataOpcode.length > 1 ) {
					/* ====== Decode ModR/M byte ====== */
					// We may not use ModR/M byte, so don't skip past it after reading
					bytModRM = DRAM.memData[offset];
					fieldMod = bytModRM >> 6;				// Mod field is first 2 bits
					fieldReg = (bytModRM >> 3) & 0x07;		// Reg field is second 3 bits ( Reg 2 )
					fieldRM = bytModRM & 0x07;				// Register/Memory field is last 3 bits ( Reg 1 )
					/* ====== /Decode ModR/M byte ====== */
					
					/* ====== Decode first Operand ====== */
					// ( NB: already determined it must exist )
					operand1 = new jsEmu.Operand( offset );
					
					operand1.Decode(
							byt						// Instruction opcode
							, dataOpcode[1][0]		// Flags text for opcode from table
							, attr_sizeAddress
							, attr_sizeOperand
							, reg_segment
							, fieldMod, fieldReg, fieldRM, true
						);
					// Get offset after finishing decode ( move past Operand's bytes )
					offset = operand1.offset;
					/* ====== /Decode first Operand ====== */
					
					/* ====== Decode second Operand ====== */
					// Check whether Instruction uses a second Operand
					if ( dataOpcode[1].length > 1 ) {
						operand2 = new jsEmu.Operand( offset );
						
						operand2.Decode(
								byt					// Instruction opcode
								, dataOpcode[1][1]	// Flags text for opcode from table
								, attr_sizeAddress
								, attr_sizeOperand
								, reg_segment
								, fieldMod, fieldReg, fieldRM, false
							);
						// Get offset after finishing decode ( move past Operand's bytes )
						offset = operand2.offset;
					}
					/* ====== /Decode second Operand ====== */
					
					//console.dir(operand1);
				}
				
				// Calculate length of Instruction in bytes
				lenBytes = offset - offsetStart;
				
				/* ===== Build text ASM representation of Instruction ===== */
				textASM = "";
				if ( nameStringRepeat ) {
					textASM += nameStringRepeat + " ";
				}
				textASM += nameInstruction;
				if ( operand1 ) {
					textASM += " " + operand1.GetASMText();
				}
				if ( operand2 ) {
					textASM += ", " + operand2.GetASMText();
				}
				//console.log(textASM);
				/* ===== /Build text ASM representation of Instruction ===== */
				
				// Create new Instruction and store in array, indexed by address
				//	for fast lookups later
				insn = arr_insnCache[offsetStart] = new jsEmu.Instruction( offsetStart, nameInstruction, operand1, operand2, lenBytes, attr_sizeAddress, attr_sizeOperand );
				debugger;
				// Execute immediately
				CPU.EIP.Set(offset - (CPU.CS.Get() << 4));
				insn.Execute();
				offset = (CPU.CS.Get() << 4) + CPU.EIP.Get();
				
				/* ==== Cleanup ==== */
				operand1 = operand2 = null;
				reg_segment = CPU.DS;
				nameStringRepeat = "";
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
			}
			
			
		}
	};
	
	/* ==== Exports ==== */
	
	/* ==== /Exports ==== */
});

// Add Module to emulator
jsEmu.AddModule(mod);