/**
 * Jemul8 - x86 emulator
 *
 * Copyright 2018 Dan Phillimore (asmblah).
 *
 * License - MIT
 */

"use strict";

const path = require("path");
const webpack = require("webpack");
const webpackConfig = require("../../../webpack.config");

module.exports = {
    module: webpackConfig.module,
    plugins: [
        new webpack.optimize.LimitChunkCountPlugin({
            maxChunks: 1
        })
    ],
    resolve: {
        alias: {
            "js": path.join(__dirname, "../../../js"),
            "tools": path.join(__dirname, "../tools"),
            "vendor": path.join(__dirname, "../../../vendor")
        }
    },
    output: {
        // Use absolute paths in source maps (important for debugging via IDE)
        devtoolModuleFilenameTemplate: "[absolute-resource-path]",
        devtoolFallbackModuleFilenameTemplate: "[absolute-resource-path]?[hash]"
    },
    devtool: "inline-cheap-module-source-map"
};
