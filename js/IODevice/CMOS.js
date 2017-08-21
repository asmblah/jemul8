/**
 * jemul8 - JavaScript x86 Emulator
 * http://jemul8.com/
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*
 * Bochs-compatible CMOS chip
 *
 * See http://bochs.sourceforge.net/techspec/CMOS-reference.txt
 */

/*global ArrayBuffer, define */
define([
    "js/util",
    "js/IODevice",
    "js/Promise",
    "js/Register"
], function (
    util,
    IODevice,
    Promise,
    Register
) {
    "use strict";

    var BASE_MEMORY_IN_K = 640,
        BIOS_ROM_OPTION = "bios";

    function CMOS(system, io, memory, options) {
        IODevice.call(this, "CMOS", system, io, memory, options);

        this.memoryAddress = 0;
        this.registers = [];
    }

    util.inherit(CMOS).from(IODevice);

    util.extend(CMOS.prototype, {
        getIOPorts: function () {
            return {
                0x0070: { description: "CMOS RAM", allowedIOLengths: {1: true} },
                0x0071: { description: "CMOS RAM", allowedIOLengths: {1: true} }
            };
        },

        init: function () {
            /*jshint bitwise: false */
            var cmos = this,
                extendedMemoryKBAbove16MB,
                extendedMemoryKBBelow64MB,
                memoryInKB,
                promise = new Promise(),
                ram = new ArrayBuffer(0x80),
                registers = cmos.registers,
                romPath;

            // 128 bytes of CMOS RAM
            util.from(0x00).to(0x80, function (index) {
                registers[index] = new Register(ram, index, 1);
            });

            cmos.system.observeEquipment(function () {
                var numberOfSupportedFloppies = cmos.system.getNumberOfSupportedFloppies();

                registers[0x10].set(cmos.system.getFloppyDriveType());

                if (numberOfSupportedFloppies > 0) {
                    registers[0x14].set((registers[0x14].get() & 0x3e) | ((numberOfSupportedFloppies - 1) << 6) | 1);
                } else {
                    registers[0x14].set(registers[0x14].get() & 0x3e);
                }

                registers[0x14].set(registers[0x14].get() | 4);
            });

            registers[0x15].set(BASE_MEMORY_IN_K & 0xFF);
            registers[0x16].set(BASE_MEMORY_IN_K >>> 8);

            memoryInKB = cmos.memory.getSizeInBytes() / 1024;
            extendedMemoryKBBelow64MB = Math.min(0xfc00, Math.max(0, memoryInKB - 1024));

            registers[0x17].set(extendedMemoryKBBelow64MB & 0xFF);
            registers[0x18].set(extendedMemoryKBBelow64MB >>> 8);
            registers[0x30].set(extendedMemoryKBBelow64MB & 0xFF);
            registers[0x31].set(extendedMemoryKBBelow64MB >>> 8);

            extendedMemoryKBAbove16MB = Math.min(0xffff, Math.max(0, memoryInKB - 16384) / 64);

            registers[0x34].set(extendedMemoryKBAbove16MB & 0xFF);
            registers[0x35].set(extendedMemoryKBAbove16MB >>> 8);

            (function () {
                /*jshint bitwise: false */
                //setRegister(cmos, 0x2D, getRegister(cmos, 0x2D) | 0x20);
                registers[0x3D].set(1 | (2 << 4));
                registers[0x38].set(true | (3 << 4));
            }());

            romPath = cmos.options[BIOS_ROM_OPTION];

            if (romPath) {
                util.get(romPath).done(function (buffer) {
                    cmos.system.write({
                        data: buffer,
                        to: 0xF0000 //(1 << 19)
                    });
                    promise.resolve();
                });
            } else {
                promise.resolve();
            }

            return promise;
        },

        ioRead: function (port) {
            var cmos = this;

            if (port === 0x0070) {
                // This register is write-only on most machines
                cmos.system.debug("CMOS.ioRead() :: Read of index port 0x70. Returning 0xFF");
                return 0xFF;
            }

            // Read from the address set previously by port 0x70
            if (port === 0x0071) {
                return cmos.registers[cmos.memoryAddress].get();
            }

            cmos.system.debug("CMOS.ioRead() :: Unsupported read");
            return 0xFF;
        },

        ioWrite: function (port, value) {
            var cmos = this;

            /*jshint bitwise: false */
            if (port === 0x0070) {
                // Take first 7 bits of value to use as register index to read from/write to
                cmos.memoryAddress = value & 0x7F;
                return;
            }

            if (port === 0x0071) {
                cmos.registers[cmos.memoryAddress].set(value);
                return;
            }

            cmos.system.debug("CMOS.ioWrite() :: Unsupported write");
        },

        reset: function () {
            var cmos = this;

            return cmos;
        }
    });

    return CMOS;
});
