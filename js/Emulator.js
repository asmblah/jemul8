/**
 * jemul8 - JavaScript x86 Emulator v0.0.1
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
    "js/Promise"
], function (
    util,
    EventEmitter,
    Exception,
    Promise
) {
    "use strict";

    var hasOwn = {}.hasOwnProperty;

    function Emulator(legacyJemul8) {
        EventEmitter.call(this);

        this.inited = false;
        this.legacyJemul8 = legacyJemul8;
        this.running = false;
    }

    util.inherit(Emulator).from(EventEmitter);

    util.extend(Emulator.prototype, {
        getCPU: function () {
            var legacyCPU = this.legacyJemul8.machine.cpu;

            return {
                getRegisters: function () {
                    return {
                        eax: legacyCPU.EAX,
                        ax: legacyCPU.AX,
                        al: legacyCPU.AL,
                        ah: legacyCPU.AH,

                        ecx: legacyCPU.ECX,
                        cx: legacyCPU.CX,
                        cl: legacyCPU.CL,
                        ch: legacyCPU.CH,

                        ebx: legacyCPU.EBX,
                        bx: legacyCPU.BX,
                        bl: legacyCPU.BL,
                        bh: legacyCPU.BH,

                        edx: legacyCPU.EDX,
                        dx: legacyCPU.DX,
                        dl: legacyCPU.DL,
                        dh: legacyCPU.DH,

                        ebp: legacyCPU.EBP,
                        bp: legacyCPU.BP,

                        edi: legacyCPU.EDI,
                        di: legacyCPU.DI,

                        esi: legacyCPU.ESI,
                        si: legacyCPU.SI,

                        esp: legacyCPU.ESP,
                        sp: legacyCPU.SP,

                        eip: legacyCPU.EIP,
                        ip: legacyCPU.IP,

                        cs: legacyCPU.CS,
                        ds: legacyCPU.DS,
                        es: legacyCPU.ES,
                        fs: legacyCPU.FS,
                        gs: legacyCPU.GS,
                        ss: legacyCPU.SS
                    };
                }
            };
        },

        init: function () {
            var emulator = this,
                legacyJemul8 = emulator.legacyJemul8,
                promise = new Promise();

            legacyJemul8.init(function () {
                emulator.inited = true;
                promise.resolve();
            });

            return promise;
        },

        pause: function () {
            var emulator = this;

            emulator.running = false;
            emulator.legacyJemul8.machine.cpu.pause();
            emulator.emit("pause");

            return emulator;
        },

        run: function () {
            var emulator = this,
                legacyJemul8 = emulator.legacyJemul8,
                legacyCPU = legacyJemul8.machine.cpu,
                promise = new Promise();

            if (!emulator.inited) {
                throw new Exception("Emulator.run() :: Not yet initialized");
            }

            emulator.running = true;
            legacyCPU.halt = (function (halt) {
                return function haltSpy() {
                    promise.resolve();
                    halt.call(legacyCPU);
                };
            }(legacyCPU.halt));
            legacyJemul8.run();

            return promise;
        },

        write: function (options) {
            var data,
                emulator = this,
                offset,
                size,
                to;

            options = options || {};

            if (!hasOwn.call(options, "data")) {
                throw new Exception("Emulator.write() :: 'data' not specified");
            }

            if (!util.isArray(options.data)) {
                throw new Exception("Emulator.write() :: 'data' must be an array");
            }

            if (!hasOwn.call(options, "to")) {
                throw new Exception("Emulator.write() :: 'to' not specified");
            }

            data = options.data;
            size = data.length;
            to = options.to;

            for (offset = 0; offset < size; offset += 1) {
                emulator.legacyJemul8.machine.mem.writePhysical(to + offset, data[offset], 1);
            }

            return emulator;
        }
    });

    return Emulator;
});
