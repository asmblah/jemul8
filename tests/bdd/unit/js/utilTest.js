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

/*global afterEach, beforeEach, define, describe, expect, it, sinon */
define([
    "jquery",
    "modular",
    "require",
    "js/util"
], function (
    $,
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
    });
});
