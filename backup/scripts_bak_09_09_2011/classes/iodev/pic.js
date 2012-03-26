/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: 8259 PIC (Programmable Interrupt Controller) chip class support
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("iodev/pic", function ( $ ) { "use strict";
	var jemul8 = this.data("jemul8");
	
	/* ====== Private ====== */
	
	/* ==== Const ==== */
	
	/* ==== /Const ==== */
	
	// Constructor / pre-init ( ie. from bx_pic_c::init(void) )
	function PIC( machine ) {
		jemul8.assert(this && (this instanceof PIC), "PIC ctor ::"
			+ " error - constructor not called properly");
		
		var idx, state;
		var core;
		
		/** 8259 PIC **/
		
		jemul8.info("PIC (Intel 8259) PreInit");
		
		this.machine = machine;
		
		// PIC's current state information
		state = this.state = {
			PICmaster: null
			, PICslave: null
		};
		
		// The master PIC
		core = state.PICmaster = new PIC_Core( this, true );
		core.isSingle = false;
		// IRQ0 = INT 0x08
		core.offsetInterrupt = 0x08;
		// Slave PIC is connected to IRQ2 of master
		core.maskSlaveConnect = 0x04;
		core.regInterruptMask.set(0xFF); // All IRQs initially masked
		core.regInService.set(0x00); // No IRQs in service
		core.regInterruptRequest.set(0x00); // No IRQs requested
		core.irqLowestPriority = 7;
		
		// The slave PIC
		core = state.PICslave = new PIC_Core( this, false );
		core.isSingle = false;
		// IRQ8 = INT 0x70
		core.offsetInterrupt = 0x70;
		// Slave PIC is connected to IRQ2 of master
		core.idSlave = 0x02;
		core.regInterruptMask.set(0xFF); // All IRQs initially masked
		core.regInService.set(0x00); // No IRQs in service
		core.regInterruptRequest.set(0x00); // No IRQs requested
		core.irqLowestPriority = 7;
	}
	// Methods based on Bochs /iodev/pic.h & pic.cc
	$.inherit(PIC, jemul8.IODevice, "PIC"); // Inheritance
	PIC.prototype.init = function () {
		var state = this.state;
		
		// I/O port addresses used
		this.registerIO_Read(0x0020, "8259 PIC", readHandler, 1);
		this.registerIO_Read(0x0021, "8259 PIC", readHandler, 1);
		this.registerIO_Read(0x00A0, "8259 PIC", readHandler, 1);
		this.registerIO_Read(0x00A1, "8259 PIC", readHandler, 1);
		this.registerIO_Write(0x0020, "8259 PIC", writeHandler, 1);
		this.registerIO_Write(0x0021, "8259 PIC", writeHandler, 1);
		this.registerIO_Write(0x00A0, "8259 PIC", writeHandler, 1);
		this.registerIO_Write(0x00A1, "8259 PIC", writeHandler, 1);
	};
	PIC.prototype.reset = function ( type ) {
		// Nothing to do
	};
	PIC.prototype.registerState = function () {
		var state = this.state;
		
		// ?
	};
	PIC.prototype.afterRestoreState = function () {
		var state = this.state;
		
		// ?
	};
	// As per Bochs /iodev/pic.cc
	PIC.prototype.lowerIRQ = function ( irq ) {
		var state = this.state;
		
		// TODO: Forward to APIC too (when it is implemented...)
		
		var mask = (1 << (irq & 7));
		// Master PIC handles IRQs <= 7
		if ( (irq <= 7) && (state.PICmaster.inIRQ & mask) ) {
			jemul8.debug("PIC.lowerIRQ() :: IRQ line #"
				+ irq + " (master PIC) now low");
			state.PICmaster.inIRQ &= ~(mask); // Clear bit
			state.PICmaster.regInterruptRequest.set(
				state.PICmaster.regInterruptRequest.get() & (~(mask)));
		// Slave PIC handles IRQs 8 -> 15
		} else if ( (irq > 7) && (irq <= 15)
				&& (state.PICslave.inIRQ & mask) ) {
			jemul8.debug("PIC.lowerIRQ() :: IRQ line #"
				+ irq + " (slave PIC) now low");
			state.PICslave.inIRQ &= ~(mask); // Clear bit
			state.PICslave.regInterruptRequest.set(
				state.PICslave.regInterruptRequest.get() & (~(mask)));
		}
	};
	// As per Bochs /iodev/pic.cc
	PIC.prototype.raiseIRQ = function ( irq ) {
		var state = this.state;
		
		// TODO: Forward to APIC too (when it is implemented...)
		
		var mask = (1 << (irq & 7));
		// Master PIC handles IRQs <= 7
		if ( (irq <= 7) && !(state.PICmaster.inIRQ & mask) ) {
			jemul8.debug("PIC.raiseIRQ() :: IRQ line #"
				+ irq + " (master PIC) now high");
			state.PICmaster.inIRQ |= mask; // Set bit
			state.PICmaster.regInterruptRequest.set(
				state.PICmaster.regInterruptRequest.get() | mask);
			state.PICmaster.service();
		// Slave PIC handles IRQs 8 -> 15
		} else if ( (irq > 7) && (irq <= 15)
				&& !(state.PICslave.inIRQ & mask) ) {
			jemul8.debug("PIC.raiseIRQ() :: IRQ line #"
				+ irq + " (slave PIC) now high");
			state.PICslave.inIRQ |= mask; // Set bit
			state.PICslave.regInterruptRequest.set(
				state.PICslave.regInterruptRequest.get() | mask);
			state.PICslave.service();
		}
	};
	PIC.prototype.setMode = function ( forMaster, mode ) {
		var core = forMaster ? this.state.PICmaster : this.state.PICslave;
		jemul8.debug("PIC(" + core.name + ").setMode() ::"
			+ " Setting mode (edge/level) to " + $.format("hex", mode));
		core.modeIRQ = mode;
	};
	// Based on [bx_pic_c::IAC]
	PIC.prototype.acknowledgeInterrupt = function () {
		var machine = this.machine, cpu = machine.cpu
			, state = this.state, PICmaster = state.PICmaster
			, PICslave = state.PICslave
			
			, vector, irq;
		
		cpu.INTR.lower();
		PICmaster.INT.lower();
		
		// Check for spurious (extra/unnecessary) interrupt
		if ( PICmaster.regInterruptRequest.get() === 0 ) {
			return PICmaster.offsetInterrupt + 7;
		}
		// In level-sensitive mode, don't clear the IRR bit
		if ( !(PICmaster.modeIRQ & (1 << PICmaster.irq)) ) {
			PICmaster.regInterruptRequest.set(
				PICmaster.regInterruptRequest.get()
				& (~(1 << PICmaster.irq)));
		}
		// In Auto-EOI mode, don't set the ISR bit
		if ( !PICmaster.useAutoEOI ) {
			PICmaster.regInService.set(PICmaster.regInService.get()
				| (1 << PICmaster.irq));
		} else if ( PICmaster.doRotateOnAutoEOI ) {
			PICmaster.irqLowestPriority = PICmaster.irq;
		}
		
		// Handled by master PIC (non-IRQ2 interrupt)
		if ( PICmaster.irq !== 2 ) {
			irq = PICmaster.irq;
			vector = irq + PICmaster.offsetInterrupt;
		// Handled by slave PIC (IRQ2, slave PIC IRQs 8 -> 15)
		} else {
			// Acknowledge that IRQ from slave has been rec'vd
			PICslave.INT.lower();
			PICmaster.inIRQ &= ~(1 << 2);
			
			// Check for spurious (extra/unnecessary) interrupt
			if ( PICslave.regInterruptRequest.get() === 0 ) {
				return PICslave.offsetInterrupt + 7;
			}
			irq = PICslave.irq;
			vector = irq + PICslave.offsetInterrupt;
			// In level-sensitive mode, don't clear the IRR bit
			if ( !(PICslave.modeIRQ & (1 << PICslave.irq)) ) {
				PICslave.regInterruptRequest.set(
					PICslave.regInterruptRequest.get()
					& (~(1 << PICslave.irq)));
			}
			// In Auto-EOI mode, don't set the ISR bit
			if ( !PICslave.useAutoEOI ) {
				PICslave.regInService.set(PICslave.regInService.get()
					| (1 << PICslave.irq));
			} else if ( PICslave.doRotateOnAutoEOI ) {
				PICslave.irqLowestPriority = PICslave.irq;
			}
			PICslave.service();
			// Slave IRQs start from 8; add this for debugging purposes
			irq += 8;
		}
		
		PICmaster.service();
		
		jemul8.debug("PIC.acknowledgeInterrupt() :: IRQ #" + irq + " acknowledged");
		return vector;
	};
	
	// There are 2 PIC cores: master & slave; this is their class
	function PIC_Core( cntrlr, isMaster ) {
		this.cntrlr = cntrlr;
		
		// False = Cascaded PIC, true = Master only
		this.isSingle = true;
		// PIC vector offset
		this.offsetInterrupt = null;
		/* union */this.maskSlaveConnect; this.idSlave;
		this.modeSpeciallyFullyNested = false; // Normal nested mode
		this.modeBuffered = false; // Unbuffered mode by default
		this.name = isMaster ? "master" : "slave";
		this.isMaster = isMaster;
		this.useAutoEOI = false; // Manual EOI from CPU
		this.regInterruptMask = new jemul8.Register( "IMR", 1 );
		this.regInService = new jemul8.Register( "ISR", 1 );
		this.regInterruptRequest = new jemul8.Register( "IRR", 1 );
		this.regReadSelect = this.regInterruptRequest; // Use IRR
		this.irq = 0;
		this.irqLowestPriority;
		this.INT = new jemul8.Pin( "INT" ); // #INT request pin of PIC
		this.INT.lower();
		this.inIRQ = 0; // IRQ pins of PIC (data-in line)
		this.init = {
			inInit: false
			, requires4: false
			, bytExpected: 0
		};
		this.useSpecialMask = false;
		this.isPolled = false; // Set when "poll" command is issued
		// Dictates when to rotate in Auto-EOI mode
		this.doRotateOnAutoEOI = false;
		this.modeIRQ = 0; // IRQ mode bitmap (bit #0=edge, bit #1=level)
	}
	PIC_Core.prototype.initCommand = function ( val ) {
		var machine = this.cntrlr.machine, cpu = machine.cpu;
		
		// Initialization command 1
		if ( val & 0x10 ) {
			jemul8.debug("PIC(" + this.name + ") writeHandler() ::"
				+ " Init command 1 found");
			jemul8.debug(" -> requires 4 = " + (val & 0x01));
			jemul8.debug(" -> cascade mode: [0=cascade, 1=single] "
				+ ((val & 0x02) >> 1));
			this.init.inInit = 1;
			this.init.requires4 = (val & 0x01);
			this.init.bytExpected = 2; // Operation command 2
			this.regInterruptMask.set(0x00);
			this.regInService.set(0x00); // No IRQ's in service
			this.regInterruptRequest.set(0x00); // No IRQ's requested
			this.irqLowestPriority = 7;
			this.INT.lower(); // Reprogramming clears previous INTR request
			if ( !this.isMaster ) {
				this.inIRQ &= ~(1 << 2);
			}
			this.useAutoEOI = false;
			this.doRotateOnAutoEOI = false;
			if ( val & 0x02 ) { return jemul8.panic("PIC(" + this.name + ")"
				+ " writeHandler() :: ICW1: single mode not supported"); }
			if ( val & 0x08 ) {
				return jemul8.panic("PIC(" + this.name + ") writeHandler() ::"
					+ " ICW1: level sensitive mode not supported");
			} else {
				jemul8.debug("PIC(" + this.name + ") writeHandler() ::"
					+ " ICW1: edge triggered mode selected");
			}
			cpu.INTR.lower();
			return;
		}
		
		// OCW3
		if ( (val & 0x18) === 0x08 ) {
			var special_mask, poll, read_op;
			
			special_mask = (val & 0x60) >> 5;
			poll         = (val & 0x04) >> 2;
			read_op      = (val & 0x03);
			if ( poll ) {
				this.isPolled = 1;
				return;
			}
			// Read IRR
			if ( read_op == 0x02 ) {
				this.regReadSelect = this.regInterruptRequest;
			// Read ISR
			} else if ( read_op == 0x03 ) {
				this.regReadSelect = this.regInService;
			}
			// Cancel special mask
			if ( special_mask == 0x02 ) {
				this.useSpecialMask = false;
			// Set special mask
			} else if ( special_mask == 0x03 ) { /* set specific mask */
				this.useSpecialMask = true;
				this.service();
			}
			return;
		}
		
		// OCW2
		switch ( val ) {
		case 0x00: // Rotate in auto eoi mode clear
		case 0x80: // Rotate in auto eoi mode set
			this.doRotateOnAutoEOI = (val != 0);
			break;
		case 0x0A: // Select read interrupt request register
			this.regReadSelect = this.regInterruptRequest;
			break;
		case 0x0B: // Select read interrupt in-service register
			this.regReadSelect = this.regInService;
			break;
		case 0xA0: // Rotate on non-specific end of interrupt
		case 0x20: // End of interrupt command
			this.clearHighestInterrupt();
			// Rotate in Auto-EOI mode
			if ( val == 0xA0 ) {
				++this.irqLowestPriority;
				if ( this.irqLowestPriority > 7 ) {
					this.irqLowestPriority = 0;
				}
			}
			this.service();
			break;
		// Intel PIC spec-sheet seems to indicate this should be ignored
		case 0x40:
			jemul8.info("PIC(" + this.name + ") writeHandler() :: IRQ no-op");
			break;
		case 0x60: // Specific EOI 0
		case 0x61: // Specific EOI 1
		case 0x62: // Specific EOI 2
		case 0x63: // Specific EOI 3
		case 0x64: // Specific EOI 4
		case 0x65: // Specific EOI 5
		case 0x66: // Specific EOI 6
		case 0x67: // Specific EOI 7
			this.regInService.set(this.regInService.get()
				& (~(1 << (val - 0x60))));
			this.service();
			break;
		// IRQ lowest priority commands
		case 0xC0: // 0 7 6 5 4 3 2 1
		case 0xC1: // 1 0 7 6 5 4 3 2
		case 0xC2: // 2 1 0 7 6 5 4 3
		case 0xC3: // 3 2 1 0 7 6 5 4
		case 0xC4: // 4 3 2 1 0 7 6 5
		case 0xC5: // 5 4 3 2 1 0 7 6
		case 0xC6: // 6 5 4 3 2 1 0 7
		case 0xC7: // 7 6 5 4 3 2 1 0
			jemul8.info("PIC(" + this.name + ") writeHandler() ::"
				+ " IRQ lowest command " + $.format("hex", val));
			this.irqLowestPriority = val - 0xC0;
			break;
		case 0xE0: // Specific EOI and rotate 0
		case 0xE1: // Specific EOI and rotate 1
		case 0xE2: // Specific EOI and rotate 2
		case 0xE3: // Specific EOI and rotate 3
		case 0xE4: // Specific EOI and rotate 4
		case 0xE5: // Specific EOI and rotate 5
		case 0xE6: // Specific EOI and rotate 6
		case 0xE7: // Specific EOI and rotate 7
			this.regInService.set(this.regInService.get()
				& (~(1 << (val - 0xE0))));
			this.irqLowestPriority = (val - 0xE0);
			this.service();
			break;
		case 0x02: // Single mode bit: 1 = single, 0 = cascade
			// Ignore. 386BSD writes this value but works with it ignored.
			break;
		default:
			return jemul8.panic("PIC(" + this.name + ") writeHandler() ::"
				+ " Write to port A0h = " + $.format("hex", val));
		}
	};
	PIC_Core.prototype.initModeOperation = function ( val ) {
		var core = this;
		
		if ( core.init.inInit ) {
			switch ( core.init.bytExpected ) {
			case 2:
				core.offsetInterrupt = val & 0xf8;
				core.init.bytExpected = 3;
				jemul8.debug("PIC(" + this.name + ") writeHandler() ::"
					+ " Init command 2 = " + $.format("hex", val));
				jemul8.debug(" -> offset = INT "
					+ $.format("hex", core.offsetInterrupt));
				break;
			case 3:
				jemul8.debug("PIC(" + this.name + ") writeHandler() ::"
					+ " Init command 3 = " + $.format("hex", val));
				if ( core.init.requires4 ) {
					core.init.bytExpected = 4;
				} else {
					core.init.inInit = false;
				}
				break;
			case 4:
				jemul8.debug("PIC(" + this.name + ") writeHandler() ::"
					+ " Init command 4 = " + $.format("hex", val));
				if ( val & 0x02 ) {
					jemul8.debug(" -> auto EOI");
					core.useAutoEOI = true;
				} else {
					jemul8.debug(" -> Normal EOI interrupt");
					core.useAutoEOI = false;
				}
				if ( val & 0x01 ) {
					jemul8.debug(" -> 80x86 mode");
				} else {
					return jemul8.panic(" -> not 80x86 mode");
				}
				core.init.inInit = false;
				break;
			default:
				return jemul8.panic("PIC(" + this.name + ") writeHandler() ::"
					+ " Expecting bad init command");
			}
			return;
		}
		
		// Normal operation
		jemul8.debug("PIC(" + this.name + ") writeHandler() ::"
			+ " Setting PIC IMR to " + $.format("hex", val));
		core.regInterruptMask.set(val);
		core.service();
	};
	PIC_Core.prototype.clearHighestInterrupt = function () {
		var irq, irqLowestPriority = this.irqLowestPriority
			, irqHighestPriority = irqLowestPriority + 1
			, valISR;
		
		// Wrap around to zero if out-of-bounds
		if ( irqHighestPriority > 7 ) { irqHighestPriority = 0; }
		
		irq = irqHighestPriority;
		do {
			valISR = this.regInService.get();
			// This IRQ is in service
			if ( valISR & (1 << irq) ) {
				// Take out of service (perform the "clear")
				this.regInService.set(valISR & ~(1 << irq));
				break;
			}
			
			++irq;
			if ( irq > 7 ) { irq = 0; }
		} while ( irq != irqHighestPriority );
	};
	PIC_Core.prototype.service = function () {
		var machine = this.cntrlr.machine, cpu = machine.cpu
			, unmasked_requests
			, irq
			, valISR, irqMax
			, irqHighestPriority = this.irqLowestPriority + 1;
		
		// Wrap around to zero if out-of-bounds
		if ( irqHighestPriority > 7 ) { irqHighestPriority = 0; }
		
		// Last interrupt still not acknowleged
		if ( this.INT.isHigh() ) {
			return;
		}
		
		/*
		 *	All priorities may be enabled.  check all IRR bits except ones
		 *	which have corresponding ISR bits set
		 */
		if ( this.useSpecialMask ) {
			irqMax = irqHighestPriority;
		// Normal mode
		} else {
			// Find the highest priority IRQ that is enabled due to current ISR
			if ( valISR = this.regInService.get() ) {
				irqMax = irqHighestPriority;
				while ( (valISR & (1 << irqMax)) === 0 ) {
					++irqMax;
					if ( irqMax > 7 ) { irqMax = 0; }
				}
				// Highest priority interrupt in-service,
				//	no other priorities allowed
				if ( irqMax == irqHighestPriority ) { return; }
				if ( irqMax > 7 ) { return jemul8.panic("PIC("
					+ this.name + ").service() :: Error, irqMax > 7"); }
			} else {
				irqMax = irqHighestPriority; // 0..7 bits in ISR are cleared
			}
		}
		
		// Now, see if there are any higher priority requests
		if ( unmasked_requests = (this.regInterruptRequest.get()
				& ~this.regInterruptMask.get()) ) {
			irq = irqHighestPriority;
			do {
				/*
				 *	For special mode, since we're looking at all IRQ's, skip
				 *	if current IRQ is already in-service
				 */
				if ( !(this.useSpecialMask && ((this.regInService.get()
						>> irq) & 0x01)) ) {
					if ( unmasked_requests & (1 << irq) ) {
						jemul8.debug("PIC(" + this.name + ").service() ::"
							+ " Signalling IRQ #"
							+ $.format("hex", this.isMaster
								? irq : 8 + irq));
						this.INT.raise();
						this.irq = irq;
						if ( this.isMaster ) {
							cpu.INTR.raise();
						} else {
							// Request IRQ 2 on the master PIC
							//	(this is the chaining/cascade)
							machine.PIC.raiseIRQ(2);
						}
						return;
					}
				}
				++irq;
				if ( irq > 7 ) { irq = 0; }
			} while ( irq != irqMax );
		}
	};
	
	// PIC chip's I/O read operations' handler routine
	function readHandler( device, addr, io_len ) {
		var state = device.state; // "device" will be PIC
		var result8; // 8-bit result
		
		jemul8.info("PIC readHandler() :: Read from "
			+ $.format("hex", state.addrMemory));
		
		/** NB: This is an 8259A PIC **/
		
		// Master PIC in polled mode: treat this as an interrupt ACKnowledge
		if ( (addr === 0x20 || addr === 0x21)
		&& state.PICmaster.isPolled === true ) {
			state.PICmaster.clearHighestInterrupt();
			state.PICmaster.isPolled = false;
			state.PICmaster.service();
			// Return either the IRQ as a byte,
			//	or the IRQ repeated into both high & low bytes of a word
			return io_len === 1
				? state.PICmaster.irq
				: ((state.PICmaster.irq << 8) | state.PICmaster.irq);
		}
		
		// Slave PIC in polled mode: treat this as an interrupt ACKnowledge
		if ( (addr === 0xA0 || addr === 0xA1)
		&& state.PICslave.isPolled === true ) {
			state.PICslave.clearHighestInterrupt();
			state.PICslave.isPolled = false;
			state.PICslave.service();
			// Return either the IRQ as a byte,
			//	or the IRQ repeated into both high & low bytes of a word
			return io_len === 1
				? state.PICslave.irq
				: ((state.PICslave.irq << 8) | state.PICslave.irq);
		}
		
		switch ( addr ) {
		case 0x0020: // Read from Master "read register"
			result8 = state.PICmaster.regReadSelect.get();
			jemul8.debug("PIC(master) readHandler() :: Read Master "
				+ state.PICmaster.regReadSelect.name + " = "
				+ $.format("hex", result8));
			return result8;
		case 0x0021: // Read from Master IMR "Interrupt Mask Register"
			result8 = state.PICmaster.regInterruptMask.get();
			jemul8.debug("PIC(master) readHandler() :: Read Master IMR = "
				+ $.format("hex", result8));
			return result8;
		case 0x00A0: // Read from Slave "read register"
			result8 = state.PICslave.regReadSelect.get();
			jemul8.debug("PIC(slave) readHandler() :: Read Master "
				+ state.PICslave.regReadSelect.name
				+ " = " + $.format("hex", result8));
			return result8;
		case 0x00A1: // Read from Slave IMR "Interrupt Mask Register"
			result8 = state.PICslave.regInterruptMask.get();
			jemul8.debug("PIC(slave) readHandler() :: Read Master IMR = "
				+ $.format("hex", result8));
			return result8;
		default:
			jemul8.panic("PIC readHandler() :: Unsupported read, address="
				+ $.format("hex", addr) + "!");
			return 0;
		}
	}
	// PIC chip's I/O write operations' handler routine
	function writeHandler( device, addr, val, io_len ) {
		var state = device.state // "device" will be PIC
			, PICmaster = state.PICmaster, PICslave = state.PICslave;
		
		jemul8.info("PIC writeHandler() :: Write to address: "
			+ $.format("hex", addr) + " = " + $.format("hex", val));
		
		/** NB: This is an 8259A PIC **/
		
		switch ( addr ) {
		case 0x20:
			PICmaster.initCommand(val);
			return;
		// Initialization mode operation
		case 0x21:
			PICmaster.initModeOperation(val);
			return;
		case 0xA0:
			PICslave.initCommand(val);
			return;
		// Initialization mode operation
		case 0xA1:
			PICslave.initModeOperation(val);
			return;
		default:
			jemul8.panic("PIC writeHandler() :: Unsupported write, address="
				+ $.format("hex", addr) + "!");
			return;
		}
	}
	/* ====== /Private ====== */
	
	// Exports
	jemul8.PIC = PIC;
});
