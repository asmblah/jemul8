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
    "js/Jemul8"
], function (
    util,
    Emulator,
    Jemul8
) {
    "use strict";

    describe("Jemul8", function () {
        var jemul8;

        beforeEach(function () {
            jemul8 = new Jemul8();
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
