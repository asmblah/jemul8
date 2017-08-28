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

    var DEFAULT_MEMORY_MEGABYTES = 128;

    function Memory(memoryAllocator, options) {
        this.cpu = null;
        this.options = options || {};
        this.pageDirectoryAddress = 0;
        this.pagingEnabled = false;
        this.sizeInBytes = (this.options.kilobytes || DEFAULT_MEMORY_MEGABYTES * 1024) * 1024;
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
                    exception: function (vector, code) {
                        memory.cpu.exception(vector, code);
                    },
                    CR2: {
                        get: function () {
                            return memory.cpu.registers.cr2.get();
                        },
                        set: function (value) {
                            memory.cpu.registers.cr2.set(value);
                        }
                    },
                    CR3: {
                        get: function () {
                            return memory.pageDirectoryAddress;
                        }
                    },
                    PG: {
                        get: function () {
                            /*jshint bitwise: false */
                            return memory.pagingEnabled & 1;
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
        }(this)), memoryAllocator.allocateBytes(this.sizeInBytes));
    }

    util.extend(Memory.prototype, {
        disablePaging: function () {
            this.pagingEnabled = false;
        },

        enablePaging: function () {
            this.pagingEnabled = true;
        },

        getView: function () {
            return this.legacyMemory.buffer;
        },

        getSizeInBytes: function () {
            return this.sizeInBytes;
        },

        init: function () {
            var memory = this,
                promise = new Promise();

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

        setCPU: function (cpu) {
            this.cpu = cpu;
        },

        setPageDirectoryAddress: function (address) {
            this.pageDirectoryAddress = address;
        },

        setSystem: function (system) {
            this.system = system;
        },

        writeLinear: function (linearAddress, value, size) {
            /*jshint bitwise: false */
            var memory = this,
                page = linearAddress >>> 8;

            /*if (134 >= linearAddress && 134 < linearAddress + size) {
                debugger;
            }*/

            memory.system.purgePage(page);

            memory.legacyMemory.writeLinear(linearAddress, value, size);
        },

        writePhysical: function (physicalAddress, value, size) {
            /*jshint bitwise: false */
            var memory = this,
                page = physicalAddress >>> 8;

            memory.system.purgePage(page);

            memory.legacyMemory.writePhysical(physicalAddress, value, size);
        },

        writePhysicalBlock: function (physicalAddress, fromBuffer) {
            /*jshint bitwise: false */
            var memory = this,
                startPage = physicalAddress >>> 8,
                endPage = (physicalAddress + fromBuffer.byteLength - 1) >>> 8,
                page;

            for (page = startPage; page <= endPage; page++) {
                memory.system.purgePage(page);
            }

            this.legacyMemory.writePhysicalBlock(physicalAddress, fromBuffer);
        }
    });

    return Memory;
});
