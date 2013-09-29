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
    "js/CPU",
    "js/Emulator",
    "js/IO",
    "js/Memory",
    "js/Promise",
    "js/System"
], function (
    util,
    CPU,
    Emulator,
    IO,
    Memory,
    Promise,
    System
) {
    "use strict";

    describe("Emulator", function () {
        var cpu,
            emulator,
            io,
            memory,
            system;

        beforeEach(function () {
            cpu = new CPU();
            io = new IO();
            memory = new Memory();
            system = new System();

            emulator = new Emulator(system, io, memory, cpu);
        });

        describe("getCPURegisters()", function () {
            it("should return the CPU's registers", function () {
                var registers = {};

                sinon.stub(cpu, "getRegisters").returns(registers);

                expect(emulator.getCPURegisters()).to.equal(registers);
            });
        });

        describe("run()", function () {
            it("should return a Promise", function () {
                expect(cpu.run()).to.be.an.instanceOf(Promise);
            });
        });

        describe("write()", function () {
            it("should return the Emulator object for chaining");

            it("should throw an Exception if 'options' does not specify 'data'");

            it("should throw an Exception if 'options' does not specify 'at'");
        });
    });
});
