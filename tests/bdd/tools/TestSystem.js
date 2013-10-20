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
    "tools/Factory/Assembler",
    "js/Promise",
    "js/Factory/System"
], function (
    util,
    AssemblerFactory,
    Promise,
    SystemFactory
) {
    "use strict";

    var LOAD_ADDRESS = 0x00000100;

    function TestSystem() {
        this.assembler = new AssemblerFactory().create();
        this.assembledCache = {};
        this.system = new SystemFactory().create();
        this.ticksNow = null;
    }

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

        execute: function (assembly) {
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
                registers.eip.set(LOAD_ADDRESS);

                system.run().done(function () {
                    promise.resolve();
                });
            }

            if (testSystem.assembledCache[assembly]) {
                execute(testSystem.assembledCache[assembly]);
            } else {
                assembler.assemble(assembly).done(function (buffer) {
                    testSystem.assembledCache[assembly] = buffer;
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

            sinon.stub(testSystem.system.getClock(), "getTicksNow", function () {
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
