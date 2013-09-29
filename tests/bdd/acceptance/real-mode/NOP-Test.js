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
    "js/Jemul8"
], function (
    util,
    Jemul8
) {
    "use strict";

    describe("NOP acceptance tests", function () {
        describe("when the program is NOP, NOP, NOP, HLT", function () {
            var emulator,
                registers;

            beforeEach(function (done) {
                emulator = new Jemul8().createEmulator();
                registers = emulator.getCPURegisters();

                emulator.init().done(function () {
                    // Write machine code for NOP, NOP, NOP, HLT to memory @ 0x0
                    emulator.write({
                        data: [0x90, 0x90, 0x90, 0xF4],
                        to:   0x00000000
                    });

                    // Get ready to execute these 4 instructions
                    registers.cs.set(0x0000);
                    registers.eip.set(0x00000000);

                    done();
                });
            });

            util.each([
                {eax: 0x12345678, ecx: 0x87654321, ebx: 0x01010101, edx: 0x02020202}
            ], function (fixture) {
                describe("when EAX is " + util.hexify(fixture.eax, 4) + ", ECX is " + util.hexify(fixture.ecx, 4) + ", EBX is " + util.hexify(fixture.ebx, 4) + " and EDX is " + util.hexify(fixture.edx, 4), function () {
                    beforeEach(function (done) {
                        registers.eax.set(fixture.eax);
                        registers.ecx.set(fixture.ecx);
                        registers.ebx.set(fixture.ebx);
                        registers.edx.set(fixture.edx);

                        // Run the emulator, wait for HLT
                        emulator.run().done(function () {
                            done();
                        });
                    });

                    it("should not modify EAX", function () {
                        expect(registers.eax.get()).to.equal(fixture.eax);
                    });

                    it("should not modify ECX", function () {
                        expect(registers.ecx.get()).to.equal(fixture.ecx);
                    });

                    it("should not modify EBX", function () {
                        expect(registers.ebx.get()).to.equal(fixture.ebx);
                    });

                    it("should not modify EDX", function () {
                        expect(registers.edx.get()).to.equal(fixture.edx);
                    });
                });
            });
        });
    });
});
