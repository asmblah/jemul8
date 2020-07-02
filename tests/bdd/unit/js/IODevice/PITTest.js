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
    "js/IODevice/PCSpeaker",
    "js/IODevice/PIT",
    "js/System"
], function (
    util,
    Counter,
    IO,
    Memory,
    PCSpeaker,
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
            speaker,
            system;

        beforeEach(function () {
            io = sinon.createStubInstance(IO);
            memory = sinon.createStubInstance(Memory);
            system = sinon.createStubInstance(System);
            counter0 = sinon.createStubInstance(Counter);
            counter1 = sinon.createStubInstance(Counter);
            counter2 = sinon.createStubInstance(Counter);
            speaker = sinon.createStubInstance(PCSpeaker.default);

            pit = new PIT(system, io, memory, counter0, counter1, counter2, speaker);
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

        describe("isSpeakerDataOn()", function () {
            it("should return false by default", function () {
                expect(pit.isSpeakerDataOn()).to.be.false;
            });

            it("should return true when the speaker has been turned on", function () {
                pit.turnSpeakerDataOn();

                expect(pit.isSpeakerDataOn()).to.be.true;
            });
        });

        describe("turnSpeakerDataOn()", function () {
            describe("when counter 2's count represents a tone at 100Hz", function () {
                beforeEach(function () {
                    counter2.getInitialCount.returns(1193180 / 100);
                });

                it("should turn the speaker on at 100Hz", function () {
                    pit.turnSpeakerDataOn();

                    expect(speaker.turnOn).to.have.been.calledOnce;
                    expect(speaker.turnOn).to.have.been.calledWith(100);
                });

                it("should not turn the speaker off", function () {
                    pit.turnSpeakerDataOn();

                    expect(speaker.turnOff).not.to.have.been.called;
                });
            });

            describe("when counter 2's count represents a tone greater than 22050Hz", function () {
                beforeEach(function () {
                    counter2.getInitialCount.returns(1193180 / 22051);
                });

                it("should turn the speaker on, but clamped to 22050Hz", function () {
                    pit.turnSpeakerDataOn();

                    expect(speaker.turnOn).to.have.been.calledOnce;
                    expect(speaker.turnOn).to.have.been.calledWith(22050);
                });

                it("should not turn the speaker off", function () {
                    pit.turnSpeakerDataOn();

                    expect(speaker.turnOff).not.to.have.been.called;
                });
            });

            describe("when counter 2's count is 0", function () {
                beforeEach(function () {
                    counter2.getInitialCount.returns(0);
                });

                it("should not turn the speaker on", function () {
                    pit.turnSpeakerDataOn();

                    expect(speaker.turnOn).not.to.have.been.called;
                });

                it("should not turn the speaker off", function () {
                    pit.turnSpeakerDataOn();

                    expect(speaker.turnOff).not.to.have.been.called;
                });
            });
        });

        describe("turnSpeakerDataOff()", function () {
            it("should turn the speaker off", function () {
                pit.turnSpeakerDataOff();

                expect(speaker.turnOff).to.have.been.calledOnce;
            });

            it("should not turn the speaker on", function () {
                pit.turnSpeakerDataOff();

                expect(speaker.turnOn).not.to.have.been.called;
            });
        });
    });
});
