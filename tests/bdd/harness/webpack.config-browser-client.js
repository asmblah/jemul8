/**
 * Jemul8 - x86 emulator
 *
 * Copyright 2018 Dan Phillimore (asmblah).
 *
 * License - MIT
 */

"use strict";

const glob = require("glob");
const path = require("path");
const webpackConfig = require("./webpack.config-common");

Object.assign(webpackConfig, {
    entry: [
        path.join(__dirname, 'browser')
    ].concat(
        glob.sync(path.join(__dirname, "../**/*Test.js"))
    ),
    node: {
        "child_process": "empty",
        "fs": "empty",
        "tmp": "empty"
    },
    target: "web"
});
Object.assign(webpackConfig.output, {
    path: path.join(__dirname, "../../../dist"),
    filename: "test.js",
});

module.exports = webpackConfig;
