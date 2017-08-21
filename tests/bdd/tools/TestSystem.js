/**
 * jemul8 - JavaScript x86 Emulator
 * http://jemul8.com/
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*global ArrayBuffer, DataView, define, Uint8Array */
define([
    "js/util",
    "tools/Factory/Assembler",
    "js/EventEmitter",
    "js/MemoryAllocator",
    "js/Promise",
    "js/Factory/System"
], function (
    util,
    AssemblerFactory,
    EventEmitter,
    MemoryAllocator,
    Promise,
    SystemFactory
) {
    "use strict";

    var LOAD_ADDRESS = 0x00000100,
        assembledCache = {},
        memorySize = 32 * 1024 * 1024,
        // Statically create the memory buffer once and reuse, so we don't run out of JavaScript memory
        memoryBuffer = new DataView(new ArrayBuffer(memorySize)),
        zeroMemoryBuffer = new Uint8Array(memorySize);

    function TestSystem(options) {
        EventEmitter.call(this);

        this.assembler = new AssemblerFactory().create();
        this.memoryAllocator = new MemoryAllocator();

        // Zero out memory buffer
        new Uint8Array(memoryBuffer.buffer).set(zeroMemoryBuffer);
        sinon.stub(this.memoryAllocator, "allocateBytes").returns(memoryBuffer);

        this.system = new SystemFactory(this.memoryAllocator).create(options);
        this.ticksNow = null;
    }

    util.inherit(TestSystem).from(EventEmitter);

    util.extend(TestSystem.prototype, {
        getSystem: function () {
            return this.system;
        },

        init: function () {
            var promise = new Promise(),
                system = this.system;

            system.init().done(function () {
                promise.resolve();
            }).fail(function (exception) {
                promise.reject(exception);
            });

            return promise;
        },

        execute: function (assembly, options) {
            var promise = new Promise(),
                testSystem = this,
                assembler = testSystem.assembler,
                system = testSystem.system,
                registers = system.getCPURegisters();

            function execute(buffer) {
                // Write harness machine code to memory
                system.write({
                    data: buffer,
                    to:   LOAD_ADDRESS
                });

                // Point CPU at first loaded instruction
                registers.cs.set(0x0000);
                registers.eip.set(options.entrypoint || LOAD_ADDRESS);

                testSystem.emit("pre-run");

                system.run().done(function () {
                    promise.resolve();
                }).fail(function () {
                    promise.reject();
                });
            }

            options = options || {};

            if (assembledCache[assembly]) {
                execute(assembledCache[assembly]);
            } else {
                assembler.assemble(assembly).done(function (buffer) {
                    assembledCache[assembly] = buffer;
                    execute(buffer);
                }).fail(function (exception) {
                    promise.reject(exception);
                });
            }

            return promise;
        },

        stubClock: function () {
            var testSystem = this;

            testSystem.ticksNow = 0;

            sinon.stub(testSystem.system.getClock(), "getTicksNow").callsFake(function () {
                return testSystem.ticksNow;
            });
        },

        tickForwardBy: function (ticks) {
            var promise = new Promise(),
                testSystem = this,
                system = testSystem.system;

            testSystem.ticksNow += ticks;
            system.handleAsynchronousEvents();
            system.run().done(function () {
                promise.resolve();
            });

            return promise;
        }
    });

    return TestSystem;
});
