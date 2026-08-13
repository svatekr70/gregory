import { createDate } from './date.js'

const TIME_PATTERN = /^(\d{1,2}):(\d{2})$/

/** Minutes in a day. Times are handled as an offset from local midnight. */
export const DAY_MINUTES = 24 * 60

/** `'08:30'` → 510. Returns null for anything unparsable or out of range. */
export function parseTimeOfDay(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? clampTimeOfDay(Math.round(value), 0, DAY_MINUTES - 1) : null

  const match = TIME_PATTERN.exec(value.trim())
  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

const pad = (value: number): string => String(value).padStart(2, '0')

/** 510 → `'08:30'`. */
export function formatTimeOfDay(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`
}

export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

export function clampTimeOfDay(minutes: number, min: number | null, max: number | null): number {
  if (min !== null && minutes < min) return min
  if (max !== null && minutes > max) return max
  return minutes
}

/** Copies a minutes-of-day value onto the calendar day of `date`. */
export function withTimeOfDay(date: Date, minutes: number): Date {
  return createDate(date.getFullYear(), date.getMonth(), date.getDate(), Math.floor(minutes / 60), minutes % 60)
}

/**
 * Selectable minutes within one hour: multiples of `step` that fall inside the
 * `[min, max]` window. `current` is kept in the list even when it is off-step,
 * so an externally set value never disappears from the select.
 */
export function minuteOptions(
  hour: number,
  step: number,
  min: number | null,
  max: number | null,
  current?: number | null,
): number[] {
  const safeStep = Number.isFinite(step) && step > 0 ? Math.min(Math.floor(step), 60) : 1
  const lower = min ?? 0
  const upper = max ?? DAY_MINUTES - 1
  const options: number[] = []

  for (let minute = 0; minute < 60; minute += safeStep) {
    const absolute = hour * 60 + minute
    if (absolute >= lower && absolute <= upper) options.push(minute)
  }

  if (current !== null && current !== undefined && Math.floor(current / 60) === hour) {
    const minute = current % 60
    if (!options.includes(minute)) options.push(minute)
  }

  return options.sort((a, b) => a - b)
}

/** Hours that still offer at least one selectable minute. */
export function hourOptions(
  step: number,
  min: number | null,
  max: number | null,
  current?: number | null,
): number[] {
  const hours: number[] = []
  for (let hour = 0; hour < 24; hour += 1) {
    if (minuteOptions(hour, step, min, max).length > 0) hours.push(hour)
  }

  if (current !== null && current !== undefined) {
    const hour = Math.floor(current / 60)
    if (!hours.includes(hour)) hours.push(hour)
  }

  return hours.sort((a, b) => a - b)
}

/**
 * Moves a time into the allowed window and onto the step grid. Used when a day
 * is picked and there is no usable time yet.
 */
export function normaliseTimeOfDay(minutes: number, step: number, min: number | null, max: number | null): number {
  const clamped = clampTimeOfDay(minutes, min, max)
  const hour = Math.floor(clamped / 60)
  const candidates = minuteOptions(hour, step, min, max)

  if (candidates.length === 0) {
    // The whole hour is outside the window — take the first legal time of day.
    const hours = hourOptions(step, min, max)
    const firstHour = hours[0]
    if (firstHour === undefined) return clamped
    return firstHour * 60 + (minuteOptions(firstHour, step, min, max)[0] ?? 0)
  }

  const minute = clamped % 60
  const nearest = candidates.reduce((best, candidate) =>
    Math.abs(candidate - minute) < Math.abs(best - minute) ? candidate : best,
  )
  return hour * 60 + nearest
}
