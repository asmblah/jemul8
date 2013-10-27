/**
 * jemul8 - JavaScript x86 Emulator
 * http://jemul8.com/
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*
 * ASIC for NE2K (NE2000) NIC
 */

/*global define */
define([
    "js/util"
], function (
    util
) {
    "use strict";

    var NE2K_MEMORY_SIZE = 32 * 1024;

    function ASIC(ne2k) {
        this.ne2k = ne2k;
    }

    util.extend(ASIC.prototype, {
        advanceDMAAddress: function (length) {
            /*jshint bitwise: false */
            var ne2k = this.ne2k;

            if (length === 4) {
                ne2k.remoteDMAAddress.set(ne2k.remoteDMAAddress.get() + length);
            } else {
                ne2k.remoteDMAAddress.set(ne2k.remoteDMAAddress.get() + (ne2k.dcr.wordSize + 1));
            }
            if (ne2k.remoteDMAAddress.get() === (ne2k.pageStop.get() << 8)) {
                ne2k.remoteDMAAddress.set(ne2k.pageStart.get() << 8);
            }
        },

        read: function (offset, length) {
            /*jshint bitwise: false */
            var asic = this,
                ne2k = asic.ne2k,
                result = 0;

            // Data register
            if (offset === 0) {
                result = ne2k.readChipMemoryDMA(length);

                /*
                 * The 8390 bumps the address and decreases the byte count
                 * by the selected word size after every access, not by
                 * the amount of data requested by the host (length).
                 */
                asic.advanceDMAAddress(length);

                // Keep remoteByteCount from underflowing
                if (ne2k.remoteByteCount.get() > ne2k.dcr.wordSize) {
                    if (length === 4) {
                        ne2k.remoteByteCount.set(ne2k.remoteByteCount.get() - length);
                    } else {
                        ne2k.remoteByteCount.set(ne2k.remoteByteCount.get() - (ne2k.dcr.wordSize + 1));
                    }
                } else {
                    ne2k.remoteByteCount.clear();
                }

                // If all bytes have been written, signal remote-DMA complete
                if (ne2k.remoteByteCount.get() === 0) {
                    ne2k.isr.remoteDMAComplete = true;
                    if (ne2k.imr.enableRemoteDMACompleteInterrupt) {
                        ne2k.raiseIRQ();
                    }
                }
            // Reset register
            } else if (offset === 0xF) {
                ne2k.reset({"type": "software"});
            } else {
                util.info("NE2K ASIC.read() :: Invalid offset: " + util.hexify(offset));
            }

            return result;
        },

        write: function (offset, value, length) {
            /*jshint bitwise: false */
            var asic = this,
                ne2k = asic.ne2k;

            // Data register
            if (offset === 0x00) {
                if (length > 1 && !ne2k.dcr.wordSize) {
                    util.panic("NE2K ASIC.write() :: Write length " + length + " on byte-mode operation");
                }

                if (ne2k.remoteByteCount.get() === 0) {
                    util.problem("NE2K ASIC.write() :: DMA write with byte count 0");
                }

                ne2k.writeChipMemoryDMA(value, length);

                asic.advanceDMAAddress(length);

                if (length === 4) {
                    ne2k.remoteByteCount.set(ne2k.remoteByteCount.get() - length);
                } else {
                    ne2k.remoteByteCount.set(ne2k.remoteByteCount.get() - (ne2k.dcr.wordSize + 1));
                }

                if (ne2k.remoteByteCount.get() > NE2K_MEMORY_SIZE) {
                    ne2k.remoteByteCount.clear();
                }

                // If all bytes have been written, signal remote-DMA complete
                if (ne2k.remoteByteCount.get() === 0) {
                    ne2k.isr.remoteDMAComplete = true;
                    if (ne2k.imr.enableRemoteDMACompleteInterrupt) {
                        ne2k.raiseIRQ();
                    }
                }
            // Reset register
            } else if (offset === 0x0F) {
                // End of reset pulse
                return;
            } else {
                util.info("NE2K ASIC.write() :: Invalid address " + util.hexify(offset) + ", ignoring");
            }
        }
    });

    return ASIC;
});
