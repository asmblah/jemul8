/*
 * jemul8 - JavaScript x86 Emulator
 * Copyright (c) 2013 http://ovms.co. All Rights Reserved.
 *
 * MODULE: Tests for Register
 *
 * ====
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*global afterEach, beforeEach, define, describe, expect, it, sinon */
define([
    "jquery",
    "modular",
    "require",
    "js/util",
    "js/core/classes/register"
], function (
    $,
    modular,
    require,
    util,
    Register
) {
    "use strict";

    describe("Register", function () {
        var register;

        describe("clear()", function () {
            util.each([1, 2, 4], function (sizeInBytes) {
                describe("when the Register is " + sizeInBytes + " byte(s) wide", function () {
                    beforeEach(function () {
                        register = new Register(null, sizeInBytes);
                    });

                    util.each([
                        {previousValue: 0},
                        {previousValue: 1},
                        {previousValue: 0xFF},
                        {previousValue: 0xFFFF},
                        {previousValue: 0xFFFFFFFF}
                    ], function (fixture) {
                        var maskedPreviousValue = util.mask(fixture.previousValue, util.generateMask(sizeInBytes));

                        it("should set the Register's value to 0 when its value was previously " + fixture.previousValue, function () {
                            register.set(fixture.previousValue);
                            register.clear();

                            expect(register.get()).to.equal(0);
                        });
                    });
                });
            });
        });

        describe("get()/set()", function () {
            util.each([1, 2, 4], function (sizeInBytes) {
                describe("when the Register is " + sizeInBytes + " byte(s) wide", function () {
                    beforeEach(function () {
                        register = new Register(null, sizeInBytes);
                    });

                    util.each([
                        {previousValue: 1, value: 0},
                        {previousValue: 1, value: 1},
                        {previousValue: 1, value: 0xFF},
                        {previousValue: 1, value: 0xFFFF},
                        {previousValue: 1, value: 0xFFFFFFFF}
                    ], function (fixture) {
                        var maskedPreviousValue = util.mask(fixture.previousValue, util.generateMask(sizeInBytes)),
                            maskedValue = util.mask(fixture.value, util.generateMask(sizeInBytes));

                        it("should actually set the Register's value to " + maskedValue + " when trying to set it to " + fixture.value + " and its value was previously " + maskedPreviousValue, function () {
                            register.set(fixture.previousValue);
                            register.set(fixture.value);

                            expect(register.get()).to.equal(maskedValue);
                        });
                    });
                });
            });
        });

        describe("getHexString()", function () {
            util.each([
                {sizeInBytes: 1, values: [
                    {value: 0,    hex: "      00"},
                    {value: 1,    hex: "      01"},
                    {value: 0xFF, hex: "      FF"}
                ]},
                {sizeInBytes: 2, values: [
                    {value: 0,      hex: "    0000"},
                    {value: 1,      hex: "    0001"},
                    {value: 0xFF,   hex: "    00FF"},
                    {value: 0xFFFF, hex: "    FFFF"}
                ]},
                {sizeInBytes: 4, values: [
                    {value: 0,          hex: "00000000"},
                    {value: 1,          hex: "00000001"},
                    {value: 0xFF,       hex: "000000FF"},
                    {value: 0xFFFF,     hex: "0000FFFF"},
                    {value: 0xFFFFFFFF, hex: "FFFFFFFF"}
                ]}
            ], function (fixture) {
                describe("when the Register is " + fixture.sizeInBytes + " byte(s) wide", function () {
                    beforeEach(function () {
                        register = new Register(null, fixture.sizeInBytes);
                    });

                    util.each(fixture.values, function (fixture) {
                        it("should return " + fixture.hex + " when the Register's value is " + fixture.value, function () {
                            register.set(fixture.value);

                            expect(register.getHexString()).to.equal(fixture.hex);
                        });
                    });
                });
            });
        });
    });
});
