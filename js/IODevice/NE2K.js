/**
 * jemul8 - JavaScript x86 Emulator
 * http://jemul8.com/
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*
 * NE2K (NE2000) NIC
 *
 * See http://www.ti.com/lit/ds/symlink/dp8390d.pdf
 */

/*global ArrayBuffer, DataView, define, Uint8Array */
define([
    "js/util",
    "js/IODevice/NE2K/ASIC",
    "js/IODevice/NE2K/EthernetDevice",
    "js/Networking/Frame/Ethernet",
    "js/Exception",
    "js/IODevice",
    "js/Networking/Address/MAC",
    "js/Promise",
    "js/Register"
], function (
    util,
    ASIC,
    EthernetDevice,
    EthernetFrame,
    Exception,
    IODevice,
    MACAddress,
    Promise,
    Register
) {
    "use strict";

    var BASE_IO_ADDRESS_OPTION = "ioAddress",
        IRQ_OPTION = "irq",
        NE2K_MEMORY_SIZE = 32 * 1024,
        NE2K_MEMORY_START = 16 * 1024,
        NE2K_MEMORY_END = NE2K_MEMORY_START + NE2K_MEMORY_SIZE,
        MAC_ADDRESS = "macAddress";

    function NE2K(system, io, memory, options) {
        IODevice.call(this, "NE2K", system, io, memory, options);

        this.asic = new ASIC(this);
        this.boundaryPointer = new Register(1);
        this.bytesToTransmit = new Register(2);
        this.crcErrorTally = new Register(1);
        this.currentPage = new Register(1);
        this.ethernetDevice = new EthernetDevice(this);
        this.fifo = new Register(1);
        this.frameAlignmentErrorTally = new Register(1);
        // Base I/O address
        this.ioAddress = this.options[BASE_IO_ADDRESS_OPTION] || 0x300;
        this.irq = this.options[IRQ_OPTION] || 3;
        this.localDMAAddress = new Register(2);
        this.romMACAddress = MACAddress.createFromHexString(this.options[MAC_ADDRESS] || "00:12:34:56:78:90");
        this.macAddress = this.romMACAddress.copy();
        this.macAddressData = new DataView(new ArrayBuffer(32));
        this.memory = new DataView(new ArrayBuffer(NE2K_MEMORY_SIZE));
        this.missedPacketErrorTally = new Register(1);
        this.multicastHash = new Uint8Array(8);
        this.numberOfCollisions = new Register(1);
        this.pageStart = new Register(1);
        this.pageStop = new Register(1);
        this.remoteByteCount = new Register(2);
        this.remoteDMAAddress = new Register(2);
        this.remoteStartAddress = new Register(2);
        this.transmitPageStart = new Register(1);
        this.transmitTimer = system.createTimer();

        // Command Register (@ 0x00)
        this.cr = {
            initiatePacketTransmission: null,
            remoteDMACommand: new Register(1),
            selectedPage: new Register(1),
            startRequested: null,
            stopRequested: null
        };

        // Data Configuration Register
        this.dcr = {
            autoRemoveRXPackets: null, // AR
            endian: null,              // BOS
            fifoSize: new Register(1), // FT0, FT1
            longAddress: null,         // LAS
            loopbackSelect: null,      // LS
            wordSize: null             // WTS
        };

        // Interrupt Mask Register
        this.imr = {
            enablePacketReceiveInterrupt: null,       // PRXE
            enablePacketTransmitInterrupt: null,      // PTXE
            enablePacketReceiveErrorInterrupt: null,  // RXEE
            enablePacketTransmitErrorInterrupt: null, // TXEE
            enableOverwriteWarnInterrupt: null,       // OVWE
            enableCounterOverflowInterrupt: null,     // CNTE
            enableRemoteDMACompleteInterrupt: null    // RDCE
            // D7 is reserved
        };

        // Interrupt Status Register
        this.isr = {
            counterOverflow: null,                      // CNT
            packetReceivedWithNoErrors: null,           // PRX
            packetReceivedWithOneOrMoreErrors: null,    // RXE
            packetTransmittedWithNoErrors: null,        // PTX
            packetTransmittedWithOneOrMoreErrors: null, // TXE
            receiveBufferResourcesExhausted: null,      // OVW
            remoteDMAComplete: null,                    // RDC
            resetStatus: null                           // RST
        };

        // Receive Configuration Register
        this.rcr = {
            acceptEthernetBroadcast: null,        // AB
            acceptPacketsWithReceiveErrors: null, // SEP
            acceptUnder64ByteRunts: null,         // AR
            checkMulticastHashArray: null,        // AM
            monitorOnly: null,                    // MON
            promiscuousMode: null                 // PRO
            // D6, D7 are reserved
        };

        // Receive Status Register
        this.rsr = {
            badCRCDetected: null,              // CRC
            deferred: null,                    // DFR - Collision active
            disabled: null,                    // DIS - Set when in monitor mode
            fifoOverrun: null,                 // FO
            frameAlignmentError: null,         // FAE
            missedPacketError: null,           // MPA
            multiMatch: null,                  // PHY - Unicast or multicast/broadcast address match
            receiveCompleteWithoutError: null  // PRX
        };

        // Transmit Configuration Register
        this.tcr = {
            allowTransmissionDisableByExternalMCast: null, // ATD
            collisionPriority: null,                       // OFST
            crcDisable: null,                              // CRC
            loopbackControl: new Register(1)               // LB0, LB1
        };

        // Transmit Status Register
        this.tsr = {
            carrierSenseLost: null,                 // CRS
            fifoUnderrun: null,                     // FU
            noTransmissionCDHeartbeat: null,        // CDH
            outOfWindowCollision: null,             // OWC
            transmissionAborted: null,              // ABT
            transmissionCollided: null,             // COL
            transmissionCompleteWithoutError: null  // PTX
        };
    }

    util.inherit(NE2K).from(IODevice);

    util.extend(NE2K.prototype, {
        getIOPorts: function () {
            var description = "NE2000 NIC",
                ne2k = this,
                port,
                ports = {};

            for (port = ne2k.ioAddress ; port <= ne2k.ioAddress + 0x0F; ++port) {
                ports[port] = { description: description, allowedIOLengths: {1: true, 2: true} };
            }

            ports[ne2k.ioAddress + 0x10] = { description: description, allowedIOLengths: {1: true, 2: true} };
            ports[ne2k.ioAddress + 0x1F] = { description: description, allowedIOLengths: {1: true} };

            return ports;
        },

        getPluginData: function () {
            var ne2k = this;

            return {
                getEthernetDevice: function () {
                    return ne2k.ethernetDevice;
                }
            };
        },

        init: function () {
            var index,
                ne2k = this,
                promise = new Promise();

            util.each(ne2k.macAddress.toHexString().split(":"), function (octet, index) {
                octet = parseInt(octet, 16);

                // Initialise the MAC address area by doubling the octets up
                ne2k.macAddressData.setUint8(index * 2, octet);
                ne2k.macAddressData.setUint8(index * 2 + 1, octet);
            });

            // Add NE2K signature
            for (index = 12; index < 32; index++) {
                ne2k.macAddressData.setUint8(index, 0x57);
            }

            ne2k.transmitTimer.on("elapse", function () {
                ne2k.cr.initiatePacketTransmission = false;
                ne2k.tsr.transmissionCompleteWithoutError = true;

                // Generate an interrupt if not masked and not one in progress
                if (ne2k.imr.enablePacketTransmitInterrupt && !ne2k.isr.packetTransmittedWithNoErrors) {
                    ne2k.isr.packetTransmittedWithNoErrors = true;
                    ne2k.raiseIRQ();
                }
            });

            promise.resolve();

            return promise;
        },

        ioRead: function (port, length) {
            var ne2k = this,
                offset = port - ne2k.ioAddress;

            if (offset >= 0x10) {
                return ne2k.asic.read(offset - 0x10, length);
            }

            if (offset === 0x00) {
                return ne2k.readCR();
            }

            if (ne2k.cr.selectedPage.get() === 0) {
                return ne2k.readPage0(offset, length);
            }
            if (ne2k.cr.selectedPage.get() === 1) {
                return ne2k.readPage1(offset, length);
            }
            if (ne2k.cr.selectedPage.get() === 2) {
                return ne2k.readPage2(offset, length);
            }
            if (ne2k.cr.selectedPage.get() === 3) {
                return ne2k.readPage3(offset, length);
            }

            ne2k.system.debug("NE2K.ioRead() :: Unknown CR.selectedPage " + util.hexify(ne2k.cr.selectedPage.get()));
            return 0xFF;
        },

        ioWrite: function (port, value, length) {
            var ne2k = this,
                offset = port - ne2k.ioAddress;

            /*
             * The high 16 bytes of I/O space are for the NE2000 ASIC -
             * the low 16 bytes are for the DS8390, with the current
             * page being selected by the PS0, PS1 registers in the
             * Command Register (CR)
             */
            if (offset >= 0x10) {
                ne2k.asic.write(offset - 0x10, value, length);
            } else if (offset === 0) {
                ne2k.writeCR(value);
            } else {
                if (ne2k.cr.selectedPage.get() === 0) {
                    ne2k.writePage0(offset, value, length);
                } else if (ne2k.cr.selectedPage.get() === 1) {
                    ne2k.writePage1(offset, value, length);
                } else if (ne2k.cr.selectedPage.get() === 2) {
                    ne2k.writePage2(offset, value, length);
                } else if (ne2k.cr.selectedPage.get() === 3) {
                    ne2k.writePage3(offset, value, length);
                } else {
                    ne2k.system.debug("NE2K.ioWrite() :: Unknown CR.selectedPage " + util.hexify(ne2k.cr.selectedPage.get()));
                }
            }
        },

        lowerIRQ: function () {
            var ne2k = this;

            ne2k.system.lowerIRQ(ne2k.irq);
        },

        raiseIRQ: function () {
            var ne2k = this;

            ne2k.system.raiseIRQ(ne2k.irq);
        },

        readChipMemoryDMA: function (length) {
            var ne2k = this,
                address = ne2k.remoteDMAAddress.get();

            /*jshint bitwise: false */
            if (length === 2 && (address & 1)) {
                throw new Exception("NE2K.readChipMemoryDMA() :: Unaligned chip memory word read");
            }

            // Read-only MAC address
            if (address >= 0 && address <= 31) {
                if (length === 1) {
                    return ne2k.macAddressData.getUint8(address);
                }
                if (length === 2) {
                    return ne2k.macAddressData.getUint16(address, true);
                }
                if (length === 4) {
                    return ne2k.macAddressData.getUint32(address, true);
                }
            }

            if (address >= NE2K_MEMORY_START && address < NE2K_MEMORY_END) {
                if (length === 1) {
                    return ne2k.memory.getUint8(address - NE2K_MEMORY_START);
                }
                if (length === 2) {
                    return ne2k.memory.getUint16(address - NE2K_MEMORY_START, true);
                }
                if (length === 4) {
                    return ne2k.memory.getUint32(address - NE2K_MEMORY_START, true);
                }
            }

            util.debug("NE2K.readChipMemoryDMA() :: Out-of-bounds chip memory read: " + util.hexify(address));
            return 0xFF;
        },

        readCR: function () {
            var ne2k = this;

            /*jshint bitwise: false */
            return (
                ((ne2k.cr.selectedPage.get() & 3) << 6) |
                ((ne2k.cr.remoteDMACommand.get() & 7) << 3) |
                (ne2k.cr.initiatePacketTransmission << 2) |
                (ne2k.cr.startRequested << 1) |
                (ne2k.cr.stopRequested)
            );
        },

        readPage0: function (offset, length) {
            /*jshint bitwise: false */
            var ne2k = this;

            if (length > 1) {
                throw new Exception("NE2K.readPage0() :: Length too long: " + util.hexify(length));
            }

            switch (offset) {
            case 0x1: // CLDA0
                return ne2k.localDMAAddress.get() & 0xFF;
            case 0x2: // CLDA1
                return (ne2k.localDMAAddress.get() >>> 8) & 0xFF;
            case 0x3: // BNRY
                return ne2k.boundaryPointer.get();
            case 0x4: // TSR
                return (
                    (ne2k.tsr.outOfWindowCollision << 7) |
                    (ne2k.tsr.noTransmissionCDHeartbeat << 6) |
                    (ne2k.tsr.fifoUnderrun << 5) |
                    (ne2k.tsr.carrierSenseLost << 4) |
                    (ne2k.tsr.transmissionAborted << 3) |
                    (ne2k.tsr.transmissionCollided << 2) |
                    (ne2k.tsr.transmissionCompleteWithoutError)
                );
            case 0x5: // NCR
                return ne2k.numberOfCollisions.get();
            case 0x6: // FIFO
                // NB: Reading FIFO is only valid in loopback mode
                return ne2k.fifo.get();
            case 0x7: // ISR
                return (
                    (ne2k.isr.resetStatus << 7) |
                    (ne2k.isr.remoteDMAComplete << 6) |
                    (ne2k.isr.counterOverflow << 5) |
                    (ne2k.isr.receiveBufferResourcesExhausted << 4) |
                    (ne2k.isr.packetTransmittedWithOneOrMoreErrors << 3) |
                    (ne2k.isr.packetReceivedWithOneOrMoreErrors << 2) |
                    (ne2k.isr.packetTransmittedWithNoErrors << 1) |
                    (ne2k.isr.packetReceivedWithNoErrors)
                );
            case 0x8: // CRDA0
                return ne2k.remoteDMAAddress.get() & 0xFF;
            case 0x9: // CRDA1
                return (ne2k.remoteDMAAddress.get() >>> 8) & 0xFF;
            case 0xa: // RTL8029ID0 (reserved)
                return 0xFF;
            case 0xb: // RTL8029ID1 (reserved)
                return 0xFF;
            case 0xc: // RSR
                return (
                    (ne2k.rsr.deferred << 7) |
                    (ne2k.rsr.disabled << 6) |
                    (ne2k.rsr.multiMatch << 5) |
                    (ne2k.rsr.missedPacketError << 4) |
                    (ne2k.rsr.fifoOverrun << 3) |
                    (ne2k.rsr.frameAlignmentError << 2) |
                    (ne2k.rsr.badCRCDetected << 1) |
                    (ne2k.rsr.receiveCompleteWithoutError)
                );
            case 0xd: // CNTR0
                return this.frameAlignmentErrorTally.get();
            case 0xe: // CNTR1
                return this.crcErrorTally.get();
            case 0xf: // CNTR2
                return this.missedPacketErrorTally.get();
            default:
                throw new Exception("NE2K.readPage0() :: Register out of range: " + util.hexify(offset));
            }
        },

        readPage1: function (offset, length) {
            /*jshint bitwise: false */
            var ne2k = this;

            if (length > 1) {
                throw new Exception("NE2K.readPage1() :: Length too long: " + util.hexify(length));
            }

            switch (offset) {
            case 0x1: // PAR0-5
            case 0x2:
            case 0x3:
            case 0x4:
            case 0x5:
            case 0x6:
                return ne2k.macAddress.getOctet(offset - 1);
            case 0x7: // CURR
                return ne2k.currentPage.get();
            case 0x8: // MAR0-7
            case 0x9:
            case 0xA:
            case 0xB:
            case 0xC:
            case 0xD:
            case 0xE:
            case 0xF:
                return ne2k.multicastHash[offset - 8];
            default:
                throw new Exception("NE2K.readPage1() :: Register out of range: " + util.hexify(offset));
            }
        },

        receiveFrame: function (buffer, offset, length) {
            /*jshint bitwise: false */
            var availablePages,
                endBytes,
                ethernetFrame,
                multicastIndex,
                ne2k = this,
                nextPage,
                packetHeader = new Uint8Array(4),
                requiredPages,
                startOffset,
                wrapped = false;

            // Ensure we are in a mode able to receive frames
            if (ne2k.stopRequested || ne2k.pageStart.get() === 0 || (!ne2k.dcr.loopbackSelect && ne2k.tcr.loopbackControl.get() !== 0)) {
                return;
            }

            // Work out how many 256-byte pages the frame would occupy
            // - Add 4 bytes for the header we will prepend to the packet in NE2K memory
            requiredPages = Math.ceil((length + 4) / 256);

            if (ne2k.currentPage.get() < ne2k.boundaryPointer.get()) {
                availablePages = ne2k.boundaryPointer.get() - ne2k.currentPage.get();
            } else {
                availablePages = (ne2k.pageStop.get() - ne2k.pageStart.get()) - (ne2k.currentPage.get() - ne2k.boundaryPointer.get());
                wrapped = true;
            }

            // Avoid getting into an overflow condition by not attempting partial receives
            if (availablePages < requiredPages) {
                // Just drop the frame
                return;
            }

            if (length < 60 && !ne2k.rcr.acceptUnder64ByteRunts) {
                util.debug("NE2K.receiveFrame() :: Rejected small frame with length " + util.hexify(length));
            }

            ethernetFrame = new EthernetFrame(buffer, offset, length);

            // Do hardware (MAC) address filtering if we're not in promiscuous mode
            if (!ne2k.rcr.promiscuousMode) {
                // Accept ethernet broadcast frames, unless...
                if (ethernetFrame.getDestinationMAC().isBroadcast()) {
                    // ... they have been disabled in hardware
                    if (!ne2k.rcr.acceptEthernetBroadcast) {
                        return;
                    }
                // Check for applicable multicast, unless...
                } else if (new Uint8Array(buffer, offset)[0] & 1) {
                    // ... it has been disabled in hardware
                    if (!ne2k.rcr.checkMulticastHashArray) {
                        return;
                    }

                    multicastIndex = ethernetFrame.getDestinationMAC().getMulticastIndex();

                    if (!(ne2k.multicastHash[multicastIndex >>> 3] & (1 << (multicastIndex & 0x7)))) {
                        return;
                    }
                // Otherwise we need an exact MAC address match for us to receive the frame
                } else if (ethernetFrame.getDestinationMAC().toHexString() !== ne2k.macAddress.toHexString()) {
                    return;
                }
            } else {
                util.debug("NE2K.receiveFrame() :: Promiscuous receive");
            }

            nextPage = ne2k.currentPage.get() + requiredPages;

            if (nextPage >= ne2k.pageStop.get()) {
                nextPage -= (ne2k.pageStop.get() - ne2k.pageStart.get());
            }

            // Build the packet header
            packetHeader[0] = 1; // Receive status
            if (new Uint8Array(buffer, offset)[0] & 1) {
                packetHeader[0] |= 0x20; // Add "multicast packet" status
            }
            packetHeader[1] = nextPage; // Pointer to next page
            packetHeader[2] = (length + 4) & 0xFF; // Low-byte of length
            packetHeader[3] = (length + 4) >>> 8; // High-byte of length

            // Copy packet header and payload into memory
            startOffset = ne2k.currentPage.get() * 256 - NE2K_MEMORY_START;

            // Packet fits into contiguous pages
            if ((nextPage > ne2k.currentPage.get()) || ((ne2k.currentPage.get() + requiredPages) === ne2k.pageStop.get())) {
                new Uint8Array(ne2k.memory.buffer, startOffset, 4).set(packetHeader);
                new Uint8Array(ne2k.memory.buffer, startOffset + 4, length).set(new Uint8Array(buffer, offset, length));
            } else {
                endBytes = (ne2k.pageStop.get() - ne2k.currentPage.get()) * 256;

                new Uint8Array(ne2k.memory.buffer, startOffset, 4).set(packetHeader);
                new Uint8Array(ne2k.memory.buffer, startOffset + 4, length).set(new Uint8Array(buffer, offset, endBytes - 4));

                startOffset = ne2k.pageStart.get() * 256 - NE2K_MEMORY_START;
                new Uint8Array(ne2k.memory.buffer, startOffset).set(new Uint8Array(buffer, offset + endBytes - 4, length - endBytes + 8));
            }

            ne2k.currentPage.set(nextPage);

            ne2k.rsr.receiveCompleteWithoutError = true;
            ne2k.rsr.multiMatch = !!(new Uint8Array(buffer, offset)[0] & 1);

            ne2k.isr.packetReceivedWithNoErrors = true;

            if (ne2k.imr.enablePacketReceiveInterrupt) {
                ne2k.raiseIRQ();
            }
        },

        reset: function () {
            var ne2k = this;

            function clearBuffer(buffer) {
                new Uint8Array(buffer).set(new Uint8Array(buffer.byteLength), 0);
            }

            ne2k.cr.initiatePacketTransmission = false;
            ne2k.cr.remoteDMACommand.set(4);
            ne2k.cr.selectedPage.clear();
            ne2k.cr.startRequested = false;
            ne2k.cr.stopRequested = true;

            ne2k.dcr.autoRemoveRXPackets = false;
            ne2k.dcr.endian = false;
            ne2k.dcr.fifoSize.clear();
            ne2k.dcr.longAddress = false;
            ne2k.dcr.loopbackSelect = false;
            ne2k.dcr.wordSize = false;

            ne2k.imr.enablePacketReceiveInterrupt = false;
            ne2k.imr.enablePacketTransmitInterrupt = false;
            ne2k.imr.enablePacketReceiveErrorInterrupt = false;
            ne2k.imr.enablePacketTransmitErrorInterrupt = false;
            ne2k.imr.enableOverwriteWarnInterrupt = false;
            ne2k.imr.enableCounterOverflowInterrupt = false;
            ne2k.imr.enableRemoteDMACompleteInterrupt = false;

            ne2k.isr.counterOverflow = false;
            ne2k.isr.packetReceivedWithNoErrors = false;
            ne2k.isr.packetReceivedWithOneOrMoreErrors = false;
            ne2k.isr.packetTransmittedWithNoErrors = false;
            ne2k.isr.packetTransmittedWithOneOrMoreErrors = false;
            ne2k.isr.receiveBufferResourcesExhausted = false;
            ne2k.isr.remoteDMAComplete = false;
            ne2k.isr.resetStatus = true;

            ne2k.rcr.acceptEthernetBroadcast = false;
            ne2k.rcr.acceptPacketsWithReceiveErrors = false;
            ne2k.rcr.acceptUnder64ByteRunts = false;
            ne2k.rcr.checkMulticastHashArray = false;
            ne2k.rcr.monitorOnly = false;
            ne2k.rcr.promiscuousMode = false;

            ne2k.rsr.badCRCDetected = false;
            ne2k.rsr.deferred = false;
            ne2k.rsr.disabled = false;
            ne2k.rsr.fifoOverrun = false;
            ne2k.rsr.frameAlignmentError = false;
            ne2k.rsr.missedPacketError = false;
            ne2k.rsr.multiMatch = false;
            ne2k.rsr.receiveCompleteWithoutError = false;

            ne2k.tcr.allowTransmissionDisableByExternalMCast = false;
            ne2k.tcr.collisionPriority = false;
            ne2k.tcr.crcDisable = false;
            ne2k.tcr.loopbackControl.clear();

            ne2k.tsr.carrierSenseLost = false;
            ne2k.tsr.fifoUnderrun = false;
            ne2k.tsr.noTransmissionCDHeartbeat = false;
            ne2k.tsr.outOfWindowCollision = false;
            ne2k.tsr.transmissionAborted = false;
            ne2k.tsr.transmissionCompleteWithoutError = false;
            ne2k.tsr.transmissionCollided = false;

            ne2k.boundaryPointer.clear();
            ne2k.bytesToTransmit.clear();
            ne2k.crcErrorTally.clear();
            ne2k.currentPage.clear();
            ne2k.fifo.clear();
            ne2k.frameAlignmentErrorTally.clear();
            ne2k.localDMAAddress.clear();
            // Clear memory
            clearBuffer(ne2k.memory.buffer);
            ne2k.missedPacketErrorTally.clear();
            ne2k.macAddress.setZero();
            clearBuffer(ne2k.multicastHash.buffer);
            ne2k.numberOfCollisions.clear();
            ne2k.pageStart.clear();
            ne2k.pageStop.clear();
            ne2k.remoteByteCount.clear();
            ne2k.remoteDMAAddress.clear();
            ne2k.remoteStartAddress.clear();
            ne2k.transmitPageStart.clear();

            return ne2k;
        },

        writeChipMemoryDMA: function (value, length) {
            var ne2k = this,
                address = ne2k.remoteDMAAddress.get();

            /*jshint bitwise: false */
            if (length === 2 && (address & 1)) {
                throw new Exception("NE2K.writeChipMemoryDMA() :: Unaligned chip memory word write");
            }

            if (address >= NE2K_MEMORY_START && address < NE2K_MEMORY_END) {
                if (length === 1) {
                    ne2k.memory.setUint8(address - NE2K_MEMORY_START, value);
                    return;
                }
                if (length === 2) {
                    ne2k.memory.setUint16(address - NE2K_MEMORY_START, value, true);
                    return;
                }
                if (length === 4) {
                    ne2k.memory.setUint32(address - NE2K_MEMORY_START, value, true);
                    return;
                }
            }

            util.debug("NE2K.writeChipMemoryDMA() :: Out-of-bounds chip memory write: " + util.hexify(address));
        },

        writeCR: function (value) {
            /*jshint bitwise: false */
            var ne2k = this;

            // Validate remote DMA
            if ((value & 0x38) === 0) {
                // DMA command 4 is a safe default
                value |= 0x20;
            }

            // Check for software reset
            if (value & 0x01) {
                ne2k.isr.resetStatus = true;
                ne2k.cr.stopRequested = true;
            } else {
                ne2k.cr.stopRequested = false;
            }

            ne2k.cr.remoteDMACommand.set((value & 0x38) >>> 3);

            // If start command issued, the RST bit in the ISR must be cleared
            if ((value & 0x02) && !ne2k.cr.startRequested) {
                ne2k.isr.resetStatus = false;
            }

            ne2k.cr.startRequested = !!(value & 0x02);
            ne2k.cr.selectedPage.set((value & 0xC0) >>> 6);

            // Check for send-packet command
            if (ne2k.cr.remoteDMACommand.get() === 3) {
                // Set up DMA read from receive ring
                ne2k.remoteDMAAddress.set(ne2k.boundaryPointer.get() * 256);
                ne2k.remoteStartAddress.set(ne2k.remoteDMAAddress.get());
                // Remember to read little-endian!
                ne2k.remoteByteCount.set(ne2k.memory.getUint16(ne2k.boundaryPointer.get() * 256 + 2 - NE2K_MEMORY_START, true));
            }

            // Check for start-transmission
            if (value & 0x04) {
                if (ne2k.tcr.loopbackControl.get()) {
                    if (ne2k.tcr.loopbackControl.get() !== 1) {
                        util.info("NE2K.writeCR() :: Loop mode " + ne2k.tcr.loopbackControl.get() + " not supported");
                    } else {
                        ne2k.receiveFrame(ne2k.memory, ne2k.transmitPageStart.get() * 256 - NE2K_MEMORY_START, ne2k.bytesToTransmit.get());
                    }
                } else {
                    if (ne2k.cr.stopRequested || !ne2k.cr.startRequested) {
                        // Allow for Solaris9 probe
                        if (ne2k.bytesToTransmit.get() === 0) {
                            return;
                        }

                        throw new Exception("NE2K.writeCR() :: Transmission start, but device is in reset");
                    }

                    if (ne2k.bytesToTransmit.get() === 0) {
                        throw new Exception("NE2K.writeCR() :: Transmission start, but no bytes to transmit");
                    }

                    ne2k.cr.initiatePacketTransmission = true;
                    ne2k.ethernetDevice.sendFrame(ne2k.memory.buffer, ne2k.transmitPageStart.get() * 256 - NE2K_MEMORY_START, ne2k.bytesToTransmit.get());

                    if (ne2k.transmitTimer.isActive()) {
                        util.problem("NE2K.writeCR() :: CR write, but transmit timer is still active");
                    }

                    /*
                     * Schedule a timer to trigger a tx-complete interrupt.
                     * The number of microseconds is the bit-time / 10.
                     * The bit-time is the preamble+SFD (64 bits), the
                     * inter-frame gap (96 bits), the CRC (4 bytes), and
                     * the number of bits in the frame (bytesToTransmit * 8).
                     */
                    ne2k.transmitTimer.triggerAfterMicroseconds((64 + 96 + 4 * 8 + ne2k.bytesToTransmit.get() * 8) / 10);
                }
            }

            /*
             * Linux probes for an interrupt by setting up a remote-DMA read
             * of 0 bytes with remote-DMA completion interrupts enabled.
             * Detect this here
             */
            if (ne2k.cr.remoteDMACommand.get() === 0x01 && ne2k.cr.startRequested && ne2k.remoteByteCount.get() === 0) {
                ne2k.isr.remoteDMAComplete = true;
                if (ne2k.imr.enableRemoteDMACompleteInterrupt) {
                    ne2k.raiseIRQ();
                }
            }
        },

        writePage0: function (offset, value, length) {
            /*jshint bitwise: false */
            var isrState,
                ne2k = this;

            // Break up word writes into bytes
            if (length === 2) {
                ne2k.writePage0(offset, value & 0xFF, 1);
                if (offset < 0xF) {
                    ne2k.writePage0(offset + 1, (value >>> 8) & 0xFF, 1);
                }

                return;
            }

            switch (offset) {
            case 0x1: // PSTART
                ne2k.pageStart.set(value);
                break;
            case 0x2: // PSTOP
                ne2k.pageStop.set(value);
                break;
            case 0x3: // BNRY
                ne2k.boundaryPointer.set(value);
                break;
            case 0x4: // TPSR
                ne2k.transmitPageStart.set(value);
                break;
            case 0x5: // TBCR0
                // Set low byte
                ne2k.bytesToTransmit.set((ne2k.bytesToTransmit.get() & 0xFF00) | (value & 0xFF));
                break;
            case 0x6: // TBCR1
                // Set high byte
                ne2k.bytesToTransmit.set((ne2k.bytesToTransmit.get() & 0x00FF) | ((value & 0xFF) << 8));
                break;
            case 0x7: // ISR
                // Clear RST bit as it is read-only
                value &= 0x7f;

                // Lower any flags that have their bit set in the value
                if (value & 0x01) {
                    ne2k.isr.packetReceivedWithNoErrors = false;
                }
                if (value & 0x02) {
                    ne2k.isr.packetTransmittedWithNoErrors = false;
                }
                if (value & 0x04) {
                    ne2k.isr.packetReceivedWithOneOrMoreErrors = false;
                }
                if (value & 0x08) {
                    ne2k.isr.packetTransmittedWithOneOrMoreErrors = false;
                }
                if (value & 0x10) {
                    ne2k.isr.receiveBufferResourcesExhausted = false;
                }
                if (value & 0x20) {
                    ne2k.isr.counterOverflow = false;
                }
                if (value & 0x40) {
                    ne2k.isr.remoteDMAComplete = false;
                }

                // Lower IRQ if none of the statuses are high
                if (!(
                    (ne2k.isr.remoteDMAComplete && ne2k.imr.enableRemoteDMACompleteInterrupt) ||
                    (ne2k.isr.counterOverflow && ne2k.imr.enableCounterOverflowInterrupt) ||
                    (ne2k.isr.receiveBufferResourcesExhausted && ne2k.imr.enableOverwriteWarnInterrupt) ||
                    (ne2k.isr.packetTransmittedWithOneOrMoreErrors && ne2k.imr.enablePacketTransmitErrorInterrupt) ||
                    (ne2k.isr.packetReceivedWithOneOrMoreErrors && ne2k.imr.enablePacketReceiveErrorInterrupt) ||
                    (ne2k.isr.packetTransmittedWithNoErrors && ne2k.imr.enablePacketTransmitInterrupt) ||
                    (ne2k.isr.packetReceivedWithNoErrors && ne2k.imr.enablePacketReceiveInterrupt)
                )) {
                    ne2k.lowerIRQ();
                }
                break;
            case 0x8: // RSAR0
                // Set low byte
                ne2k.remoteStartAddress.set((ne2k.remoteStartAddress.get() & 0xFF00) | (value & 0xFF));
                ne2k.remoteDMAAddress.set(ne2k.remoteStartAddress.get());
                break;
            case 0x9: // RSAR1
                // Set high byte
                ne2k.remoteStartAddress.set((ne2k.remoteStartAddress.get() & 0x00FF) | ((value & 0xFF) << 8));
                ne2k.remoteDMAAddress.set(ne2k.remoteStartAddress.get());
                break;
            case 0xA: // RBCR0
                // Set low byte
                ne2k.remoteByteCount.set((ne2k.remoteByteCount.get() & 0xFF00) | (value & 0xFF));
                break;
            case 0xB: // RBCR1
                // Set high byte
                ne2k.remoteByteCount.set((ne2k.remoteByteCount.get() & 0x00FF) | ((value & 0xFF) << 8));
                break;
            case 0xC: // RCR
                ne2k.rcr.acceptPacketsWithReceiveErrors = !!(value & 0x01);
                ne2k.rcr.acceptUnder64ByteRunts = !!(value & 0x02);
                ne2k.rcr.acceptEthernetBroadcast = !!(value & 0x04);
                ne2k.rcr.checkMulticastHashArray = !!(value & 0x08);
                ne2k.rcr.promiscuousMode = !!(value & 0x10);
                ne2k.rcr.monitorOnly = !!(value & 0x20);
                break;
            case 0xD: // TCR
                // Test Loop Mode (not supported)
                if (value & 0x06) {
                    ne2k.tcr.loopbackControl.set((value & 0x06) >>> 1);
                } else {
                    ne2k.tcr.loopbackControl.clear();
                }

                if (value & 0x01) {
                    throw new Exception("NE2K.writePage0() :: Inhibit-CRC mode not supported");
                }

                if (value & 0x08) {
                    throw new Exception("NE2K.writePage0() :: Auto-transmit disable not supported");
                }

                // Allow collision-offset to be set, but it is not used
                ne2k.tcr.collisionPriority = !!(value & 0x08);
                break;
            case 0xE: // DCR
                // Loopback mode is not support yet
                if (!(value & 0x08)) {
                    throw new Exception("NE2K.writePage0() :: DCR write - loopback mode selected but not supported");
                }

                ne2k.dcr.wordSize = !!(value & 0x01);
                ne2k.dcr.endian = !!(value & 0x02);
                ne2k.dcr.longAddress = !!(value & 0x04);
                ne2k.dcr.loopbackSelect = !!(value & 0x08);
                ne2k.dcr.autoRemoveRXPackets = !!(value & 0x10);
                ne2k.dcr.fifoSize.set((value & 0x50) >>> 5);
                break;
            case 0xF: // IMR
                ne2k.imr.enablePacketReceiveInterrupt = !!(value & 0x01);
                ne2k.imr.enablePacketTransmitInterrupt = !!(value & 0x02);
                ne2k.imr.enablePacketReceiveErrorInterrupt = !!(value & 0x04);
                ne2k.imr.enablePacketTransmitErrorInterrupt = !!(value & 0x08);
                ne2k.imr.enableOverwriteWarnInterrupt = !!(value & 0x10);
                ne2k.imr.enableCounterOverflowInterrupt = !!(value & 0x20);
                ne2k.imr.enableRemoteDMACompleteInterrupt = !!(value & 0x40);

                isrState = (
                    (ne2k.isr.remoteDMAComplete << 6) |
                    (ne2k.isr.counterOverflow << 5) |
                    (ne2k.isr.receiveBufferResourcesExhausted << 4) |
                    (ne2k.isr.packetTransmittedWithOneOrMoreErrors << 3) |
                    (ne2k.isr.packetReceivedWithOneOrMoreErrors << 2) |
                    (ne2k.isr.packetTransmittedWithNoErrors << 1) |
                    (ne2k.isr.packetReceivedWithNoErrors)
                );

                if (((value & isrState) & 0x7f) === 0) {
                    ne2k.lowerIRQ();
                } else {
                    ne2k.raiseIRQ();
                }
                break;
            default:
                throw new Exception("NE2K.writePage0() :: Register out of range: " + util.hexify(offset));
            }
        },

        writePage1: function (offset, value) {
            /*jshint bitwise: false */
            var ne2k = this;

            switch (offset) {
            case 0x1: // PAR0-5
            case 0x2:
            case 0x3:
            case 0x4:
            case 0x5:
            case 0x6:
                ne2k.macAddress.setOctet(offset - 1, value);
                if (offset === 6) {
                    util.info("NE2K.writePage1() :: MAC address set to " + ne2k.macAddress.toHexString());
                }
                break;
            case 0x7: // CURR
                ne2k.currentPage.set(value);
                break;
            case 0x8: // MAR0-7
            case 0x9:
            case 0xA:
            case 0xB:
            case 0xC:
            case 0xD:
            case 0xE:
            case 0xF:
                ne2k.multicastHash[offset - 8] = value;
                break;
            default:
                throw new Exception("NE2K.writePage1() :: Register out of range: " + util.hexify(offset));
            }
        }
    });

    return NE2K;
});
