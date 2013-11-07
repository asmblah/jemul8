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

    var MAX_VGA_COLORS = 256;

    function CanvasVGARendererPlugin() {
        this.canvasContext = null;
        this.canvasHeight = 400;
        this.canvasWidth = 720;
        this.imageBuffer = null;
        this.imageData = null;
        this.palette = [];
        this.tileHeight = 0;
        this.tileWidth = 0;
        this.virtualBitsPerPixel = 0;
        this.virtualScreenHeight = 0;
    }

    util.extend(CanvasVGARendererPlugin.prototype, {
        dimensionUpdate: function (x, y, fontHeight, fontWidth, bitsPerPixel) {
            var plugin = this;

            plugin.virtualBitsPerPixel = bitsPerPixel;
            plugin.virtualScreenHeight = y;
        },

        graphicsTileUpdate: function (tile, x0, y0) {
            /*jshint bitwise: false */
            var colour,
                index,
                length,
                offset,
                plugin = this,
                tileImageData = plugin.canvasContext.createImageData(plugin.tileWidth, plugin.tileHeight),
                tileImageBuffer = tileImageData.data,
                x,
                y,
                ySize;

            // Initialise ImageData alpha values to 255 (opaque), so pixels actually appear when blitted
            for (index = 3, length = tileImageBuffer.length; index < length ; index += 4) {
                tileImageBuffer[index] = 0xFF;
            }

            // Draw the height of a tile, but clamp to the bottom of the screen
            if (y0 + plugin.tileHeight > plugin.virtualScreenHeight) {
                ySize = plugin.virtualScreenHeight - y0;
            } else {
                ySize = plugin.tileHeight;
            }

            if (plugin.virtualBitsPerPixel !== 8) {
                util.panic("CanvasVGARendererPlugin.graphicsTileUpdate() :: Only 8bpp supported");
            }

            for (y = 0; y < ySize; y++) {
                for (x = 0; x < plugin.tileWidth; x++) {
                    colour = plugin.palette[tile[(y * plugin.tileWidth) + x]];
                    offset = (4 * plugin.tileWidth * y) + (4 * x);

                    tileImageBuffer[offset] = colour.red;
                    tileImageBuffer[offset + 1] = colour.green;
                    tileImageBuffer[offset + 2] = colour.blue;
                }
            }

            plugin.canvasContext.putImageData(tileImageData, x0, y0);
        },

        paletteChange: function (index, red, green, blue) {
            /*jshint bitwise: false */
            var colour = this.palette[index];

            colour.red = red & 0xFF;
            colour.green = green & 0xFF;
            colour.blue = blue & 0xFF;
        },

        setupIODevices: function () {
            var plugin = this;

            return {
                "VGA": function (legacyVGA) {
                    var tileSize = legacyVGA.getTileSize();

                    plugin.canvasContext = legacyVGA.ctx_screenVGA;
                    plugin.imageBuffer = legacyVGA.imageData.data;
                    plugin.imageData = legacyVGA.imageData;
                    plugin.tileWidth = tileSize.width;
                    plugin.tileHeight = tileSize.height;

                    util.from(0).to(MAX_VGA_COLORS, function (colourIndex) {
                        plugin.palette[colourIndex] = {red: 0, green: 0, blue: 0};
                    });

                    legacyPlugin.applyTo({
                        machine: {
                            vga: legacyVGA
                        }
                    });

                    (function (textPaletteChange) {
                        legacyVGA.paletteChange = function (index, red, green, blue) {
                            plugin.paletteChange(index, red, green, blue);
                            textPaletteChange.call(legacyVGA, index, red, green, blue);
                        };
                    }(legacyVGA.paletteChange));

                    (function (textDimensionUpdate) {
                        legacyVGA.dimensionUpdate = function (x, y, fontHeight, fontWidth, bitsPerPixel) {
                            plugin.dimensionUpdate(x, y, fontHeight, fontWidth, bitsPerPixel);
                            textDimensionUpdate.call(legacyVGA, x, y, fontHeight, fontWidth, bitsPerPixel);
                        };
                    }(legacyVGA.dimensionUpdate));

                    legacyVGA.graphicsTileUpdate = function (tile, x0, y0) {
                        plugin.graphicsTileUpdate(tile, x0, y0);
                    };
                }
            };
        }
    });

    return CanvasVGARendererPlugin;
});
