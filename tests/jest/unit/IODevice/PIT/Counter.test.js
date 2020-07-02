/**
 * Jemul8 - x86 emulator
 *
 * Copyright 2017 Dan Phillimore (asmblah).
 *
 * License - MIT
 * http://jemul8.com/MIT-LICENSE.txt
 */

jest.mock('../../../../../js/System')

import Counter from '../../../../../js/IODevice/PIT/Counter'
import StubSystem from '../../../../../js/System'
import Timer from '../../../../../js/Timer'

describe('PIT Counter', () => {
  let counter
  let counterLowers
  let counterRaises
  let system
  let ticksNow
  let timer
  const tickForwardBy = (ticks) => {
    ticksNow += ticks
    timer.tick(ticksNow)
  }

  beforeEach(() => {
    counterLowers = 0
    counterRaises = 0
    ticksNow = 1000000
    system = new StubSystem()
    timer = new Timer(system)

    counter = new Counter(system, timer)

    counter.on('out high', () => {
      counterRaises++
    })
    counter.on('out low', () => {
      counterLowers++
    })
    system.getTicksNow.mockImplementation(() => ticksNow)
  })

  describe('when using mode 0 (Interrupt On Terminal Count)', () => {
    describe('with a count of 15 ticks', () => {
      beforeEach(() => {
        counter.configure(Counter.BINARY_MODE, Counter.INTERRUPT_ON_TERMINAL_COUNT, Counter.READ_LOAD_LSB_THEN_MSB)

        counter.sendHalfCount(15)
        counter.sendHalfCount(0)
      })

      it('should report the correct initial count', () => {
        expect(counter.getInitialCount()).toBe(15)
      })

      describe('after 0 ticks', () => {
        beforeEach(() => {
          tickForwardBy(0)
        })

        it('should not have raised the counter\'s OUT', () => {
          expect(counterRaises).toBe(0)
        })

        it('should have lowered the counter\'s OUT once', () => {
          expect(counterLowers).toBe(1)
        })

        it('should not have changed the count', () => {
          expect(counter.getCount()).toBe(15)
        })
      })

      describe('after 1 tick', () => {
        beforeEach(() => {
          tickForwardBy(1)
        })

        it('should still not have raised the counter\'s OUT', () => {
          expect(counterRaises).toBe(0)
        })

        it('should still have only lowered the counter\'s OUT once', () => {
          expect(counterLowers).toBe(1)
        })

        it('should have reduced the count by one (from 15)', () => {
          expect(counter.getCount()).toBe(14)
        })
      })

      describe('after 4 ticks', () => {
        beforeEach(() => {
          tickForwardBy(4)
        })

        it('should still not have raised the counter\'s OUT', () => {
          expect(counterRaises).toBe(0)
        })

        it('should still have only lowered the counter\'s OUT once', () => {
          expect(counterLowers).toBe(1)
        })

        it('should have reduced the count by 4 (from 15)', () => {
          expect(counter.getCount()).toBe(11)
        })
      })

      describe('after 14 ticks', () => {
        beforeEach(() => {
          tickForwardBy(14)
        })

        it('should still not have raised the counter\'s OUT', () => {
          expect(counterRaises).toBe(0)
        })

        it('should still have only lowered the counter\'s OUT once', () => {
          expect(counterLowers).toBe(1)
        })

        it('should have reduced the count down to 1', () => {
          expect(counter.getCount()).toBe(1)
        })
      })

      describe('after 15 ticks', () => {
        beforeEach(() => {
          tickForwardBy(15)
        })

        it('should have raised the counter\'s OUT once', () => {
          expect(counterRaises).toBe(1)
        })

        it('should still have lowered the counter\'s OUT only once', () => {
          expect(counterLowers).toBe(1)
        })

        it('should have reduced the count down to 0', () => {
          expect(counter.getCount()).toBe(0)
        })
      })

      describe('after 20 ticks', () => {
        beforeEach(() => {
          tickForwardBy(20)
        })

        it('should still have raised the counter\'s OUT only once', () => {
          expect(counterRaises).toBe(1)
        })

        it('should still have lowered the counter\'s OUT only once', () => {
          expect(counterLowers).toBe(1)
        })

        it('should have left the count at 0', () => {
          expect(counter.getCount()).toBe(0)
        })
      })
    })
  })
})
