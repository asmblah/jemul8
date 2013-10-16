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
    "js/IO",
    "js/Memory",
    "js/System"
], function (
    util,
    IO,
    Memory,
    System
) {
    "use strict";

    describe("CMOS I/O device", function () {
        var cmos,
            io,
            memory,
            mock,
            options,
            stubUtil,
            system;

        beforeEach(function (done) {
            io = new IO();
            memory = new Memory();
            options = {
                get: sinon.stub()
            };
            system = new System();

            stubUtil = Object.create(util);

            describe.stubRequire({
                map: {
                    "js/util": stubUtil
                }
            }, [
                "js/IODevice/CMOS"
            ], function (
                CMOS
            ) {
                cmos = new CMOS(system, io, memory, options);
                done();
            });
        });

        describe("init()", function () {
            /*it("should register for read/write of I/O ports 0x0070 and 0x0071", function () {
                //sinon.stub(cmos, "registerIRQ");
                mock = sinon.mock(cmos);
                mock.expects("registerIO").withArgs(sinon.match.any, sinon.match.hasOwn("port", 0x0070));
                mock.expects("registerIO").withArgs(sinon.match.any, sinon.match.hasOwn("port", 0x0071));

                cmos.init();

                mock.verify();
            });*/
        });
    });
});
