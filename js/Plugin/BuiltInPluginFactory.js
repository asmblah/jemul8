/**
 * Jemul8 - x86 emulator
 *
 * Copyright 2017 Dan Phillimore (asmblah).
 *
 * License - MIT
 */

import CanvasVGARendererPlugin from './CanvasVGARenderer'
import KeyboardInputPlugin from './KeyboardInput'
import LoopbackNetworkPlugin from './Network/Loopback'
import PCSpeakerOutputPlugin from './PCSpeakerOutput'

export default class BuiltInPluginFactory {
  /**
   * @param {object} global
   */
  constructor (global) {
    /**
     * @type {object}
     */
    this.global = global
  }

  /**
   * Creates a builtin plugin from its standard identifier string
   *
   * @param {string} identifier
   * @returns {CanvasVGARendererPlugin|KeyboardInputPlugin|LoopbackNetworkPlugin|PCSpeakerOutputPlugin}
   */
  createFromIdentifier (identifier) {
    switch (identifier) {
      case 'canvas.vga.renderer':
        return new CanvasVGARendererPlugin()
      case 'keyboard.input':
        return new KeyboardInputPlugin()
      case 'network.loopback':
        return new LoopbackNetworkPlugin()
      case 'pcspeaker.output':
        const AudioContext = this.global.AudioContext || this.global.webkitAudioContext
        const audioContext = AudioContext ? new AudioContext() : null

        return new PCSpeakerOutputPlugin(audioContext);
      default:
        throw new Error('Unknown plugin identifier "' + identifier + '"')
    }
  }
}
