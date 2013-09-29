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
    "js/plugins/std.canvas.vga"
], function (
    util,
    legacyPlugin
) {
    "use strict";

    function CanvasVGARendererPlugin() {

    }

    util.extend(CanvasVGARendererPlugin.prototype, {
        setupIODevices: function () {
            return {
                "VGA": function (legacyVGA) {
                    legacyPlugin.applyTo({
                        machine: {
                            vga: legacyVGA
                        }
                    });
                }
            };
        }
    });

    return CanvasVGARendererPlugin;
});
