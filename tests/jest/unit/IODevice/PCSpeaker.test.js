/**
 * Jemul8 - x86 emulator
 *
 * Copyright 2017 Dan Phillimore (asmblah).
 *
 * License - MIT
 * http://jemul8.com/MIT-LICENSE.txt
 */

jest.mock('../../../../js/IO')
jest.mock('../../../../js/Memory')
jest.mock('../../../../js/System')

import PCSpeaker from '../../../../js/IODevice/PCSpeaker'
import StubIO from '../../../../js/IO'
import StubMemory from '../../../../js/Memory'
import StubSystem from '../../../../js/System'

describe('PCSpeaker I/O device', () => {
  let io
  let memory
  let speaker
  let system

  beforeEach(() => {
    io = new StubIO()
    memory = new StubMemory()
    system = new StubSystem()

    speaker = new PCSpeaker(system, io, memory, {})
  })

  describe('getIOPorts()', () => {
    it('returns an empty plain object', () => {
      const ports = speaker.getIOPorts()

      expect(typeof ports).toBe('object')
      expect(Object.getPrototypeOf(ports)).toBe(Object.prototype)
      expect(Object.getOwnPropertyNames(ports)).toHaveLength(0)
    })
  })

  describe('getPluginData()', () => {
    it('should return an object with an onSpeakerOn() method', () => {
      expect(typeof speaker.getPluginData().onSpeakerOn).toBe('function')
    })

    it('should return an object with an onSpeakerOff() method', () => {
      expect(typeof speaker.getPluginData().onSpeakerOff).toBe('function')
    })
  })

  describe('init()', () => {
    it('should resolve', (done) => {
      speaker.init().done(done).fail(fail)
    })
  })

  describe('turnOn()', () => {
    it('should call all registered speaker-on listeners', () => {
      const listener1 = jest.fn()
      const listener2 = jest.fn()
      speaker.getPluginData().onSpeakerOn(listener1)
      speaker.getPluginData().onSpeakerOn(listener2)

      speaker.turnOn(1234)

      expect(listener1).toHaveBeenCalledTimes(1)
      expect(listener1).toHaveBeenCalledWith(1234)
      expect(listener2).toHaveBeenCalledTimes(1)
      expect(listener2).toHaveBeenCalledWith(1234)
    })
  })

  describe('turnOff()', () => {
    it('should call all registered speaker-off listeners', () => {
      const listener1 = jest.fn()
      const listener2 = jest.fn()
      speaker.getPluginData().onSpeakerOff(listener1)
      speaker.getPluginData().onSpeakerOff(listener2)

      speaker.turnOff()

      expect(listener1).toHaveBeenCalledTimes(1)
      expect(listener2).toHaveBeenCalledTimes(1)
    })
  })
})
