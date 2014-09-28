/*
 * jemul8 - JavaScript x86 Emulator
 * Copyright (c) 2013 http://ovms.co. All Rights Reserved.
 *
 * MODULE: Tests for Util
 *
 * ====
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*global define, describe, expect, it */
define([
    "modular",
    "require",
    "js/util"
], function (
    modular,
    require,
    util
) {
    "use strict";

    describe("Util", function () {
        it("should inherit from modular.util", function () {
            expect(Object.getPrototypeOf(util)).to.equal(modular.util);
        });

        describe("generateMask()", function () {
            util.each([
                {sizeInBytes: 0, mask: 0},
                {sizeInBytes: 1, mask: 0xFF},
                {sizeInBytes: 2, mask: 0xFFFF},
                {sizeInBytes: 3, mask: 0xFFFFFF},
                {sizeInBytes: 4, mask: 0xFFFFFFFF},
                // Only support up to 32-bit
                {sizeInBytes: 5, mask: 0xFFFFFFFF}
            ], function (fixture) {
                it("should return " + fixture.mask + " when sizeInBytes is " + fixture.sizeInBytes, function () {
                    expect(util.generateMask(fixture.sizeInBytes)).to.equal(fixture.mask);
                });
            });
        });

        // Parity is 1 if the no. of set bits is even (only applies to first 8 bits)
        describe("getParity()", function () {
            util.each([
                {number: 0, parity: 1},
                {number: 1, parity: 0},
                {number: 2, parity: 0},
                {number: 3, parity: 1},
                {number: parseInt("100000001", 2), parity: 0} // Odd no. of set bits because first is above low 8 bits
            ], function (scenario) {
                it("should return " + scenario.parity + " when number is " + scenario.number.toString(2) + "b", function () {
                    expect(util.getParity(scenario.number)).to.equal(scenario.parity);
                });
            });
        });

        describe("heredoc()", function () {
            util.each([
                {
                    heredoc: util.heredoc(function (/*<<<EOS
Line 1
Line 2
EOS
*/) {}),
                    expectedString: "Line 1\nLine 2"
                },
                {
                    heredoc: util.heredoc(function (/*<<<EOS
${person} walked up the stairs in ${person}'s flat.
EOS
*/) {}, {person: "Fred"}),
                    expectedString: "Fred walked up the stairs in Fred's flat."
                },
                {
                    heredoc: util.heredoc(function (/*<<<EOS
The ladder is ${length}cm long.
EOS
*/) {}, {length: 12}),
                    expectedString: "The ladder is 12cm long."
                }
            ], function (scenario, index) {
                it("should return the correct string for heredoc #" + (index + 1), function () {
                    expect(scenario.heredoc).to.equal(scenario.expectedString);
                });
            });
        });

        describe("hexify()", function () {
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
                describe("when the value is " + scenario.byteSize + " byte(s) wide", function () {
                    util.each(scenario.values, function (fixture) {
                        it("should return " + fixture.hex + " when the value is " + fixture.value, function () {
                            expect(util.hexify(fixture.value, scenario.byteSize)).to.equal(fixture.hex);
                        });
                    });
                });
            });
        });

        describe("inherit()", function () {
            it("should set the .prototype of the To class to be an object that uses the From class' .prototype as its prototype", function () {
                function From() {}
                function To() {}

                util.inherit(To).from(From);

                expect(Object.getPrototypeOf(To.prototype)).to.equal(From.prototype);
            });
        });

        describe("mask()", function () {
            util.each([
                {number: 0, mask: 0, result: 0},

                {number: 0, mask: 0xFF, result: 0},
                {number: 1, mask: 0xFF, result: 1},
                {number: 0xFE, mask: 0xFF, result: 0xFE},
                {number: 0xFF, mask: 0xFF, result: 0xFF},
                {number: 0x100, mask: 0xFF, result: 0},

                {number: 0, mask: 0xFFFF, result: 0},
                {number: 1, mask: 0xFFFF, result: 1},
                {number: 0xFE, mask: 0xFFFF, result: 0xFE},
                {number: 0xFF, mask: 0xFFFF, result: 0xFF},
                {number: 0x100, mask: 0xFFFF, result: 0x100},
                {number: 0xFFFF, mask: 0xFFFF, result: 0xFFFF},
                {number: 0x10000, mask: 0xFFFF, result: 0},

                {number: 0, mask: 0xFFFFFFFF, result: 0},
                {number: 1, mask: 0xFFFFFFFF, result: 1},
                {number: 0xFE, mask: 0xFFFFFFFF, result: 0xFE},
                {number: 0xFF, mask: 0xFFFFFFFF, result: 0xFF},
                {number: 0x100, mask: 0xFFFFFFFF, result: 0x100},
                {number: 0xFFFF, mask: 0xFFFF, result: 0xFFFF},
                {number: 0x10000, mask: 0xFFFFFFFF, result: 0x10000},
                {number: 0xFFFFFFFF, mask: 0xFFFFFFFF, result: 0xFFFFFFFF}
            ], function (fixture) {
                it("should return " + fixture.result + " when number is " + fixture.number + " and mask is " + fixture.mask, function () {
                    expect(util.mask(fixture.number, fixture.mask)).to.equal(fixture.result);
                });
            });
        });

        describe("millisecondsToTicks", function () {
            util.each([
                // One second
                {milliseconds: 1000, ticks: 1193181}
            ], function (scenario) {
                it("should return " + scenario.ticks + " for " + scenario.milliseconds + " milliseconds", function () {
                    expect(util.millisecondsToTicks(scenario.milliseconds)).to.equal(scenario.ticks);
                });
            });
        });

        describe("toSigned()", function () {
            util.each([
                {number: 0xff, sizeInBytes: 1, result: -1},
                {number: 0xffff, sizeInBytes: 2, result: -1},
                {number: 0xffffffff, sizeInBytes: 4, result: -1},
                {number: 0xfffffffd, sizeInBytes: 4, result: -3}
            ], function (scenario) {
                describe("when the number is " + scenario.number + " of size " + scenario.size, function () {
                    it("should give " + scenario.result + " as the result", function () {
                        expect(util.toSigned(scenario.number, scenario.sizeInBytes)).to.equal(scenario.result);
                    });
                });
            });
        });
    });
});
