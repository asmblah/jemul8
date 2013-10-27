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
    "js/Exception",
    "js/core/classes/memory",
    "js/Promise"
], function (
    util,
    Exception,
    LegacyMemory,
    Promise
) {
    "use strict";

    function Memory(options) {
        this.options = options || {};
        this.system = null;

        this.legacyMemory = new LegacyMemory((function (memory) {
            var machine,
                vga = {
                    getName: function () {
                        return "VGA";
                    }
                };

            machine = {
                cpu: {
                    PG: {
                        get: function () {
                            return 0;
                        }
                    }
                },
                get maskA20 () {
                    return memory.system.getA20Mask();
                },
                vga: vga
            };

            vga.machine = machine;

            return machine;
        }(this)));
    }

    util.extend(Memory.prototype, {
        init: function () {
            var promise = new Promise();

            this.legacyMemory.init(function () {});

            return promise.resolve();
        },

        linearToPhysical: function (linearAddress) {
            return this.legacyMemory.linearToPhysical(linearAddress);
        },

        mapPhysical: function (physicalAddress) {
            return this.legacyMemory.mapPhysical(physicalAddress);
        },

        readLinear: function (linearAddress, size) {
            return this.legacyMemory.readLinear(linearAddress, size);
        },

        readPhysical: function (physicalAddress, size) {
            return this.legacyMemory.readPhysical(physicalAddress, size);
        },

        readPhysicalBlock: function (physicalAddress, toBuffer, size) {
            return this.legacyMemory.readPhysicalBlock(physicalAddress, toBuffer, size);
        },

        register: function (options) {
            var device = options.device,
                memory = this,
                startAddress = options.startAddress,
                endAddress = options.endAddress;

            memory.legacyMemory.registerMemoryHandlers(startAddress, endAddress, function (a20Address, length) {
                return device.memoryRead(a20Address, length);
            }, function (a20Address, value, length) {
                device.memoryWrite(a20Address, value, length);
            }, memory.legacyMemory.machine.vga);
        },

        setSystem: function (system) {
            this.system = system;
        },

        writeLinear: function (linearAddress, value, size) {
            this.legacyMemory.writeLinear(linearAddress, value, size);
        },

        writePhysical: function (physicalAddress, value, size) {
            this.legacyMemory.writePhysical(physicalAddress, value, size);
        },

        writePhysicalBlock: function (physicalAddress, fromBuffer, size) {
            this.legacyMemory.writePhysicalBlock(physicalAddress, fromBuffer, size);
        }
    });

    return Memory;
});
