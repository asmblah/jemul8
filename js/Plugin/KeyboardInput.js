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
    "js/plugins/std.keyboard"
], function (
    util,
    legacyPlugin
) {
    "use strict";

    function KeyboardInputPlugin() {

    }

    util.extend(KeyboardInputPlugin.prototype, {
        setupIODevices: function () {
            return {
                "PS/2": function (legacyPS2) {
                    legacyPlugin.applyTo({
                        machine: {
                            keyboard: legacyPS2
                        }
                    });
                }
            };
        }
    });

    return KeyboardInputPlugin;
});
