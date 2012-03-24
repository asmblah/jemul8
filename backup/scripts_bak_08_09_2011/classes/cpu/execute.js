/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: CPU Instruction class support
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("cpu/execute", function ( $ ) { "use strict";
	var jemul8 = this.data("jemul8")
		, DEBUG_LIST_INSN = [];
	
	// Set up the CPU - start fetch/execute cycle etc.
	jemul8.x86CPU.prototype.init = function () {
		var machine = this.machine, cpu = this;
		
		function yieldManager() {
			var ticksYieldStart, msPauseForYield;
			// Start next set of Fetch-Decode-Execute cycles if CPU is not halted
			//	(will run until next Yield)
			if ( !cpu.isHalted ) {
				cpu.fetchDecodeExecute();
			}
			
			// Log exact time in milliseconds that Yield started at
			ticksYieldStart = machine.getTimeMsecs();
			
			/* ====== Quickly process any refreshes etc. during Yield ====== */
			// Handle DMA
			if ( machine.HRQ.get() ) {
				// Assert Hold Acknowledge (HLDA) and go into a bus hold state
				machine.dma.raiseHLDA();
			}
			//jemul8.screen.Refresh();
			/* ====== /Quickly process any refreshes etc. during Yield ====== */
			
			/*
			 *	Calculate milliseconds duration of Yield;
			 *	 eg. if Yield has a max of 10ms
			 *	 to complete in, and it consumes 6ms,
			 *	 only delay next FDE cycles loop
			 *	 for 4ms - the remaining time (until setTimeout elapses)
			 *	 the JavaScript interpreter will be dormant, so the DOM
			 *	 can refresh & send events etc.
			 */
			msPauseForYield
				= cpu.msPerYield - (machine.getTimeMsecs() - ticksYieldStart);
			
			// Special case (hopefully rare) where Yield
			//	took longer than scheduled
			if ( msPauseForYield < 0 ) {
				// Delay FDE cycles loop start until next scheduled Yield
				//	(ie. skip the next FDE cycles loop)
				msPauseForYield = cpu.msPerSlice
					+ Math.max(-cpu.msPerSlice, msPauseForYield);
				// This indicates incorrect settings as emulator cannot cope,
				//	so inform user & adjust
				jemul8.warning("CPU.exec() :: Yield Manager - FDE cycles loop"
					+ " delayed until next scheduled yield\n"
					+ " - consider lowering IPS?");
			}
			
			// Wait for max. Yield duration before attempting to continue
			//	to allow DOM to update & send events, etc.
			window.setTimeout(yieldManager, msPauseForYield);
		}
		
		// Reset CPU to initial power-up state, ready for boot
		this.reset();
		
		// Don't start yield manager immediately; finish setup first
		window.setTimeout(yieldManager, 0);
	};
	
	// Private method; start next set of Fetch-Decode-Execute cycles up until next Yield is scheduled
	jemul8.x86CPU.prototype.fetchDecodeExecute = function () {
		var machine = this.machine
			, idx, list, len
		// Address- & operand-size (not the attributes, the calc'd byte sizes)
			, sizeAddress, sizeOperand
		// CPU's instruction cache (for speed... !)
			, cache_insn = this.cache_insn
			, byt, bytModRM
			, dataOpcode
			, fieldMod, fieldReg, fieldRM
			, insn, repeat
			, accessorCode = this.accessorCode
			, offset, offsetStart
			, textASM
			, reg_segment, CS = this.CS
			, idx_insn, max_insnsPerSlice = this.max_insnsPerSlice
			, tmr
			, ticksEndSlice = machine.getTimeMsecs() + this.msPerSlice, ticksNow
		// Cache class references for speed
			, Instruction = jemul8.Instruction
			, Operand = jemul8.Operand;
		
		// After testing, current JS engines execute code significantly faster
		//	if it is looped over; unrolling large (eg. several thousand)
		//	Instructions into the equivalent JS commands for eval()ing
		//	(ie. a recompiler approach) is extremely slow
		// (NB: see experiment results (at top) for why this is
		//	the optimum loop construct here.)
		for ( idx_insn = 0
		; idx_insn < max_insnsPerSlice && !this.isHalted ; ++idx_insn ) {
			// Resets for cached & uncached instructions (keep to a minimum!!)
			/** (None) **/
			
			// Offset is current Instruction Pointer
			offset = this.EIP.get();
			
			/*
			 *	Fast case; Cache hit - Instruction already decoded
			 *	into Instruction cache, just read from Instruction cache & exec
			 *	
			 *	NB: Cache is cleared when CS register is set
			 *	
			 *	TODO: detect (on memory writes) whether that byte in RAM
			 *	has been decoded, if so code is polymorphic, so (for now)
			 *	just delete rest of cache after the changed instruction
			 *	by setting the length property of the cache array
			 */
			if ( insn = cache_insn[ offset ] ) {
				// Move pointer past Instruction
				offset += insn.lenBytes;
			// Instruction needs to be decoded into cache
			} else {
				// Resets for instruction decoder
				sizeOperand
					= sizeAddress = 2;
				// Don't just set to DS register, because default is SS
				//	for some operands
				reg_segment = null;
				repeat = ""; // REPNE etc.
				
				// Store start byte offset of instruction: will be needed later
				offsetStart = offset;
				
				/* ====== Process any prefixes ====== */
				// (NB: see experiment results (at top) for why
				//	this is the optimum loop construct here.)
				get_prefixes: while ( true ) {
					// Read next byte of code - may be an opcode or a prefix
					byt = CS.readSegment(offset, 1);
					
					// Prefixes
					switch ( byt ) {
					// Segment overrides
					case 0x26: reg_segment = this.ES; break;
					case 0x2E: reg_segment = this.CS; break;
					case 0x36: reg_segment = this.SS; break;
					case 0x3E: reg_segment = this.DS; break;
					case 0x64: reg_segment = this.FS; break;
					case 0x65: reg_segment = this.GS; break;
					
					// Operand-Size Attribute
					case 0x66: sizeOperand = 4; break;
					// Address-Size Attribute
					case 0x67: debugger; sizeAddress = 4; break;
					// Assert LOCK# Signal
					/*
					 *	In multiprocessor environments, this ensures
					 *	exclusive use of any memory for the instruction
					 *	it precedes. Ensures atomic operations.
					 *	(For now we have no multiprocessor support,
					 *	so can safely be ignored.)
					 */
					case 0xF0: break;
					// REPNE - String repeat operation
					case 0xF2: repeat = "#REPNE"; break;
					// REP - String repeat operation
					case 0xF3: repeat = "#REP"; break;
					// Immediately exit prefix loop when we encounter
					//	a non-prefix byte
					default:
						break get_prefixes;
					}
					++offset; // Skip prefix byte & read next
				}
				/* ====== /Process any prefixes ====== */
				
				// Skip opcode byte (read by prefix loop above)
				++offset;
				
				/* ====== Process Opcode Extensions & Escapes ====== */
				
				// 1-byte Opcodes (may use an extension)
				if ( byt !== 0x0F ) {
					/* ====== Decode ModR/M byte ====== */
					// We may not use ModR/M byte, so don't skip past it after reading
					bytModRM = CS.readSegment(offset, 1);
					fieldMod = bytModRM >> 6;				// Mod field is first 2 bits (TODO: faster to leave unshifted?)
					fieldReg = (bytModRM >> 3) & 0x07;		// Reg field is second 3 bits (Reg 2)
					fieldRM = bytModRM & 0x07;				// Register/Memory field is last 3 bits (Reg 1)
					/* ====== /Decode ModR/M byte ====== */
					
					// By default, assume Opcode is a 1-byte unextended; if not found in table,
					//	check Extensions table, using ModR/M Reg field as an Opcode Extension field (bits)
					if ( !(dataOpcode = this.arr_mapOpcodes_1Byte[ byt ]) ) {
						dataOpcode = this.arr_mapOpcodeExtensions[ (byt << 3) | fieldReg ];
					}
				// 2-byte Opcode Escape (may use reg field as extension)
				} else {
					// Read & then skip next byte of code - 1st was 0Fh
					byt = CS.readSegment(offset++, 1);
					
					/* ====== Decode ModR/M byte ====== */
					// We may not use ModR/M byte, so don't skip past it after reading
					bytModRM = CS.readSegment(offset, 1);
					fieldMod = bytModRM >> 6;				// Mod field is first 2 bits
					fieldReg = (bytModRM >> 3) & 0x07;		// Reg field is second 3 bits (Reg 2)
					fieldRM = bytModRM & 0x07;				// Register/Memory field is last 3 bits (Reg 1)
					/* ====== /Decode ModR/M byte ====== */
					
					// By default, assume Opcode is a 2-byte unextended; if not found in table,
					//	check Extensions table, using ModR/M Reg field as an Opcode Extension field (bits)
					if ( !(dataOpcode = this.arr_mapOpcodes_2Byte[ byt ]) ) {
						dataOpcode = this.arr_mapOpcodeExtensions[ (byt << 3) | fieldReg ];
					}
				}
				/* ====== /Process Opcode Extensions & Escapes ====== */
				
				//if ( !dataOpcode ) { debugger; }
				
				// Create new Instruction and store in cache, indexed by address
				//	for fast lookups later
				insn = cache_insn[ offsetStart ]
					= new Instruction( machine, offsetStart
					, dataOpcode[ 0 ] // (For now) Instruction's name/mnemonic
					, sizeAddress, sizeOperand );
				
				// If repeat prefix was used for a string operation,
				//	store it against the Instruction
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
						, offset				// Offset of Operand's first byte
						, byt					// Instruction opcode
						, dataOpcode[ 1 ][ 0 ]	// Flags text for opcode from table
						, reg_segment
						, fieldMod, fieldReg, fieldRM
					);
					// Get offset after finishing decode (move past Operand's bytes)
					offset = insn.operand1.offset;
					/* ====== /Decode first Operand ====== */
					
					// Check whether Instruction uses a second Operand
					if ( dataOpcode[ 1 ].length > 1 ) {
						/* ====== Decode second Operand ====== */
						insn.operand2 = new Operand(
							insn					// Give Operand a reference to its parent Instruction
							, offset				// Offset of Operand's first byte
							, byt					// Instruction opcode
							, dataOpcode[ 1 ][ 1 ]	// Flags text for opcode from table
							, reg_segment
							, fieldMod, fieldReg, fieldRM
						);
						// Get offset after finishing decode (move past Operand's bytes)
						offset = insn.operand2.offset;
						/* ====== /Decode second Operand ====== */
						
						/* ====== Decode third Operand ====== */
						// Check whether Instruction uses a third Operand
						if ( dataOpcode[ 1 ].length > 2 ) {
							insn.operand3 = new Operand(
								insn					// Give Operand a reference to its parent Instruction
								, offset				// Offset of Operand's first byte
								, byt					// Instruction opcode
								, dataOpcode[ 1 ][ 2 ]	// Flags text for opcode from table
								, reg_segment
								, fieldMod, fieldReg, fieldRM
							);
							// Get offset after finishing decode (move past Operand's bytes)
							offset = insn.operand3.offset;
						}
						/* ====== /Decode third Operand ====== */
					}
					
					// Operand-size is destination operand's length
					//	if not memory (operand 1 is definitely present here)
					if ( !insn.operand1.isPointer || !insn.operand2 ) {
						insn.sizeOperand = insn.operand1.length;
					// Otherwise use operand 2 (if present)
					} else if ( insn.operand2 && !insn.operand2.isPointer ) {
						insn.sizeOperand = insn.operand2.length;
					// ... or operand 3 (if present)
					} else if ( insn.operand3 && !insn.operand3.isPointer ) {
						insn.sizeOperand = insn.operand3.length;
					}
					/** If none of the above apply, operand-size is left
						as its default value **/
					
					insn.mask_sizeOperand
						= jemul8.generateMask(insn.sizeOperand);
				}
				
				// Calculate length of Instruction in bytes
				insn.lenBytes = offset - offsetStart;
			}
			
			/** For debugging **/
			// textASM = insn.getASMText();
			
			// Skip (slow) flush of incoming keys
			//	in BIOS-bochs-legacy keyboard_init() (line 1685+)
			if ( CS.get() === 0xF000 && insn.offset === 0x0DAC ) { this.AX.set(0x0F); }
			
			//if ( this.IP.get() === 0x0D4E ) { debugger; }	// BIOS push 's'
			//if ( this.IP.get() === 0x05F9 ) { debugger; }
			//if ( this.IP.get() === 0x0660 ) { debugger; }	// BIOS send()
			//if ( this.IP.get() === 0xE0C6 ) { debugger; }	// _log_bios_start
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
			//if ( this.IP.get() === 0xB8D4 ) { debugger; }	// pcibios_init_sel_reg() begin
			//if ( this.IP.get() === 0xB8EC ) { debugger; }	// [pop eax] in pcibios_init_sel_reg
			//if ( this.IP.get() === 0xBB70 ) { debugger; }	// rom_scan() begin
			//if ( this.IP.get() === 0xBBA6 ) { debugger; }	// [callf] in rom_scan() ROM init
			//if ( this.IP.get() === 0xBBA8 ) { debugger; }	// [callf] in rom_scan()
			//if ( this.IP.get() === 0xBBAB ) { debugger; }	// [cli] in rom_scan()
			//if ( this.IP.get() === 0xBBDA ) { debugger; }	// [callf] in rom_scan() ROM BCV
			//if ( this.IP.get() === 0xBC27 ) { debugger; }	// [jbe] in rom_scan()
			//if ( this.IP.get() === 0xBC30 ) { debugger; }	// End of rom_scan()
			//if ( this.IP.get() === 0x0FC7 ) { debugger; }	//
			
			// In VGABIOS
			if ( this.CS.get() === 0xC000 ) {
				// vgabios_int10_handler()
				//if ( this.IP.get() === 0x012C ) { debugger; } // Entry [pushf]
				//if ( this.IP.get() === 0x01E6 ) { debugger; } // int10_normal: [push es]
				
				// display_string()
				//if ( this.IP.get() === 0x362E ) { debugger; } // Entry [mov ax, ds]
				
				// _int10_func()
				//if ( this.IP.get() === 0x3655
				//	&& this.AH.get() === 0x13 ) { debugger; } // Entry [push bp]
				//if ( this.IP.get() === 0x3B47 ) { debugger; } // switch() lookup [jmp]
				//if ( this.IP.get() === 0x39E5 ) { debugger; } // [case 0x13 in switch()]
				//if ( this.IP.get() === 0x3A10 ) { debugger; } // call to biosfn_write_string()
				//if ( this.IP.get() === 0x3A13 ) { debugger; } // after call
				
				// biosfn_write_teletype()
				//if ( this.IP.get() === 0x5E87 ) { debugger; }
				//if ( this.IP.get() === 0x5ECF ) { debugger; } // [lea] for biosfn_get_cursor_pos()
				//if ( this.IP.get() === 0x5F46 ) { debugger; } // [case '\t':] in switch(car)
				
				// biosfn_write_string()
				//if ( this.IP.get() === 0x6C9E ) { debugger; } // Entry
				//if ( this.IP.get() === 0x6CB5 ) { debugger; } // after biosfn_get_cursor_pos() call
				//if ( this.IP.get() === 0x6CFB ) { debugger; } // after 1st biosfn_set_cursor_pos() call
				//if ( this.IP.get() === 0x6D4F ) { debugger; } // cond @ e/o while() loop
				
				// biosfn_save_video_state()
				//if ( this.IP.get() >= 0x6F4D && this.IP.get() <= 0x7516 ) { debugger; }
				//if ( this.IP.get() === 0x6F4D ) { debugger; } // Entry [push bp]
				//if ( this.IP.get() === 0x7516 ) { debugger; } // Exit [retn]
			}
			
			//if ( textASM === "ADD DS:[BX+SI], AL" ) { debugger; }
			
			// Execute immediately
			this.EIP.set(offset);// - (this.CS.get() << 4));
			// if ( !insn.execute ) { debugger; }	// DEBUG: Support check
			insn.execute(this);
			
			//if ( this.EIP.get() === 0xF000 ) { debugger; }
			
			// Bypass put_str() bug (bug in emulator!!!)
			//if ( this.IP.get() === 0x0877 ) { this.IP.set(0x08AA); }
			
			// Bypass infinite loop in BIOS-bochs-legacy bios_printf (!!!!)
			//if ( this.IP.get() === 0x09E4 ) { this.IP.set(0x0D64); }
			//if ( this.IP.get() === 0x09EA ) { debugger; }
			
			if ( this.CS.get() === 0xF000 ) {
				// Skip BIOS-bochs-legacy keyboard_init()
				//if ( this.IP.get() === 0xE134 ) { this.IP.set(0xE137); }
				// Skip BIOS-bochs-legacy Parallel & Serial setups
				if ( this.IP.get() === 0xE143 ) { this.IP.set(0xE1B3); }
				// Skip BIOS-bochs-legacy _ata_detect()
				if ( this.IP.get() === 0xE21C ) { this.IP.set(0xE21F); }
				// Skip BIOS-bochs-legacy _init_boot_vectors()
				if ( this.IP.get() === 0xE222 ) { this.IP.set(0xE225); }
				// Skip BIOS-bochs-legacy _interactive_bootkey()
				if ( this.IP.get() === 0xE22E ) { this.IP.set(0xE231); }
			}
			
			// VGABIOS INT 10h handler
			//if ( this.CS.get() === 0xC000 && this.IP.get() === 0x3B39 ) { debugger; }
			
			
			
			//DEBUG_LIST_INSN.push(insn);
			
			// Not a registered interrupt... TESTING CHECK
			//var PC = ((this.CS.get() << 4) + this.EIP.get());
			//if ( PC > 0xFFFF0 ) {
				//debugger;
			//}
			
			// Stop CPU loop for this slice if we run out of time
			if ( Date.now() > ticksEndSlice ) {
				//break;
			}
		} // End of CPU loop => max_insnsPerSlice
		
		/* ===== System timers ===== */
		// NB/TODO!: Checking for expired timers after EVERY SINGLE INSTRUCTION
		//	is not a good idea: however, only checking once per yield
		//	may not be often enough!
		ticksNow = machine.getTimeMsecs();
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
	jemul8.x86CPU.prototype.handleAsynchronousEvents = function () {
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
		if ( this.NMI.get() ) {
			this.NMI.lower(); // Will be handled now
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
	jemul8.x86CPU.prototype.handleSynchronousEvents = function () {
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
