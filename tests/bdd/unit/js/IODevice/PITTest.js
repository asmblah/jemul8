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
    "js/IODevice/PIT/Counter",
    "js/IO",
    "js/Memory",
    "js/IODevice/PIT",
    "js/System"
], function (
    util,
    Counter,
    IO,
    Memory,
    PIT,
    System
) {
    "use strict";

    describe("PIT device", function () {
        var counter0,
            counter1,
            counter2,
            io,
            memory,
            pit,
            system;

        beforeEach(function () {
            io = sinon.createStubInstance(IO);
            memory = sinon.createStubInstance(Memory);
            system = sinon.createStubInstance(System);
            counter0 = sinon.createStubInstance(Counter);
            counter1 = sinon.createStubInstance(Counter);
            counter2 = sinon.createStubInstance(Counter);

            pit = new PIT(system, io, memory, counter0, counter1, counter2);
        });

        describe("ioRead()", function () {
            util.each([0x12, 0x34], function (halfCount) {
                describe("when counter 0 returns " + halfCount + " as the half count", function () {
                    it("should return " + halfCount + " for port 0x40 on first read", function () {
                        counter0.receiveHalfCount.returns(halfCount);

                        expect(pit.ioRead(0x40)).to.equal(halfCount);
                    });

                    it("should also return " + halfCount + " for port 0x40 on second read", function () {
                        counter0.receiveHalfCount.returns(halfCount);
                        pit.ioRead(0x40); // First read

                        expect(pit.ioRead(0x40)).to.equal(halfCount);
                    });
                });
            });
        });
    });
});
