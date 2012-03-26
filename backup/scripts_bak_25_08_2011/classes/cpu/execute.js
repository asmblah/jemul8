/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: CPU Instruction class support
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("cpu/execute", function ( $ ) { "use strict";
	var x86Emu = this.data("x86Emu");
	
	/* ======== Config ======== */
	// CPU emulation speed ( in IPS, not Hertz as there is no direct correlation
	//	in this emulator between CPU cycles and Instruction exec time )
	var num_insnPerSecond = 10000
	// Yield rate of emulator ( stop CPU processing and refresh video,
	//	process DOM events and translate to Interrupts, etc. )
		, numYieldsPerSecond = 30
	// Amount of time Yield lasts for before returning to CPU processing
		, millisecsYield = 20;
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
	// Calculate maximum number of Instructions to be executed
	//	by CPU before Yielding ( because of the rounding used here,
	//	the specified Instructions per second may not be exactly obtained
	//		eg. 10000 insns/sec will be 333.333...,
	//			which * 30 yields/sec = 10000 insns/sec.
	//	However, after rounding, 10000 insns/sec will be 333,
	//	which * 30yields/sec = 9990 insns/sec.
	var num_max_insnPerSlice = Math.floor(millisecsPerSlice
		* (num_insnPerSecond / millisecsAllSlices));
	// Ensure that rounding does not leave us with a CPU
	//	running at 0 Instructions per slice, otherwise nothing will happen!
	if ( num_max_insnPerSlice == 0 ) {
		num_max_insnPerSlice = 1;
	}
	
	//var DEBUG_LIST_INSN = [];
	
	// Run the CPU - start fetch/execute cycle
	x86Emu.x86CPU.prototype.exec = function () {
		var machine = this.machine, cpu = this
			, ticksYieldStart
			, millisecsPauseForYield;
		
		/* ======= Yield management closure ======= */
		var yieldManager = function () {
			// Start next set of Fetch-Decode-Execute cycles if CPU is not halted
			//	(will run until next Yield)
			if ( !cpu.isHalted ) {
				cpu.fetchDecodeExecute();
			}
			
			// Log exact time in milliseconds that Yield started at
			ticksYieldStart = new Date().getTime();
			
			/* ====== Quickly process any refreshes etc. during Yield ====== */
			// Handle DMA
			if ( machine.HRQ.get() ) {
				// Assert Hold Acknowledge (HLDA) and go into a bus hold state
				machine.raiseHLDA();
			}
			//jemul8.screen.Refresh();
			/* ====== /Quickly process any refreshes etc. during Yield ====== */
			
			// Calculate milliseconds duration of Yield; eg. if Yield has a max of 10ms
			//	to complete in, and it consumes 6ms, only delay next FDE cycles loop
			//	for 4ms - the remaining time ( until setTimeout elapses ) the JavaScript interpreter will be
			//	dormant, so the DOM can refresh & send events etc.
			millisecsPauseForYield = millisecsYield - (new Date().getTime() - ticksYieldStart);
			//if (top.status===undefined || millisecsPauseForYield < top.status )
			//top.status = millisecsPauseForYield;
			
			// Special case ( hopefully rare ) where Yield took longer than scheduled
			if ( millisecsPauseForYield < 0 ) {
				// Delay FDE cycles loop start until next scheduled Yield ( ie. skip the next FDE cycles loop )
				millisecsPauseForYield = millisecsPerSlice + Math.max(-millisecsPerSlice, millisecsPauseForYield);
				// This indicates incorrect settings as emulator cannot cope, so inform user
				$.warning("CPU.exec() :: Yield Manager - FDE cycles loop delayed until next scheduled yield"
					+ "\n- consider lowering IPS?");
			}
			
			// Wait for max. Yield duration before attempting to continue
			//	to allow DOM to update & send events, etc.
			window.setTimeout(yieldManager, millisecsPauseForYield);
		};
		/* ======= /Yield management closure ======= */
		// Don't start yield manager immediately; allow rest of BIOS POST to continue first
		window.setTimeout(yieldManager, 0);
	};
	
	// Private method; start next set of Fetch-Decode-Execute cycles up until next Yield is scheduled
	x86Emu.x86CPU.prototype.fetchDecodeExecute = function () {
		var machine = this.machine, dram = machine.dram
			, idx, list, len
		// Address- & operand-size (not the attributes, the calc'd byte sizes)
			, sizeAddress, sizeOperand
		// CPU's instruction cache (for speed... !)
			, arr_insnCache = this.arr_insnCache
			, byt, bytModRM
		//	, colOpcodeMap
			, dataOpcode
			, fieldMod, fieldReg, fieldRM
			, insn
			, repeat = ""
			, nameInstruction = ""
			, nameMapFlags
			, offset, offsetStart
			, textASM
			, reg_segment
			, idx_insn
			, tmr
			, ticksNow
		// Cache class references for speed
			, Instruction = x86Emu.Instruction
			, Operand = x86Emu.Operand;
		
		// After testing, current JS engines execute code significantly faster
		//	if it is looped over; unrolling large ( eg. several thousand ) Instructions
		//	into the equivalent JS commands for eval()ing is extremely slow
		// ( NB: see experiment results ( at top ) for why this is the optimum loop construct here. )
		for ( idx_insn = 0 ; idx_insn < num_max_insnPerSlice && !this.isHalted ; ++idx_insn ) {
			// Resets for cached & uncached instructions (keep to a minimum!!)
			repeat = "";
			
			// Offset is current absolute Instruction address
			offset = (this.CS.get() << 4) + this.EIP.get();
			
			// Common case; Cache miss - Instruction not yet decoded into Instruction cache
			//	TODO: detect ( on memory writes ) whether that byte in RAM has been decoded,
			//	if so code is polymorphic, so ( for now ) just delete rest of cache after the changed instruction
			//	by setting the length property of the cache array
			if ( /*1||*/!(insn = arr_insnCache[ offset ]) ) {
				// Resets for instruction decoder
				sizeOperand
					= sizeAddress = 2;
				// Don't just set to DS register, because default is SS
				//	for some operands
				reg_segment = null;
				
				// Store start byte offset of instruction: will be needed later
				offsetStart = offset;
				
				/* ====== Process any prefixes ====== */
				//	( NB: see experiment results ( at top ) for why this is the optimum loop construct here. )
				get_prefixes: while ( true ) {
					// Read next byte of code - may be an opcode or a prefix
					byt = dram.memData[ offset ];
					
					// Prefixes
					switch ( byt ) {
					/* ======= Segment overrides ======= */
					case 0x26:
						reg_segment = this.ES;
						break;
					case 0x2E:
						reg_segment = this.CS;
						break;
					case 0x36:
						reg_segment = this.SS;
						break;
					case 0x3E:
						reg_segment = this.DS;
						break;
					case 0x64:
						reg_segment = this.FS;
						break;
					case 0x65:
						reg_segment = this.GS;
						break;
					/* ======= /Segment overrides ======= */
					
					// Operand-Size Attribute
					case 0x66:
						sizeOperand = 4;
						break;
					// Address-Size Attribute
					case 0x67:
						debugger;
						sizeAddress = 4;
						break;
					// Assert LOCK# Signal
					case 0xF0:
						// In multiprocessor environments, this ensures exclusive use of any memory for the
						//	instruction it precedes. Ensures atomic operations.
						
						// (For now we have no multiprocessor support,
						//	so can safely be ignored.)
						
						break;
					// REPNE - String repeat operation
					case 0xF2:
						repeat = "#REPNE";
						break;
					// REP - String repeat operation
					case 0xF3:
						repeat = "#REP";
						break;
					default:
						break get_prefixes;
					}
					
					++offset; // Skip prefix byte & read next
				}
				/* ====== /Process any prefixes ====== */
				
				// Skip opcode byte
				++offset;
				
				/* ====== Process Opcode Extensions & Escapes ====== */
				
				// 1-byte Opcodes ( may use an extension )
				if ( byt !== 0x0F ) {
					/* ====== Decode ModR/M byte ====== */
					// We may not use ModR/M byte, so don't skip past it after reading
					bytModRM = dram.memData[ offset ];
					fieldMod = bytModRM >> 6;				// Mod field is first 2 bits	( TODO: faster to leave unshifted? )
					fieldReg = (bytModRM >> 3) & 0x07;		// Reg field is second 3 bits ( Reg 2 )
					fieldRM = bytModRM & 0x07;				// Register/Memory field is last 3 bits ( Reg 1 )
					/* ====== /Decode ModR/M byte ====== */
					
					// By default, assume Opcode is a 1-byte unextended; if not found in table,
					//	check Extensions table, using ModR/M Reg field as an Opcode Extension field ( bits )
					if ( !(dataOpcode = this.arr_mapOpcodes_1Byte[ byt ]) ) {
						dataOpcode = this.arr_mapOpcodeExtensions[ (byt << 3) | fieldReg ];
					}
				// 2-byte Opcode Escape (may use reg field as extension)
				} else {
					// Read & then skip next byte of code - 1st was 0Fh
					byt = dram.memData[ offset++ ];
					
					/* ====== Decode ModR/M byte ====== */
					// We may not use ModR/M byte, so don't skip past it after reading
					bytModRM = dram.memData[ offset ];
					fieldMod = bytModRM >> 6;				// Mod field is first 2 bits
					fieldReg = (bytModRM >> 3) & 0x07;		// Reg field is second 3 bits ( Reg 2 )
					fieldRM = bytModRM & 0x07;				// Register/Memory field is last 3 bits ( Reg 1 )
					/* ====== /Decode ModR/M byte ====== */
					
					// By default, assume Opcode is a 2-byte unextended; if not found in table,
					//	check Extensions table, using ModR/M Reg field as an Opcode Extension field ( bits )
					if ( !(dataOpcode = this.arr_mapOpcodes_2Byte[ byt ]) ) {
						dataOpcode = this.arr_mapOpcodeExtensions[ (byt << 3) | fieldReg ];
					}
				}
				/* ====== /Process Opcode Extensions & Escapes ====== */
				
				if ( !dataOpcode ) { debugger; }
				
				// Read ASM mnemonic/name for instruction
				nameInstruction = dataOpcode[ 0 ];
				
				// Create new Instruction and store in cache, indexed by address
				//	for fast lookups later
				insn = arr_insnCache[ offsetStart ]
					= new Instruction( machine, offsetStart, nameInstruction
					, sizeAddress, sizeOperand );
				
				// If repeat prefix was used for a string operation, store it against the Instruction
				insn.repeat = repeat;
				
				// Instruction has operand(s) - (one or none
				//	of dest & src (possibly a third eg. for IMUL),
				//	these may be swapped with direction bit
				//	if present & applicable)
				if ( dataOpcode.length > 1 ) {
					/* ====== Decode first Operand ====== */
					// (already determined it must exist)
					insn.operand1 = new Operand(
						insn					// Give Operand a reference to its parent Instruction
						, offset				// Absolute offset of Operand's first byte
						, byt					// Instruction opcode
						, dataOpcode[ 1 ][ 0 ]	// Flags text for opcode from table
						, reg_segment
						, fieldMod, fieldReg, fieldRM
					);
					// Get offset after finishing decode ( move past Operand's bytes )
					offset = insn.operand1.offset;
					/* ====== /Decode first Operand ====== */
					
					// Check whether Instruction uses a second Operand
					if ( dataOpcode[ 1 ].length > 1 ) {
						/* ====== Decode second Operand ====== */
						insn.operand2 = new Operand(
							insn					// Give Operand a reference to its parent Instruction
							, offset				// Absolute offset of Operand's first byte
							, byt					// Instruction opcode
							, dataOpcode[ 1 ][ 1 ]	// Flags text for opcode from table
							, reg_segment
							, fieldMod, fieldReg, fieldRM
						);
						// Get offset after finishing decode ( move past Operand's bytes )
						offset = insn.operand2.offset;
						/* ====== /Decode second Operand ====== */
						
						/*if ( insn.operand2.isPointer ) {
							insn.operand2.length = insn.operand1.length;
							insn.operand2.mask = x86Emu.generateMask(insn.operand2.length);
						} else if ( insn.operand1.isPointer ) {
							insn.operand1.length = insn.operand2.length;
							insn.operand1.mask = x86Emu.generateMask(insn.operand1.length);
						}*/
						
						/* ====== Decode third Operand ====== */
						// Check whether Instruction uses a third Operand
						if ( dataOpcode[ 1 ].length > 2 ) {
							insn.operand3 = new Operand(
								insn					// Give Operand a reference to its parent Instruction
								, offset				// Absolute offset of Operand's first byte
								, byt					// Instruction opcode
								, dataOpcode[ 1 ][ 2 ]	// Flags text for opcode from table
								, reg_segment
								, fieldMod, fieldReg, fieldRM
							);
							// Get offset after finishing decode ( move past Operand's bytes )
							offset = insn.operand3.offset;
						}
						/* ====== /Decode third Operand ====== */
					}
				}
				
				// Calculate length of Instruction in bytes
				insn.lenBytes = offset - offsetStart;
			// Less common case; instruction already decoded, just read from Instruction cache & exec
			} else {
				// Move pointer past Instruction
				offset += insn.lenBytes;
			}
			
			/* ===== Build text ASM representation of Instruction ===== */
			textASM = "";
			if ( insn.repeat ) {
				textASM += insn.repeat + " ";
			}
			textASM += insn.name;
			if ( insn.operand1 ) {
				textASM += " " + insn.operand1.getASMText();
			}
			if ( insn.operand2 ) {
				textASM += ", " + insn.operand2.getASMText();
			}
			if ( insn.operand3 ) {
				textASM += ", " + insn.operand3.getASMText();
			}
			/* ===== /Build text ASM representation of Instruction ===== */
			
			//if ( this.IP.get() === 0xE0C9 ) { debugger; }
			//if ( this.IP.get() === 0x05F4 ) { debugger; }
			//if ( this.IP.get() === 0x0DB1 && this.AX.get() <= 0x10FF ) { debugger; }
			
			//
			//if ( insn.offset === 0xF0DD6 ) { debugger; }
			
			// Skip (slow) flush of incoming keys
			//	in BIOS-bochs-legacy keyboard_init() (line 1685+)
			if ( insn.offset === 0xF0DAC ) { this.AX.set(0x0F); }
			
			//if ( this.IP.get() === 0x0D4E ) { debugger; }	// BIOS push 's'
			//if ( this.IP.get() === 0x05F9 ) { debugger; }
			//if ( this.IP.get() === 0x0660 ) { debugger; }	// BIOS send()
			if ( this.IP.get() === 0xE0C6 ) { debugger; }	// _log_bios_start
			//if ( this.IP.get() === 0xE0C9 ) { debugger; }	// post_init_ivt
			//if ( this.IP.get() === 0xE1F2 ) { debugger; }	// Video INT setup
			//if ( this.IP.get() === 0x09A4 ) { debugger; }	// bios_printf() begin
			/*if ( this.IP.get() === 0x09A7 ) { debugger; }	// bios_printf() [add sp, -016h]
			if ( this.IP.get() === 0x09AD ) { debugger; }	// bios_printf() just after LEA (&)
			if ( this.IP.get() === 0x09DE ) { debugger; }	// Recursive bios_printf() call
			if ( this.IP.get() === 0x0CC0 ) { debugger; }	// bios_printf() [if (c == 's')]
			if ( this.IP.get() === 0x0D23 ) { debugger; }*/	// bios_printf() BX_PANIC "unknown format"
			//if ( this.IP.get() === 0x0D60 && this.ZF.get() ) { debugger; }	// bios_printf() jmp after while() test
			//if ( this.IP.get() === 0x0877 ) { debugger; }	// put_str() begin
			
			// Execute immediately
			this.EIP.set(offset - (this.CS.get() << 4));
			// if ( !insn.execute ) { debugger; }	// DEBUG: Support check
			insn.execute();
			
			// Bypass put_str() bug (bug in emulator!!!)
			//if ( this.IP.get() === 0x0877 ) { this.IP.set(0x08AA); }
			
			// Bypass infinite loop in BIOS-bochs-legacy bios_printf (!!!!)
			//if ( this.IP.get() === 0x09E4 ) { this.IP.set(0x0D64); }
			//if ( this.IP.get() === 0x09EA ) { debugger; }
			
			// Skip BIOS-bochs-legacy keyboard_init()
			if ( this.IP.get() === 0xE134 ) { this.IP.set(0xE137); }
			// Skip BIOS-bochs-legacy Parallel & Serial setups
			if ( this.IP.get() === 0xE143 ) { this.IP.set(0xE1B3); }
			// Skip BIOS-bochs-legacy _ata_detect()
			if ( this.IP.get() === 0xE21C ) { this.IP.set(0xE21F); }
			// Skip BIOS-bochs-legacy _interactive_bootkey()
			if ( this.IP.get() === 0xE22E ) { this.IP.set(0xE231); }
			
			//if ( this.IP.get() === 0xE21C ) { debugger; }
			
			//DEBUG_LIST_INSN.push(insn);
			
			// Not a registered interrupt... TESTING CHECK
			//var PC = ((this.CS.get() << 4) + this.EIP.get());
			//if ( PC > 0xFFFF0 ) {
				//debugger;
			//}
			
			/* ===== System timers ===== */
			// NB/TODO!: This is INCREDIBLY inefficient;
			//	checking for expired timers after EVERY SINGLE INSTRUCTION
			//	is not a good idea.
			ticksNow = new Date().getTime();
			for ( idx = 0, list = machine.list_tmr, len = list.length
					; idx < len ; ++idx ) {
				// Ignore if unreg'd or inactive
				if ( !(tmr = list[ idx ]) || !tmr.isActive ) { continue; }
				
				// Timer has expired: fire its handler!
				if ( tmr.ticksNextFire <= ticksNow ) {
					tmr.fn(tmr.obj_this, ticksNow);
					// Continuous timers need their next expiry time calculating
					if ( tmr.isContinuous ) {
						tmr.ticksNextFire = ticksNow + tmr.intervalUsecs / 1000;
					// One-shot timers become deactivated after firing,
					//	to ensure they do not trigger again
					} else {
						tmr.isActive = false;
					}
				}
			}
			/* ===== /System timers ===== */
		} // End of CPU loop => num_max_insnPerSlice
		
		/*** CPU has yielded: now is a good time to handle asynchronous events
			(ie. those occurring parallel to CPU, eg. IRQs & DMA) ***/
		this.handleAsynchronousEvents();
		
		/** Now handle all bits which are synchronous to instruction execution,
			ie. happen at the same time **/
		this.handleSynchronousEvents();
		
		// End of CPU loop: yield to host environment/the browser,
		//	allowing it to update the screen & fire DOM events etc.
	};
	// See end of .fetchDecodeExecute() / CPU loop
	x86Emu.x86CPU.prototype.handleAsynchronousEvents = function () {
		var machine = this.machine;
		
		/*
		 *	Priority 1: Hardware Reset and Machine Checks
		 *	- RESET
		 *	- Machine Check
		 *	(NB: As in Bochs, jemul8 doesn't support these)
		 */
		
		/*
		 *	Priority 2: Trap on Task Switch
		 *	- T flag in TSS is set
		 */
		//if (BX_CPU_THIS_PTR debug_trap & BX_DEBUG_TRAP_TASK_SWITCH_BIT)
		//	exception(BX_DB_EXCEPTION, 0); // no error, not interrupt
		
		/*
		 *	Priority 3: External Hardware Interventions
		 *	- FLUSH
		 *	- STOPCLK
		 *	- SMI
		 *	- INIT
		 */
		//if (BX_CPU_THIS_PTR pending_SMI && ! BX_CPU_THIS_PTR smm_mode()) {
			// clear SMI pending flag and disable NMI when SMM was accepted
		//	BX_CPU_THIS_PTR pending_SMI = 0;
		//	enter_system_management_mode();
		//}
		//if (BX_CPU_THIS_PTR pending_INIT && ! BX_CPU_THIS_PTR disable_INIT) {
		//	#if BX_SUPPORT_VMX
		//	if (BX_CPU_THIS_PTR in_vmx_guest) {
		//	BX_ERROR(("VMEXIT: INIT pin asserted"));
		//	VMexit(0, VMX_VMEXIT_INIT, 0);
		//	}
		//	#endif
			// reset will clear pending INIT
		//	BX_CPU_THIS_PTR reset(BX_RESET_SOFTWARE);
		//}
		
		/*
		 *	Priority 4: Traps on Previous Instruction
		 *	- Breakpoints
		 *	- Debug Trap Exceptions (TF flag set or data/IO breakpoint)
		 */
		//if (BX_CPU_THIS_PTR debug_trap &&
		//	!(BX_CPU_THIS_PTR inhibit_mask & BX_INHIBIT_DEBUG_SHADOW)){
			// A trap may be inhibited on this boundary due to an instruction
			// which loaded SS.  If so we clear the inhibit_mask below
			// and don't execute this code until the next boundary.
		//	exception(BX_DB_EXCEPTION, 0); // no error, not interrupt
		//}
		
		/*
		 *	Priority 5: External Interrupts
		 *	- NMI Interrupts
		 *	- Maskable Hardware Interrupts
		 */
		var vector;
		/* ====== Hardware Interrupts / IRQs ====== */
		if ( this.isNMIPending ) {
			this.isNMIPending = false; // Will be handled now
			this.interrupt(2); // NMI is always INT #2
		// Check interrupts are enabled/uninhibited & one is pending
		} else if ( this.INTR.get() && this.IF.get() ) {
			// (NB: This may set INTR with the next interrupt)
			vector = machine.pic.acknowledgeInterrupt();
			this.interrupt(vector);
		// Handle DMA
		} else if ( machine.HRQ.get() ) {
			// Assert Hold Acknowledge (HLDA) and go into a bus hold state
			machine.raiseHLDA();
		}
		/* ====== /Hardware Interrupts / IRQs ====== */
		
		/*
		 *	Priority 6: Faults from fetching next instruction
		 *	- Code breakpoint fault
		 *	- Code segment limit violation (priority 7 on 486/Pentium)
		 *	- Code page fault (priority 7 on 486/Pentium)
		 */
		// (handled in main decode loop)
		
		/*
		 *	Priority 7: Faults from decoding next instruction
		 *	- Instruction length > 15 bytes
		 *	- Illegal opcode
		 *	- Coprocessor not available
		 */
		// (handled in main decode loop etc)
		
		/*
		 *	Priority 8: Faults on executing an instruction
		 *	- Floating point execution
		 *	- Overflow
		 *	- Bound error
		 *	- Invalid TSS
		 *	- Segment not present
		 *	- Stack fault
		 *	- General protection
		 *	- Data page fault
		 *	- Alignment check
		 */
		// (handled by rest of the code)
	};
	// See end of .fetchDecodeExecute() / CPU loop
	x86Emu.x86CPU.prototype.handleSynchronousEvents = function () {
		// Resume Flag
		if ( this.RF.get() ) {
			this.RF.clear();
		} else {
			// TODO: Handle debugging/breakpoints etc.
		}
		
		// Trap Flag
		if ( this.TF.get() ) {
			// TODO: Handle debugging w/trap flag
		}
	};
});
