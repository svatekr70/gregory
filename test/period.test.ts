import { afterEach, describe, expect, it, vi } from 'vitest'
import { Gregory } from '../src/gregory.js'
import { formatISODate } from '../src/core/date.js'
import type { GregoryOptions } from '../src/core/types.js'

let input: HTMLInputElement
let picker: Gregory

function mount(options: GregoryOptions = {}): Gregory {
  input = document.createElement('input')
  input.type = 'text'
  document.body.append(input)
  picker = new Gregory(input, { locale: 'cs', ...options })
  picker.openPanel()
  picker.goTo('2026-08-01')
  return picker
}

const periods = (): HTMLButtonElement[] => [
  ...picker.element.querySelectorAll<HTMLButtonElement>('[data-action="period"]'),
]

const labels = (): string[] => periods().map((button) => button.textContent ?? '')

function period(label: string): HTMLButtonElement {
  const button = periods().find((candidate) => candidate.textContent === label)
  if (!button) throw new Error(`period ${label} is not rendered`)
  return button
}

const caption = (): string => picker.element.querySelector('.gr-caption')?.textContent ?? ''

afterEach(() => {
  picker?.destroy()
  input?.remove()
  document.body.replaceChildren()
})

describe('month mode', () => {
  it('shows twelve months of one year', () => {
    mount({ mode: 'month' })

    expect(periods()).toHaveLength(12)
    expect(labels()[0]?.toLowerCase()).toContain('led')
    expect(labels()[11]?.toLowerCase()).toContain('pros')
    expect(caption()).toBe('2026')
  })

  it('has no day grid or preset sidebar', () => {
    mount({ mode: 'month' })

    expect(picker.element.querySelector('.gr-grid')).toBeNull()
    expect(picker.element.querySelector('.gr-presets')).toBeNull()
  })

  it('picks the first day of the month', () => {
    mount({ mode: 'month' })

    period(labels()[7]!).click()

    expect(formatISODate(picker.getValue() as Date)).toBe('2026-08-01')
    expect(input.value.toLowerCase()).toContain('srpen')
  })

  it('commits straight away and closes', () => {
    mount({ mode: 'month' })
    const onApply = vi.fn()
    picker.on('apply', onApply)

    period(labels()[2]!).click()

    expect(onApply).toHaveBeenCalledTimes(1)
    expect(picker.element.hidden).toBe(true)
  })

  it('pages by whole years', () => {
    mount({ mode: 'month' })

    picker.element.querySelector<HTMLButtonElement>('[data-action="next"]')!.click()
    expect(caption()).toBe('2027')

    picker.element.querySelector<HTMLButtonElement>('[data-action="prev"]')!.click()
    picker.element.querySelector<HTMLButtonElement>('[data-action="prev"]')!.click()
    expect(caption()).toBe('2025')
  })

  it('takes the current month from the Today button', () => {
    mount({ mode: 'month' })
    picker.element.querySelector<HTMLButtonElement>('[data-action="today"]')!.click()

    const now = new Date()
    const value = picker.getValue() as Date
    expect(value.getMonth()).toBe(now.getMonth())
    expect(value.getDate()).toBe(1)
  })

  it('marks the month that is picked', () => {
    mount({ mode: 'month', value: '2026-08-01' })

    expect(period(labels()[7]!).classList.contains('is-selected')).toBe(true)
    expect(period(labels()[6]!).classList.contains('is-selected')).toBe(false)
  })

  it('disables months entirely outside min/max', () => {
    mount({ mode: 'month', min: '2026-03-15', max: '2026-09-10' })

    // Únor končí před minimem, březen do něj zasahuje.
    expect(period(labels()[1]!).disabled).toBe(true)
    expect(period(labels()[2]!).disabled).toBe(false)
    expect(period(labels()[8]!).disabled).toBe(false)
    expect(period(labels()[9]!).disabled).toBe(true)
  })
})

describe('year mode', () => {
  it('shows a page of years around the current one', () => {
    mount({ mode: 'year' })

    expect(periods()).toHaveLength(12)
    expect(labels()).toContain('2026')
    expect(caption()).toMatch(/^\d{4} – \d{4}$/)
  })

  it('picks the first day of the year', () => {
    mount({ mode: 'year' })

    period('2026').click()

    expect(formatISODate(picker.getValue() as Date)).toBe('2026-01-01')
    expect(input.value).toBe('2026')
  })

  it('pages by whole blocks', () => {
    mount({ mode: 'year' })
    const first = labels()[0]!

    picker.element.querySelector<HTMLButtonElement>('[data-action="next"]')!.click()

    expect(labels()[0]).toBe(String(Number(first) + 12))
  })

  it('marks the year that is picked', () => {
    mount({ mode: 'year', value: '2026-05-05' })

    expect(period('2026').classList.contains('is-selected')).toBe(true)
  })

  it('disables years outside min/max', () => {
    mount({ mode: 'year', min: '2025-01-01', max: '2027-12-31' })

    expect(period('2024').disabled).toBe(true)
    expect(period('2025').disabled).toBe(false)
    expect(period('2027').disabled).toBe(false)

    // Další stránka je celá za maximem.
    picker.element.querySelector<HTMLButtonElement>('[data-action="next"]')!.click()
    expect(periods().every((button) => button.disabled)).toBe(true)
  })

  it('keeps the pages anchored so paging is reversible', () => {
    mount({ mode: 'year' })
    const first = labels()[0]

    picker.element.querySelector<HTMLButtonElement>('[data-action="next"]')!.click()
    picker.element.querySelector<HTMLButtonElement>('[data-action="prev"]')!.click()

    expect(labels()[0]).toBe(first)
  })
})
