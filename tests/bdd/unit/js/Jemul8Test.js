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
    "js/Emulator",
    "js/Jemul8",
    "js/MemoryAllocator",
    "js/Factory/System"
], function (
    util,
    Emulator,
    Jemul8,
    MemoryAllocator,
    SystemFactory
) {
    "use strict";

    describe("Jemul8", function () {
        var jemul8;

        beforeEach(function () {
            jemul8 = new Jemul8(new SystemFactory(new MemoryAllocator()));
        });

        describe("createEmulator()", function () {
            it("should return an Emulator", function () {
                expect(jemul8.createEmulator()).to.be.an.instanceOf(Emulator);
            });

            it("should return a different Emulator when called for a second time", function () {
                var firstEmulator = jemul8.createEmulator();

                expect(jemul8.createEmulator()).to.not.equal(firstEmulator);
            });
        });
    });
});
