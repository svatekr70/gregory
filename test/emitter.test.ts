import { describe, expect, it, vi } from 'vitest'
import { Emitter } from '../src/core/emitter.js'

type Events = { ping: number; pong: string }

describe('Emitter', () => {
  it('delivers a payload to every listener', () => {
    const emitter = new Emitter<Events>()
    const first = vi.fn()
    const second = vi.fn()

    emitter.on('ping', first)
    emitter.on('ping', second)
    emitter.emit('ping', 42)

    expect(first).toHaveBeenCalledWith(42)
    expect(second).toHaveBeenCalledWith(42)
  })

  it('keeps event buckets apart', () => {
    const emitter = new Emitter<Events>()
    const listener = vi.fn()

    emitter.on('pong', listener)
    emitter.emit('ping', 1)

    expect(listener).not.toHaveBeenCalled()
  })

  it('unsubscribes through the returned disposer and through off()', () => {
    const emitter = new Emitter<Events>()
    const viaDisposer = vi.fn()
    const viaOff = vi.fn()

    const dispose = emitter.on('ping', viaDisposer)
    emitter.on('ping', viaOff)

    dispose()
    emitter.off('ping', viaOff)
    emitter.emit('ping', 1)

    expect(viaDisposer).not.toHaveBeenCalled()
    expect(viaOff).not.toHaveBeenCalled()
  })

  it('runs a once() listener exactly one time', () => {
    const emitter = new Emitter<Events>()
    const listener = vi.fn()

    emitter.once('ping', listener)
    emitter.emit('ping', 1)
    emitter.emit('ping', 2)

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(1)
  })

  it('lets a listener unsubscribe itself without skipping the next one', () => {
    const emitter = new Emitter<Events>()
    const second = vi.fn()

    const dispose = emitter.on('ping', () => dispose())
    emitter.on('ping', second)
    emitter.emit('ping', 1)

    expect(second).toHaveBeenCalledTimes(1)
  })

  it('drops everything on clear()', () => {
    const emitter = new Emitter<Events>()
    const listener = vi.fn()

    emitter.on('ping', listener)
    emitter.clear()
    emitter.emit('ping', 1)

    expect(listener).not.toHaveBeenCalled()
  })

  it('ignores an emit with no listeners', () => {
    const emitter = new Emitter<Events>()
    expect(() => emitter.emit('ping', 1)).not.toThrow()
  })
})
