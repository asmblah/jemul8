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
    "js/Promise",
    "js/System"
], function (
    util,
    Emulator,
    Promise,
    System
) {
    "use strict";

    describe("Emulator", function () {
        var emulator,
            system;

        beforeEach(function () {
            system = sinon.createStubInstance(System);

            emulator = new Emulator(system);
        });

        describe("loadPlugin()", function () {
            it("should call system.loadPlugin() passing the correct arguments", function () {
                emulator.loadPlugin("keyboard");

                expect(system.loadPlugin).to.have.been.calledWith("keyboard");
            });
        });

        describe("run()", function () {
            it("should return the result from system.run()", function () {
                var result = {};
                system.run.returns(result);

                expect(emulator.run()).to.equal(result);
            });
        });

        describe("write()", function () {
            it("should return the Emulator object for chaining");

            it("should throw an Exception if 'options' does not specify 'data'");

            it("should throw an Exception if 'options' does not specify 'at'");
        });
    });
});
