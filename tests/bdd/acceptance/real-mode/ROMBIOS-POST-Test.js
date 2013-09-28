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

    describe("ROMBIOS POST acceptance tests", function () {
        beforeEach(function () {
            // Allow extra time, as we are running a full ROMBIOS POST
            describe.setSlowTimeout(4000);
        });

        afterEach(function () {
            describe.restoreSlowTimeout();
        });

        describe("when the boot uses the default setup, handled by emulator.init()", function () {
            var cpuState,
                emulator;

            beforeEach(function (done) {
                var jemul8 = new Jemul8();

                emulator = jemul8.createEmulator({
                    rombios: "../../docs/bochs-20100605/bios/BIOS-bochs-legacy",
                    vgabios: "../../docs/bochs-20100605/bios/VGABIOS-lgpl-latest"
                });
                cpuState = emulator.getCPUState();

                emulator.init().done(function () {
                    done();
                });
            });

            it("should complete the POST by executing INT 0x19", function (done) {
                // Run the emulator, wait for INT 0x19 "Boot Load Service Entry Point"
                emulator.on("interrupt", [0x19], function () {
                    emulator.pause();
                    done();
                }).run();
            });
        });
    });
});
