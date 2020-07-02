/**
 * Jemul8 - x86 emulator
 *
 * Copyright 2017 Dan Phillimore (asmblah).
 *
 * License - MIT
 */

import IODevice from '../IODevice'
import Promise from '../Promise'

export default class PCSpeaker extends IODevice {
  constructor (system, io, memory, options) {
    super('Speaker', system, io, memory, options)

    this.speakerOnListeners = [];
    this.speakerOffListeners = [];
  }

  getIOPorts () {
    return {}
  }

  getPluginData () {
    return {
      onSpeakerOn: (callback) => {
        this.speakerOnListeners.push(callback)
      },

      onSpeakerOff: (callback) => {
        this.speakerOffListeners.push(callback)
      }
    }
  }

  init () {
    return new Promise().resolve()
  }

  ioRead () {
  }

  ioWrite () {
  }

  reset () {
  }

  turnOn (frequency) {
    this.speakerOnListeners.forEach((listener) => {
      listener(frequency);
    })
  }

  turnOff () {
    this.speakerOffListeners.forEach((listener) => {
      listener();
    })
  }
}
