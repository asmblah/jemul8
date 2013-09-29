/**
 * jemul8 - JavaScript x86 Emulator
 * http://jemul8.com/
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*
 * DMA (Direct Memory Access) chip, based on an Intel 8237A
 */

/*global define */
define([
    "js/util",
    "js/IODevice",
    "js/core/classes/iodev/dma",
    "js/Promise"
], function (
    util,
    IODevice,
    LegacyDMA,
    Promise
) {
    "use strict";

    function DMA(system, io, memory, options) {
        IODevice.call(this, "DMA", system, io, memory, options);

        this.legacyReadHandler = null;
        this.legacyWriteHandler = null;

        this.legacyDMA = new LegacyDMA((function (dma) {
            return {
                io: {
                    registerIO_Read: function (device, addr, name, fn) {
                        dma.legacyReadHandler = fn;
                    },
                    registerIO_Write: function (device, addr, name, fn) {
                        dma.legacyWriteHandler = fn;
                    }
                },
                mem: {
                    readPhysical: function (physicalAddress, length) {
                        return memory.readPhysical(physicalAddress, length);
                    },
                    writePhysical: function (physicalAddress, value, length) {
                        memory.writePhysical(physicalAddress, value, length);
                    }
                },
                HRQ: {
                    lower: function () {
                        system.lowerHRQ();
                    },
                    raise: function () {
                        system.raiseHRQ();
                    }
                }
            };
        }(this)));
    }

    util.inherit(DMA).from(IODevice);

    util.extend(DMA.prototype, {
        init: function () {
            var dma = this,
                promise = new Promise();

            dma.legacyDMA.init(function () {
                promise.resolve();
            }, function () {
                promise.reject();
            });

            return promise;
        },

        ioRead: function (port, length) {
            var dma = this;

            return dma.legacyReadHandler(dma.legacyDMA, port, length);
        },

        ioWrite: function (port, value, length) {
            var dma = this;

            dma.legacyWriteHandler(dma.legacyDMA, port, value, length);
        },

        raiseHLDA: function () {
            this.legacyDMA.raiseHLDA();
        },

        register: function (ioDevice) {
            var channelIndex = ioDevice.getDMAChannelIndex(),
                dma = this;

            ioDevice.setupDMA({
                lower: function () {
                    dma.legacyDMA.setDRQ(channelIndex, 0);
                },
                raise: function () {
                    dma.legacyDMA.setDRQ(channelIndex, 1);
                }
            }, {
                isHigh: function () {
                    return dma.legacyDMA.getTC();
                }
            });

            dma.legacyDMA.registerDMA8Channel(channelIndex, null, function (dataByte) {
                ioDevice.dmaRead(dataByte);
            }, function () {
                return ioDevice.dmaWrite();
            });
        },

        reset: function () {
            var dma = this;

            return dma;
        }
    });

    return DMA;
});
