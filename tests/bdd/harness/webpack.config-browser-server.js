/**
 * Jemul8 - x86 emulator
 *
 * Copyright 2018 Dan Phillimore (asmblah).
 *
 * License - MIT
 */

"use strict";

const path = require("path");
const webpackConfig = require("./webpack.config-common");

Object.assign(webpackConfig, {
    entry: path.join(__dirname, "../tools/server"),
    node: {
        __dirname: false
    },
    target: "node"
});
Object.assign(webpackConfig.output, {
    path: path.join(__dirname, "../../../dist"),
    filename: "test-server.js",
    libraryTarget: "umd"
});

module.exports = webpackConfig;
