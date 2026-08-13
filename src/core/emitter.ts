export type Listener<T> = (payload: T) => void

/** Minimal typed event emitter — no dependency, no DOM, trivially testable. */
export class Emitter<Events extends Record<string, unknown>> {
  private listeners = new Map<keyof Events, Set<Listener<never>>>()

  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): () => void {
    let bucket = this.listeners.get(event)
    if (!bucket) {
      bucket = new Set()
      this.listeners.set(event, bucket)
    }
    bucket.add(listener as Listener<never>)
    return () => this.off(event, listener)
  }

  once<K extends keyof Events>(event: K, listener: Listener<Events[K]>): () => void {
    const off = this.on(event, (payload) => {
      off()
      listener(payload)
    })
    return off
  }

  off<K extends keyof Events>(event: K, listener: Listener<Events[K]>): void {
    this.listeners.get(event)?.delete(listener as Listener<never>)
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    // Copied so a listener may unsubscribe itself without skipping the next one.
    const bucket = this.listeners.get(event)
    if (!bucket) return
    for (const listener of [...bucket]) (listener as Listener<Events[K]>)(payload)
  }

  clear(): void {
    this.listeners.clear()
  }
}
