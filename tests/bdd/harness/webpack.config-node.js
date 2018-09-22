/**
 * Jemul8 - x86 emulator
 *
 * Copyright 2018 Dan Phillimore (asmblah).
 *
 * License - MIT
 */

"use strict"

const nodeExternals = require("webpack-node-externals");
const webpackConfig = require("./webpack.config-common");

Object.assign(webpackConfig, {
    externals: [nodeExternals()], // Don"t bundle node_modules modules - Node.js can find them
    target: "node"
});

module.exports = webpackConfig;
