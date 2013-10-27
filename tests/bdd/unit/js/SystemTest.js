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
    "js/Clock",
    "js/CPU",
    "js/IO",
    "js/Memory",
    "js/Promise",
    "js/System"
], function (
    util,
    Clock,
    CPU,
    IO,
    Memory,
    Promise,
    System
) {
    "use strict";

    describe("System", function () {
        var clock,
            cpu,
            io,
            memory,
            system;

        beforeEach(function (done) {
            clock = sinon.createStubInstance(Clock);
            cpu = sinon.createStubInstance(CPU);
            io = sinon.createStubInstance(IO);
            memory = sinon.createStubInstance(Memory);
            system = new System(clock, io, memory);

            system.setCPU(cpu);

            cpu.init.returns(new Promise().resolve());
            io.init.returns(new Promise().resolve());
            memory.init.returns(new Promise().resolve());

            system.init().done(function () {
                done();
            });
        });

        describe("getCPURegisters()", function () {
            it("should return the CPU's registers", function () {
                var registers = {};

                cpu.getRegisters.returns(registers);

                expect(system.getCPURegisters()).to.equal(registers);
            });
        });

        describe("run()", function () {
            it("should return the result from cpu.run()", function () {
                var result = {};
                cpu.run.returns(result);

                expect(system.run()).to.equal(result);
            });
        });

        describe("write()", function () {
            it("should return the Emulator object for chaining");

            it("should throw an Exception if 'options' does not specify 'data'");

            it("should throw an Exception if 'options' does not specify 'at'");
        });
    });
});
