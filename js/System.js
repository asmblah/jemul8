/**
 * jemul8 - JavaScript x86 Emulator
 * http://jemul8.com/
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*global define */
define([
    "js/util",
    "js/EventEmitter",
    "js/Exception",
    "js/Pin"
], function (
    util,
    EventEmitter,
    Exception,
    Pin
) {
    "use strict";

    var EQUIPMENT_CHANGE = "equipment change",
        hasOwn = {}.hasOwnProperty;

    function System(io, memory) {
        EventEmitter.call(this);

        this.floppyDriveType = 0;

        // (H)old (R)e(Q)uest
        this.hrq = new Pin("HRQ");

        this.cpu = null;
        this.dma = null;
        this.io = io;
        this.irqHandlers = {};
        this.memory = memory;
        this.numberOfSupportedFloppies = 0;
        this.pic = null;
    }

    util.inherit(System).from(EventEmitter);

    util.extend(System.prototype, {
        acknowledgeInterrupt: function () {
            return this.pic.acknowledgeInterrupt();
        },

        debug: function (message) {
            util.debug(message);
        },

        getA20Mask: function () {
            return 0xFFFFFFFF;
        },

        getFloppyDriveType: function () {
            return this.floppyDriveType;
        },

        getNumberOfSupportedFloppies: function () {
            return this.numberOfSupportedFloppies;
        },

        isHRQHigh: function () {
            return this.hrq.isHigh();
        },

        loadROM: function (buffer, address, type) {
            var system = this;

            // Convert to legacy type
            type = {
                "cmos": 0
            }[type];

            system.legacyJemul8.machine.mem.loadROM(buffer, address, type);

            return system;
        },

        lowerHRQ: function () {
            this.hrq.lower();
        },

        lowerINTR: function () {
            this.cpu.lowerINTR();
        },

        lowerIRQ: function (irq) {
            this.pic.lowerIRQ(irq);
        },

        observeEquipment: function (callback) {
            var system = this;

            system.on(EQUIPMENT_CHANGE, callback);
            callback.call(system);

            return system;
        },

        raiseHLDA: function () {
            this.dma.raiseHLDA();
        },

        raiseINTR: function () {
            this.cpu.raiseINTR();
        },

        raiseHRQ: function () {
            this.hrq.raise();
        },

        raiseIRQ: function (irq) {
            this.pic.raiseIRQ(irq);
        },

        registerIRQ: function (irq, handler) {
            var irqHandlers = this.irqHandlers;

            if (irq < 0 || irq > 0xF) {
                throw new Exception("IO.registerIRQ() :: Invalid IRQ number " + irq + " - must be between 0-F inclusive");
            }

            if (irqHandlers[irq]) {
                throw new Exception("IO.registerIRQ() :: IRQ conflict for '" + handler + "' (already in use by '" + irqHandlers[irq] + "')");
            }

            irqHandlers[irq] = handler;
        },

        // Hardware reset
        reset: function () {
            var system = this;

            system.setEnableA20(false);

            // Always reset CPU
            system.cpu.reset();

            system.io.reset();
        },

        setCPU: function (cpu) {
            this.cpu = cpu;
        },

        setDMA: function (dma) {
            this.dma = dma;
        },

        setFloppyDriveType: function (floppyDriveType) {
            var system = this;

            system.floppyDriveType = floppyDriveType;
            system.emit(EQUIPMENT_CHANGE);

            return system;
        },

        setNumberOfSupportedFloppies: function (numberOfSupportedFloppies) {
            var system = this;

            system.numberOfSupportedFloppies = numberOfSupportedFloppies;
            system.emit(EQUIPMENT_CHANGE);

            return system;
        },

        setPIC: function (pic) {
            this.pic = pic;
        },

        write: function (options) {
            var data,
                offset,
                port,
                size,
                system = this,
                to;

            options = options || {};

            if (!hasOwn.call(options, "data")) {
                throw new Exception("System.write() :: 'data' not specified");
            }

            if (!hasOwn.call(options, "to") && !hasOwn.call(options, "port")) {
                throw new Exception("System.write() :: Either 'to' or 'port' must be specified");
            }

            data = options.data;

            // Writing to memory
            if (hasOwn.call(options, "to")) {
                to = options.to;
                size = data.length;

                if (options.data.byteLength) {
                    system.memory.writePhysicalBlock(to, data);
                } else if (util.isArray(data)) {
                    for (offset = 0; offset < size; offset += 1) {
                        system.memory.writePhysical(to + offset, data[offset], 1);
                    }
                }
            // Writing to I/O address space
            } else {
                port = options.port;
                size = options.length;

                system.io.write(port, data, size);
            }
        }
    });

    return System;
});
