/**
 * Jemul8 - x86 emulator
 *
 * Copyright 2017 Dan Phillimore (asmblah).
 *
 * License - MIT
 */

const FULL_VOLUME = 0.05

export default class PCSpeakerOutputPlugin {
  /**
   * @param {AudioContext|null} audioContext
   */
  constructor (audioContext) {
    /**
     * @type {AudioContext|null}
     */
    this.audioContext = audioContext;
    /**
     * @type {GainNode|null}
     */
    this.gainNode = null
    /**
     * @type {OscillatorNode|null}
     */
    this.oscillatorNode = null
  }

  setupIODevices () {
    return {
      'Speaker': (api) => {
        api.onSpeakerOn((frequency) => {
          if (!this.audioContext) {
            // No WebAudio support
            return;
          }

          if (this.oscillatorNode) {
            // Ramp from current frequency to the new one to avoid clicks and pops
            this.oscillatorNode.frequency.exponentialRampToValueAtTime(frequency, this.audioContext.currentTime + 0.03)
          } else {
            this.oscillatorNode = this.audioContext.createOscillator()
            this.gainNode = this.audioContext.createGain()
            this.oscillatorNode.connect(this.gainNode)
            this.gainNode.connect(this.audioContext.destination)

            this.gainNode.gain.value = FULL_VOLUME
            this.oscillatorNode.frequency.value = frequency
            this.oscillatorNode.type = 'square'

            this.oscillatorNode.start()
          }
        })

        api.onSpeakerOff(() => {
          if (!this.audioContext) {
            // No WebAudio support
            return;
          }

          if (this.oscillatorNode) {
            this.gainNode.gain.exponentialRampToValueAtTime(0.0001, this.audioContext.currentTime + 0.03)
            this.oscillatorNode.stop(this.audioContext.currentTime + 0.03) // Make sure we do actually stop too
            this.oscillatorNode = null
            this.gainNode = null
          }
        })
      }
    }
  }
}
