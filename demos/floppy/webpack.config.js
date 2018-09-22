/**
 * Jemul8 - x86 emulator
 *
 * Copyright 2017 Dan Phillimore (asmblah).
 *
 * License - MIT
 */

'use strict'

const path = require('path')
const webpack = require('webpack')

module.exports = {
  target: 'web',
  context: __dirname,
  entry: './demo',
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
  plugins: [
    new webpack.optimize.LimitChunkCountPlugin({
      maxChunks: 1
    })
  ],
  resolve: {
    alias: {
      'js': path.join(__dirname, '../../js'),
      'vendor': path.join(__dirname, '../../vendor')
    }
  },
  output: {
    path: path.join(__dirname, 'dist'),
    filename: 'demo.js'
  }
}
