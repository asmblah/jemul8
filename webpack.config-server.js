/**
 * Jemul8 - x86 emulator
 *
 * Copyright 2017 Dan Phillimore (asmblah).
 *
 * License - MIT
 */

'use strict'

const nodeExternals = require('webpack-node-externals');
const path = require('path');
const webpack = require('webpack');
const webpackConfig = require('./webpack.config');

module.exports = {
  entry: './server',
  target: 'node',
  externals: [nodeExternals()], // Don't bundle node_modules modules - Node.js can find them
  module: webpackConfig.module,
  plugins: webpackConfig.plugins,
  resolve: webpackConfig.resolve,
  output: {
    libraryTarget: 'commonjs2',
    path: path.join(__dirname, 'dist'),
    filename: 'server.js',

    // Use absolute paths in source maps (important for debugging via IDE)
    devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    devtoolFallbackModuleFilenameTemplate: '[absolute-resource-path]?[hash]'
  },
  devtool: 'inline-cheap-module-source-map'
};
