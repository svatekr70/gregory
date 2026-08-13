import { Gregory, defineElement, formatISODate, today, addDays } from '../src/index.js'
import type { GregoryValue } from '../src/index.js'

defineElement()

const show = (id: string, value: GregoryValue): void => {
  const target = document.getElementById(id)
  if (!target) return
  if (!value) {
    target.textContent = '—'
    return
  }
  target.textContent =
    value instanceof Date
      ? formatISODate(value)
      : `${value.from ? formatISODate(value.from) : '?'} → ${value.to ? formatISODate(value.to) : '?'}`
}

const range = new Gregory('#range', {
  mode: 'range',
  locale: 'cs',
  weekNumbers: true,
  value: [addDays(today(), -6), today()],
})
range.on('apply', ({ value }) => show('range-out', value))
show('range-out', range.getValue())

const single = new Gregory('#single', {
  mode: 'date',
  locale: 'cs',
  weekNumbers: true,
  dropdowns: true,
  min: addDays(today(), -400),
  max: addDays(today(), 400),
})
single.on('change', ({ value }) => show('single-out', value))

const datetime = new Gregory('#datetime', {
  mode: 'datetime-range',
  locale: 'cs',
  maxSpan: 14,
  timeStep: 15,
})
datetime.on('apply', ({ value }) => show('datetime-out', value))

const inline = new Gregory('#inline', { mode: 'range', locale: 'cs', inline: true, months: 2 })
inline.on('change', ({ value, complete }) => {
  if (complete) show('range-out', value)
})

document.querySelector('gregory-picker')?.addEventListener('gregory:apply', (event) => {
  show('element-out', (event as CustomEvent<{ value: GregoryValue }>).detail.value)
})
