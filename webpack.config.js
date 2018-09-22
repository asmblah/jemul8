/**
 * Jemul8 - x86 emulator
 *
 * Copyright 2017 Dan Phillimore (asmblah).
 *
 * License - MIT
 */

'use strict'

const path = require('path');

module.exports = {
  context: __dirname,
  entry: './index',
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /\bnode_modules\b/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['env']
          }
        }
      }
    ]
  },
  output: {
    path: path.join(__dirname, 'dist'),
    filename: 'index.js'
  },
  resolve: {
    alias: {
      'js': path.join(__dirname, 'js'),
      'vendor': path.join(__dirname, 'vendor')
    }
  }
};
