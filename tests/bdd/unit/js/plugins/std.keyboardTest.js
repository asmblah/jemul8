/*
 * jemul8 - JavaScript x86 Emulator
 * Copyright (c) 2013 http://ovms.co. All Rights Reserved.
 *
 * MODULE: Tests for simple DOM event-based keyboard plugin
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
    "js/core/util"
], function (
    $,
    modular,
    require,
    rootUtil
) {
    "use strict";

    describe("Standard Keyboard plugin", function () {
        var document,
            emu,
            event,
            generateScancode,
            mock,
            util;

        beforeEach(function (done) {
            document = {};
            generateScancode = sinon.spy();

            emu = {
                machine: {
                    keyboard: {
                        keyboard: {
                            generateScancode: generateScancode
                        }
                    }
                }
            };

            util = {
                global: {
                    document: document
                }
            };

            require([
                "Modular"
            ], function (
                Modular
            ) {
                var mockModular = new Modular(),
                    define = mockModular.createDefiner();

                define("jquery", function () {
                    return $;
                });
                define("../../js/core/util", util);

                mockModular.createRequirer()(rootUtil.extend({}, modular.configure(), {
                    cache: false
                }), [
                    "../../js/plugins/std.keyboard"
                ], function (
                    keyboardPlugin
                ) {
                    keyboardPlugin.applyTo(emu);
                    done();
                });
            });
        });

        describe("when no events have fired", function () {
            it("should not call generateScancode()", function () {
                expect(generateScancode.called).to.be.false;
            });
        });

        rootUtil.each([
            {keyName: "KEY_F1", keyCode: 112, keyIndex: 2},
            {keyName: "KEY_F2", keyCode: 113, keyIndex: 3},
            {keyName: "KEY_F3", keyCode: 114, keyIndex: 4},
            {keyName: "KEY_F4", keyCode: 115, keyIndex: 5},
            {keyName: "KEY_F5", keyCode: 116, keyIndex: 6},
            {keyName: "KEY_F6", keyCode: 117, keyIndex: 7},
            {keyName: "KEY_F7", keyCode: 118, keyIndex: 8},
            {keyName: "KEY_F8", keyCode: 119, keyIndex: 9},
            {keyName: "KEY_F9", keyCode: 120, keyIndex: 10},
            {keyName: "KEY_F10", keyCode: 121, keyIndex: 11},
            {keyName: "KEY_F11", keyCode: 122, keyIndex: 12},
            {keyName: "KEY_F12", keyCode: 123, keyIndex: 13},
            {keyName: "KEY_BACKSPACE", keyCode: 8, keyIndex: 69},
            {keyName: "KEY_ENTER", keyCode: 13, keyIndex: 70},
            {keyName: "KEY_SHIFT_L", keyCode: 16, keyIndex: 1},
            {keyName: "KEY_ESC", keyCode: 27, keyIndex: 56},
            {keyName: "KEY_SPACE", keyCode: 32, keyIndex: 57},
            {keyName: "KEY_LEFT", keyCode: 37, keyIndex: 97},
            {keyName: "KEY_UP", keyCode: 38, keyIndex: 95},
            {keyName: "KEY_RIGHT", keyCode: 39, keyIndex: 98},
            {keyName: "KEY_DOWN", keyCode: 40, keyIndex: 96},
            {keyName: "KEY_PERIOD", keyCode: 190, keyIndex: 60}
        ], function (index, fixture) {
            describe("for key with keyCode " + fixture.keyCode + " (" + fixture.keyName + ")", function () {
                describe("when a 'keydown' event fires", function () {
                    beforeEach(function () {
                        event = new $.Event("keydown", { keyCode: fixture.keyCode });

                        $(document).trigger(event);
                    });

                    it("should generate a 'make' scancode", function () {
                        expect(generateScancode.calledWith(sinon.match.any, "make")).to.be.true;
                    });

                    it("should pass the correct keyIndex to generateScancode()", function () {
                        expect(generateScancode.calledWith(fixture.keyIndex)).to.be.true;
                    });

                    it("should prevent the default behaviour", function () {
                        expect(event.isDefaultPrevented()).to.be.true;
                    });
                });

                describe("when a 'keyup' event fires", function () {
                    beforeEach(function () {
                        event = new $.Event("keyup", { keyCode: fixture.keyCode });

                        $(document).trigger(event);
                    });

                    it("should generate a 'break' scancode", function () {
                        expect(generateScancode.calledWith(sinon.match.any, "break")).to.be.true;
                    });

                    it("should pass the correct keyIndex to generateScancode()", function () {
                        expect(generateScancode.calledWith(fixture.keyIndex)).to.be.true;
                    });

                    it("should not prevent the default behaviour (as it should not have any effect)", function () {
                        expect(event.isDefaultPrevented()).to.be.false;
                    });
                });
            });
        });
    });
});
