/*
 *  jemul8 - JavaScript x86 Emulator
 *  Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *
 * MODULE: Simple DOM event-based keyboard plugin
 *
 * ====
 *
 * Copyright 2013 jemul8.com (http://github.com/asmblah/jemul8)
 * Released under the MIT license
 * http://jemul8.com/MIT-LICENSE.txt
 */

/*jslint bitwise: true, plusplus: true */
/*global define */

define([
	"../core/util",
	"../core/classes/iodev/keyboard/scancode"
], function (
	util,
	Scancode
) {
    "use strict";

	var keyboardPlugin = {
		applyTo: function (emu) {
            var cancelKeypress = false,
                lastMouseX = -1,
                lastMouseY = -1;

            if (!util.global.document) {
                return;
            }

			util.global.document.addEventListener("keydown", function (evt) {
				var key = toKeyIndex(evt.keyCode);

				// Simple translation to KEY_* values (needs a keymap)
				emu.machine.keyboard.keyboard.generateScancode(key, "make");

				// Stop browser reacting to keystroke
				cancelKeypress = true;
				evt.preventDefault();
				return false;
			});
			util.global.document.addEventListener("keyup", function (evt) {
				var key = toKeyIndex(evt.keyCode);

				// Simple translation to KEY_* values (needs a keymap)
				emu.machine.keyboard.keyboard.generateScancode(key, "break");
			});
			util.global.document.addEventListener("keypress", function (evt) {
				if ( cancelKeypress ) {
					cancelKeypress = false; // Only this keypress
					evt.preventDefault();
					return false;
				}
			});

            function setUpMouse() {
                function handleMouse(evt) {
                    var newMouseX = evt.clientX,
                        newMouseY = evt.clientY,
                        mouseDeltaX = evt.movementX || (lastMouseX === -1 ? 0 : newMouseX - lastMouseX),
                        mouseDeltaY = evt.movementY || (lastMouseY === -1 ? 0 : newMouseY - lastMouseY),
                        buttonState = evt.type === "mouseup" ? 0 : evt.which;

                    emu.machine.keyboard.mouse.motion(mouseDeltaX, -mouseDeltaY, 0, buttonState);

                    lastMouseX = newMouseX;
                    lastMouseY = newMouseY;

                    evt.preventDefault();
                    return false;
                }

                util.global.document.addEventListener("mousemove", handleMouse);
                util.global.document.addEventListener("mousedown", handleMouse);
                util.global.document.addEventListener("mouseup", handleMouse);

                function setUpPointerLock() {
                    var canvas = util.global.document.getElementById("screenVGA"),
                        requestPointerLock = canvas.requestPointerLock ||
                            canvas.mozRequestPointerLock ||
                            canvas.webkitRequestPointerLock;

                    if (requestPointerLock) {
                        canvas.addEventListener("click", function () {
                            requestPointerLock.call(canvas);
                        });
                    }
                }

                setUpPointerLock();
            }

            setUpMouse();
		}
	};

	// Convert a DOM keyCode to a key index
	function toKeyIndex( keyCode ) {
		var specialKeys;
        //$("<div>").text(keyCode).insertBefore($("canvas"));

        if (keyCode >= 112 && keyCode <= 112 + 12) {
            return Scancode.getKeyIndex("KEY_F" + (keyCode - 112 + 1));
        }

        if (keyCode >= 48 && keyCode <= 57) {
            return Scancode.getKeyIndex("KEY_" + (keyCode - 48));
        }

        specialKeys = {
            8: "KEY_BACKSPACE",
            13: "KEY_ENTER",
            16: "KEY_SHIFT_L",
            17: "KEY_CTRL_L",
            27: "KEY_ESC",
            32: "KEY_SPACE",
            37: "KEY_LEFT",
            38: "KEY_UP",
            39: "KEY_RIGHT",
            40: "KEY_DOWN",
            186: "KEY_SEMICOLON",
            190: "KEY_PERIOD"
        };

        // Special key
        if (specialKeys[keyCode]) {
            return Scancode.getKeyIndex(specialKeys[keyCode]);
        }

        // Other ANSI key
        return keyCode - (65 - 20);
	}

	return keyboardPlugin;
});
