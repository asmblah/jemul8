/*
 *	jsEmu - JavaScript x86 Emulator
 *	Copyright (c) 2009 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: CPU Instruction class support
 */
var mod = new jsEmu.SecondaryModule( function ( jsEmu, machine, motherboard, CPU, FlashBIOSChip, BIOS, DRAM ) {
	/* ======== Config ======== */
	// CPU emulation speed ( in IPS, not Hertz as there is no direct correlation
	//	in this emulator between CPU cycles and Instruction exec time )
	var num_insnPerSecond = 10000;
	// Yield rate of emulator ( stop CPU processing and refresh video,
	//	process DOM events and translate to Interrupts, etc. )
	var numYieldsPerSecond = 30;
	// Amount of time Yield lasts for before returning to CPU processing
	var millisecsYield = 10;
	/* ======== /Config ======== */
	
	// Ensure that we are not left with a CPU running at < 1 Instructions per slice,
	//	otherwise nothing will happen!
	if ( num_insnPerSecond < numYieldsPerSecond ) {
		num_insnPerSecond = numYieldsPerSecond;
	}
	
	// Amount of time available within a 1 second period for CPU processing
	var millisecsAllSlices = 1000 - millisecsYield * numYieldsPerSecond;
	// Calculate amount of time CPU processing runs for before Yielding to allow
	//	DOM processing etc., taking into account the duration of the Yield processing itself
	var millisecsPerSlice = millisecsAllSlices / numYieldsPerSecond;
	// Calculate maximum number of Instructions to be executed by CPU before Yielding
	//	( because of the rounding used here, the specified Instructions per second may
	//	not be exactly obtained
	//		eg. 10000 insns/sec will be 333.333..., which * 30 yields/sec = 10000 insns/sec.
	//	However, after rounding,
	//		10000 insns/sec will be 333, which * 30yields/sec = 9990 insns/sec.
	var num_max_insnPerSlice = Math.floor(millisecsPerSlice * (num_insnPerSecond / millisecsAllSlices));
	// Ensure that rounding does not leave us with a CPU running at 0 Instructions per slice,
	//	otherwise nothing will happen!
	if ( num_max_insnPerSlice == 0 ) {
		num_max_insnPerSlice = 1;
	}
	
	// Run the CPU - start fetch/execute cycle
	jsEmu.x86CPU.prototype.Exec = function () {
		/* ==== Malloc ==== */
		var CPU = this;
		var ticksYieldStart;
		var millisecsPauseForYield;
		/* ==== /Malloc ==== */
		/* ======= Yield management closure ======= */
		var func_YieldManager = function () {
			// Start next set of Fetch-Decode-Execute cycles if CPU is not halted ( will run
			//	until next Yield )
			if ( !CPU.IsHalted() ) {
				CPU.FetchDecodeExecute();
			}
			
			// Log exact time in milliseconds that Yield started at
			ticksYieldStart = new Date().getTime();
			
			/* ====== Quickly process any refreshes etc. during Yield ====== */
			jsEmu.screen.Refresh();
			/* ====== /Quickly process any refreshes etc. during Yield ====== */
			
			// Calculate milliseconds duration of Yield; eg. if Yield has a max of 10ms
			//	to complete in, and it consumes 6ms, only delay next FDE cycles loop
			//	for 4ms - the remaining time ( until setTimeout elapses ) the JavaScript interpreter will be
			//	dormant, so the DOM can refresh & send events etc.
			millisecsPauseForYield = millisecsYield - (new Date().getTime() - ticksYieldStart);
			//if (top.status===undefined || millisecsPauseForYield < top.status )
			top.status = millisecsPauseForYield;
			
			// Special case ( hopefully rare ) where Yield took longer than scheduled
			if ( millisecsPauseForYield < 0 ) {
				// Delay FDE cycles loop start until next scheduled Yield ( ie. skip the next FDE cycles loop )
				millisecsPauseForYield = millisecsPerSlice + Math.max(-millisecsPerSlice, millisecsPauseForYield);
			}
			
			// Wait for max. Yield duration before attempting to continue
			//	to allow DOM to update & send events, etc.
			window.setTimeout(func_YieldManager, millisecsPauseForYield);
		};
		/* ======= /Yield management closure ======= */
		// Don't start yield manager immediately; allow rest of BIOS POST to continue first
		window.setTimeout(func_YieldManager, 0);
	};
	
	// Private method; start next set of Fetch-Decode-Execute cycles up until next Yield is scheduled
	jsEmu.x86CPU.prototype.FetchDecodeExecute = function () {
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
		var idx_insn;
		/* ==== /Malloc ==== */
		
		// If in Protected Mode, segment descriptor will contain a D-bit, indicating
		//	that the function of the size prefixes should be reversed
		// Real Mode, or Protected Mode with D = 0
		//if ( bitD_ProtectedMode_SegmentDesc == 0 ) {
			sizeOperand_Bytes = 2;
			sizeOperand_Bytes_WithPrefix = 4;
			sizeAddress_Bytes = 2;
			sizeAddress_Bytes_WithPrefix = 4;
		// Protected mode with D = 1
		//} else {
		//	sizeAddress_Bytes = sizeOperand_Bytes = 4;
		//	sizeAddress_Bytes_WithPrefix = sizeOperand_Bytes_WithPrefix = 2;
		//}
		
		// Offset is current absolute Instruction address
		offset = (this.CS.Get() << 4) + this.EIP.Get();
		//debugger;
		//var temp = offset + 512;
		//var start = new Date().getTime();
		
		// After testing, current JS engines execute code significantly faster
		//	if it is looped over; unrolling large ( eg. several thousand ) Instructions
		//	into the equivalent JS commands is extremely slow
		// ( NB: see experiment results ( at top ) for why this is the optimum loop construct here. )
		for ( idx_insn = 0 ; idx_insn < num_max_insnPerSlice && !CPU.IsHalted() ; ++idx_insn ) {
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
					fieldMod = bytModRM >> 6;				// Mod field is first 2 bits	( TODO: faster to leave unshifted? )
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
							, fieldMod, fieldReg, fieldRM
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
								, fieldMod, fieldReg, fieldRM
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
								, fieldMod, fieldReg, fieldRM
							);
						// Get offset after finishing decode ( move past Operand's bytes )
						offset = insn.operand3.offset;
					}
					/* ====== /Decode third Operand ====== */
				}
				
				// Calculate length of Instruction in bytes
				insn.lenBytes = offset - offsetStart;
				
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
			}
			
			/* ===== Build text ASM representation of Instruction ===== */
			textASM = "";
			if ( insn.typeStringRepeat ) {
				textASM += insn.typeStringRepeat + " ";
			}
			textASM += insn.name;
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
			
			if ( CPU.EIP.Get() == 0x7D60 ) {
				//return;//
				//debugger;
				//CPU.Halt();
				//return;
			}
		}
	};
	
	/* ==== Exports ==== */
	
	/* ==== /Exports ==== */
});

// Add Module to emulator
jsEmu.AddModule(mod);