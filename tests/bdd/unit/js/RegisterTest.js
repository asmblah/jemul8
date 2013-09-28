/**
 * jemul8 - JavaScript x86 Emulator
 * http://jemul8.com/
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*global define, ArrayBuffer */
define([
    "js/util",
    "js/Register"
], function (
    util,
    Register
) {
    "use strict";

    describe("Register", function () {
        var buffer,
            mock,
            register;

        beforeEach(function () {
            buffer = new ArrayBuffer(4);
        });

        describe("clear()", function () {
            util.each([1, 2, 4], function (byteSize) {
                describe("when the Register is " + byteSize + " byte(s) wide", function () {
                    beforeEach(function () {
                        register = new Register(buffer, 0, byteSize);
                    });

                    util.each([
                        {previousValue: 0},
                        {previousValue: 1},
                        {previousValue: 0xFF},
                        {previousValue: 0xFFFF},
                        {previousValue: 0xFFFFFFFF}
                    ], function (scenario) {
                        it("should set the Register's value to 0 when its value was previously " + scenario.previousValue, function () {
                            register.set(scenario.previousValue);
                            register.clear();

                            expect(register.get()).to.equal(0);
                        });
                    });
                });
            });
        });

        describe("createSubRegister()", function () {
            var subregister;

            util.each([
                {byteSize: 1, subregisterOffset: 0, subregisterByteSize: 1},
                {byteSize: 4, subregisterOffset: 2, subregisterByteSize: 2}
            ], function (scenario) {
                describe("when the register byteSize is " + scenario.byteSize + ", subregister offset is " + scenario.subregisterOffset + " and subregister byteSize is " + scenario.subregisterByteSize, function () {
                    beforeEach(function () {
                        register = new Register(buffer, 0, scenario.byteSize);
                        subregister = register.createSubRegister(scenario.subregisterOffset, scenario.subregisterByteSize);
                    });

                    it("should return a Register", function () {
                        expect(subregister).to.be.an.instanceOf(Register);
                    });
                });
            });

            describe("subregister name", function () {
                beforeEach(function () {
                    register = new Register(buffer, 0, 1);
                });

                util.each(["eax", "ebp"], function (name) {
                    it("should set the subregister's name to '" + name + "' when passed", function () {
                        subregister = register.createSubRegister(0, 1, name);

                        expect(subregister.getName()).to.equal(name);
                    });
                });

                it("should return null when the name is not specified", function () {
                    subregister = register.createSubRegister(0, 1);

                    expect(subregister.getName()).to.be.null;
                });
            });
        });

        describe("get()/set()", function () {
            util.each([1, 2, 4], function (byteSize) {
                describe("when the Register is " + byteSize + " byte(s) wide", function () {
                    beforeEach(function () {
                        register = new Register(buffer, 0, byteSize);
                    });

                    util.each([
                        {previousValue: 1, value: 0},
                        {previousValue: 1, value: 1},
                        {previousValue: 1, value: 0xFF},
                        {previousValue: 1, value: 0xFFFF},
                        {previousValue: 1, value: 0xFFFFFFFF}
                    ], function (scenario) {
                        var maskedPreviousValue = util.mask(scenario.previousValue, util.generateMask(byteSize)),
                            maskedValue = util.mask(scenario.value, util.generateMask(byteSize));

                        it("should actually set the Register's value to " + maskedValue + " when trying to set it to " + scenario.value + " and its value was previously " + maskedPreviousValue, function () {
                            register.set(scenario.previousValue);
                            register.set(scenario.value);

                            expect(register.get()).to.equal(maskedValue);
                        });
                    });
                });
            });

            describe("when the register is a subregister", function () {
                var subregister;

                util.each([
                    {byteSize: 1, subregisterOffset: 0, subregisterByteSize: 1, subregisterValue: 0x12, registerValue: 0x12},
                    {byteSize: 4, subregisterOffset: 2, subregisterByteSize: 2, subregisterValue: 0x6162, registerValue: 0x61620000}
                ], function (scenario) {
                    describe("when the register byteSize is " + scenario.byteSize + ", subregister offset is " + scenario.subregisterOffset + " and subregister byteSize is " + scenario.subregisterByteSize, function () {
                        beforeEach(function () {
                            register = new Register(buffer, 0, scenario.byteSize);
                            subregister = register.createSubRegister(scenario.subregisterOffset, scenario.subregisterByteSize);
                        });

                        it("should set the parent register to " + util.hexify(scenario.registerValue, scenario.byteSize) + " when the subregister is set to " + util.hexify(scenario.subregisterValue, scenario.byteSize), function () {
                            subregister.set(scenario.subregisterValue);

                            expect(register.get()).to.equal(scenario.registerValue);
                        });
                    });
                });
            });
        });

        describe("getHex()", function () {
            util.each([
                {byteSize: 1, values: [
                    {value: 0,    hex: "0x00000000"},
                    {value: 1,    hex: "0x00000001"},
                    {value: 0xFF, hex: "0x000000FF"}
                ]},
                {byteSize: 2, values: [
                    {value: 0,      hex: "0x00000000"},
                    {value: 1,      hex: "0x00000001"},
                    {value: 0xFF,   hex: "0x000000FF"},
                    {value: 0xFFFF, hex: "0x0000FFFF"}
                ]},
                {byteSize: 4, values: [
                    {value: 0,          hex: "0x00000000"},
                    {value: 1,          hex: "0x00000001"},
                    {value: 0xFF,       hex: "0x000000FF"},
                    {value: 0xFFFF,     hex: "0x0000FFFF"},
                    {value: 0xFFFFFFFF, hex: "0xFFFFFFFF"}
                ]}
            ], function (scenario) {
                describe("when the Register is " + scenario.byteSize + " byte(s) wide", function () {
                    beforeEach(function () {
                        register = new Register(buffer, 0, scenario.byteSize);
                    });

                    util.each(scenario.values, function (fixture) {
                        describe("when the Register's value is " + fixture.value, function () {
                            beforeEach(function () {
                                register.set(fixture.value);
                            });

                            it("should pass " + fixture.value + " as the first argument to util.hexify(...)", function () {
                                mock = sinon.mock(util);
                                mock.expects("hexify").withArgs(fixture.value);

                                register.getHex();

                                mock.verify();
                            });

                            it("should pass " + scenario.byteSize + " as the second argument to util.hexify(...)", function () {
                                mock = sinon.mock(util);
                                mock.expects("hexify").withArgs(sinon.match.any, scenario.byteSize);

                                register.getHex();

                                mock.verify();
                            });

                            it("should return " + fixture.hex + " when util.hexify(...) returns " + fixture.hex, function () {
                                sinon.stub(util, "hexify").returns(fixture.hex);

                                expect(register.getHex()).to.equal(fixture.hex);

                                util.hexify.restore();
                            });
                        });
                    });
                });
            });
        });

        describe("getName()", function () {
            util.each(["eax", "ebp"], function (name) {
                it("should return '" + name + "' when the Register's name is '" + name + "'", function () {
                    register = new Register(buffer, 0, 1, name);

                    expect(register.getName()).to.equal(name);
                });
            });

            it("should return null when the name is not specified", function () {
                register = new Register(buffer, 0, 1);

                expect(register.getName()).to.be.null;
            });
        });
    });
});
