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

    var BIOS_ROM_OPTION = "bios";

    function CMOS(system, io, memory, options) {
        IODevice.call(this, "CMOS", system, io, memory, options);

        this.memoryAddress = 0;
        this.registers = [];
    }

    util.inherit(CMOS).from(IODevice);

    util.extend(CMOS.prototype, {
        init: function () {
            var cmos = this,
                promise = new Promise(),
                ram = new ArrayBuffer(0x80),
                registers = cmos.registers,
                romPath;

            // 128 bytes of CMOS RAM
            util.from(0x00).to(0x80, function (index) {
                registers[index] = new Register(ram, index, 1);
            });

            cmos.system.observeEquipment(function () {
                /*jshint bitwise: false */
                var numberOfSupportedFloppies = cmos.system.getNumberOfSupportedFloppies();

                registers[0x10].set(cmos.system.getFloppyDriveType());

                if (numberOfSupportedFloppies > 0) {
                    registers[0x14].set((registers[0x14].get() & 0x3e) | ((numberOfSupportedFloppies - 1) << 6) | 1);
                } else {
                    registers[0x14].set(registers[0x14].get() & 0x3e);
                }
            });

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
                        to: 0xF0000
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
