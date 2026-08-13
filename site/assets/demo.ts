import { Gregory, addDays, defineElement, formatISODate, formatISOTime, today } from '../../src/index.js'
import type {
  DateRange,
  GregoryOptions,
  GregoryValue,
  Mode,
  RangePreset,
  WeekSelection,
} from '../../src/index.js'

// Motivy se v balíčku importují jako '@svatekr70/gregory/themes.css',
// vždy až po základních stylech.
import '../../src/styles/themes.css'

defineElement()

/* ------------------------------------------------------------- pomocníci */

const $ = <T extends HTMLElement>(selector: string): T => {
  const element = document.querySelector<T>(selector)
  if (!element) throw new Error(`chybí ${selector}`)
  return element
}

const hasTime = (mode: Mode): boolean => mode === 'datetime' || mode === 'datetime-range'

const isRange = (mode: Mode): boolean => mode === 'range' || mode === 'datetime-range'

function describe(value: GregoryValue, mode: Mode): string {
  if (!value) return 'null'
  const stamp = (date: Date): string =>
    hasTime(mode) ? `${formatISODate(date)} ${formatISOTime(date)}` : formatISODate(date)

  if (value instanceof Date) return `'${stamp(value)}'`
  if (!value.from && !value.to) return '{ from: null, to: null }'
  if (!value.from) return `{ from: null, to: '${stamp(value.to!)}' }  →  otevřený začátek`
  if (!value.to) return `{ from: '${stamp(value.from)}', to: null }  →  otevřený konec`

  const days = Math.round((+new Date(value.to.getFullYear(), value.to.getMonth(), value.to.getDate()) -
    +new Date(value.from.getFullYear(), value.from.getMonth(), value.from.getDate())) / 86_400_000) + 1
  return `{ from: '${stamp(value.from)}', to: '${stamp(value.to)}' }  →  ${days} dní`
}

/** Připojí picker k ukázce a zrcadlí hodnotu do jejího výpisu. */
function example(id: string, options: GregoryOptions): Gregory {
  const picker = new Gregory(`#${id}`, options)
  const output = document.querySelector<HTMLElement>(`[data-for="${id}"]`)
  const show = (value: GregoryValue): void => {
    if (output) output.textContent = describe(value, options.mode ?? 'date')
  }
  picker.on('change', ({ value }) => show(value))
  picker.on('apply', ({ value }) => show(value))
  show(picker.getValue())
  return picker
}

/* ----------------------------------------------------------- konfigurátor */

const controls = {
  mode: $<HTMLSelectElement>('#opt-mode'),
  locale: $<HTMLSelectElement>('#opt-locale'),
  months: $<HTMLInputElement>('#opt-months'),
  maxSpan: $<HTMLInputElement>('#opt-maxspan'),
  timeStep: $<HTMLInputElement>('#opt-timestep'),
  timeUi: $<HTMLSelectElement>('#opt-timeui'),
  minTime: $<HTMLInputElement>('#opt-mintime'),
  maxTime: $<HTMLInputElement>('#opt-maxtime'),
  opens: $<HTMLSelectElement>('#opt-opens'),
  allowOpenRange: $<HTMLInputElement>('#opt-openrange'),
  linkedCalendars: $<HTMLInputElement>('#opt-linked'),
  presets: $<HTMLInputElement>('#opt-presets'),
  weekNumbers: $<HTMLInputElement>('#opt-weeknumbers'),
  showOutsideDays: $<HTMLInputElement>('#opt-outsidedays'),
  summary: $<HTMLInputElement>('#opt-summary'),
  weekSelection: $<HTMLSelectElement>('#opt-weekselection'),
  dropdowns: $<HTMLSelectElement>('#opt-dropdowns'),
  autoApply: $<HTMLInputElement>('#opt-autoapply'),
  inline: $<HTMLInputElement>('#opt-inline'),
  weekends: $<HTMLInputElement>('#opt-weekends'),
}

const stage = $('#stage')
const readout = $('#readout')
const snippet = $('#snippet')
const log = $<HTMLUListElement>('#event-log')

/*
 * Vzhled se nenastavuje volbami pickeru, ale CSS proměnnými na kořeni panelu.
 * Konfigurátor je proto zapisuje přímo do `picker.element` — přesně tak, jak
 * by je hostitelská stránka napsala do stylopisu.
 */
const CSS_VARS = [
  { id: 'css-daysize', name: '--gr-day-size', unit: 'px', fallback: '32' },
  { id: 'css-gap', name: '--gr-gap', unit: 'px', fallback: '1' },
  { id: 'css-pad', name: '--gr-pad', unit: 'px', fallback: '10' },
  { id: 'css-font', name: '--gr-font-size', unit: 'px', fallback: '14' },
  { id: 'css-dayfont', name: '--gr-day-font-size', unit: 'px', fallback: '' },
  { id: 'css-weekdayfont', name: '--gr-weekday-font-size', unit: 'px', fallback: '11.5' },
] as const

const cssInputs = CSS_VARS.map((variable) => ({ ...variable, input: $<HTMLInputElement>(`#${variable.id}`) }))
const cssSnippet = $('#css-snippet')

function applyAppearance(): void {
  const target = current?.element
  const changed: string[] = []

  for (const { name, unit, fallback, input } of cssInputs) {
    const value = input.value.trim()
    if (value === '') target?.style.removeProperty(name)
    else target?.style.setProperty(name, value + unit)
    if (value !== fallback) changed.push(`  ${name}: ${value === '' ? 'dle panelu' : value + unit};`)
  }

  cssSnippet.hidden = changed.length === 0
  if (changed.length) cssSnippet.innerHTML = paint(`.gr {\n${changed.join('\n')}\n}`)
}

for (const { input } of cssInputs) input.addEventListener('input', applyAppearance)

$<HTMLButtonElement>('#css-reset').addEventListener('click', () => {
  for (const { input, fallback } of cssInputs) input.value = fallback
  applyAppearance()
})

let current: Gregory | null = null

function readOptions(): GregoryOptions & { mode: Mode } {
  const maxSpan = Number(controls.maxSpan.value)
  return {
    mode: controls.mode.value as Mode,
    locale: controls.locale.value,
    months: Number(controls.months.value),
    maxSpan: maxSpan > 0 ? maxSpan : null,
    timeStep: Number(controls.timeStep.value),
    timeUi: controls.timeUi.value as 'select' | 'input' | 'slider',
    minTime: controls.minTime.value.trim() || null,
    maxTime: controls.maxTime.value.trim() || null,
    opens: controls.opens.value as 'left' | 'right' | 'center',
    allowOpenRange: controls.allowOpenRange.checked,
    linkedCalendars: controls.linkedCalendars.checked,
    presets: controls.presets.checked,
    weekNumbers: controls.weekNumbers.checked,
    showOutsideDays: controls.showOutsideDays.checked,
    summary: controls.summary.checked,
    weekSelection: controls.weekSelection.value as WeekSelection,
    dropdowns:
      controls.dropdowns.value === 'menu' ? 'menu' : controls.dropdowns.value === 'select' ? true : false,
    autoApply: controls.autoApply.checked,
    inline: controls.inline.checked,
    ...(controls.weekends.checked
      ? { isDisabled: (date: Date) => date.getDay() === 0 || date.getDay() === 6 }
      : {}),
  }
}

/** Vypíše jen ty volby, které se liší od výchozích — kód má být opsatelný. */
function buildSnippet(options: GregoryOptions & { mode: Mode }): string {
  const range = isRange(options.mode)
  const lines: string[] = [`mode: '${options.mode}'`, `locale: '${options.locale}'`]

  if (options.months !== (range ? 2 : 1)) lines.push(`months: ${options.months}`)
  if (options.maxSpan) lines.push(`maxSpan: ${options.maxSpan}`)
  if (hasTime(options.mode)) {
    if (options.timeStep !== 5) lines.push(`timeStep: ${options.timeStep}`)
    if (options.timeUi !== 'select') lines.push(`timeUi: '${options.timeUi}'`)
    if (options.minTime) lines.push(`minTime: '${options.minTime}'`)
    if (options.maxTime) lines.push(`maxTime: '${options.maxTime}'`)
  }
  if (options.opens !== 'right') lines.push(`opens: '${options.opens}'`)
  if (options.allowOpenRange) lines.push('allowOpenRange: true')
  if (options.linkedCalendars) lines.push('linkedCalendars: true')
  if (options.presets !== range) lines.push(`presets: ${options.presets}`)
  if (options.weekNumbers) lines.push('weekNumbers: true')
  if (options.showOutsideDays === false) lines.push('showOutsideDays: false')
  if (options.summary) lines.push('summary: true')
  if (options.weekSelection && options.weekSelection !== 'off') lines.push(`weekSelection: '${options.weekSelection}'`)
  if (options.dropdowns === 'menu') lines.push("dropdowns: 'menu'")
  else if (options.dropdowns) lines.push('dropdowns: true')
  if (options.autoApply !== (options.mode === 'date')) lines.push(`autoApply: ${options.autoApply}`)
  if (options.inline) lines.push('inline: true')
  if (controls.weekends.checked) lines.push('isDisabled: (d) => d.getDay() === 0 || d.getDay() === 6')

  const body = lines.map((line) => `  ${line},`).join('\n')
  const target = options.inline ? "'#kalendar'" : "'#vstup'"
  return `const picker = new Gregory(${target}, {\n${body}\n})`
}

function paint(code: string): string {
  return code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/'[^']*'/g, (match) => `<span class="s">${match}</span>`)
    .replace(/\b(const|new|true|false|null)\b/g, '<span class="k">$1</span>')
    .replace(/\b(Gregory)\b/g, '<span class="t">$1</span>')
    .replace(/\b(\d+)\b/g, '<span class="n">$1</span>')
}

function note(event: string, detail: string): void {
  const item = document.createElement('li')
  item.innerHTML = `<b>${event}</b> ${detail}`
  log.prepend(item)
  while (log.children.length > 40) log.lastElementChild?.remove()
}

function rebuild(): void {
  const options = readOptions()

  current?.destroy()
  stage.replaceChildren()
  log.replaceChildren()

  // V inline režimu se picker vykresluje do divu, jinak visí na inputu.
  let target: HTMLElement
  if (options.inline) {
    target = document.createElement('div')
  } else {
    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'stage-input'
    input.placeholder = 'Klikni sem…'
    target = input
  }
  stage.append(target)

  current = new Gregory(target, options)
  readout.textContent = describe(current.getValue(), options.mode)

  current.on('change', ({ value, complete }) => {
    readout.textContent = describe(value, options.mode)
    note('change', complete ? '(complete)' : '(rozpracováno)')
  })
  current.on('apply', ({ value }) => {
    // Potvrzení může hodnotu ještě doladit (jeden den → jednodenní rozsah).
    readout.textContent = describe(value, options.mode)
    note('apply', describe(value, options.mode))
  })
  current.on('cancel', () => note('cancel', ''))
  current.on('open', () => note('open', ''))
  current.on('close', () => note('close', ''))
  current.on('month-change', ({ year, month }) => note('month-change', `${year}-${String(month + 1).padStart(2, '0')}`))

  snippet.innerHTML = paint(buildSnippet(options))
  // Panel je nový, takže proměnné je potřeba nasadit znovu.
  applyAppearance()

  // Časové volby dávají smysl jen u časových režimů.
  for (const control of [controls.timeStep, controls.timeUi, controls.minTime, controls.maxTime]) {
    control.disabled = !hasTime(options.mode)
  }
  // Tyhle se týkají jen rozsahů.
  for (const control of [controls.maxSpan, controls.allowOpenRange, controls.weekSelection]) {
    control.disabled = !isRange(options.mode)
  }
  controls.linkedCalendars.disabled = Number(controls.months.value) < 2
  controls.opens.disabled = options.inline ?? false
}

/**
 * Volby, jejichž výchozí hodnota se odvozuje od režimu. Po přepnutí režimu se
 * musí přenastavit — jinak by konfigurátor poslal do pickeru hodnoty z toho
 * předchozího a picker by se choval jinak, než jak je popsaný v dokumentaci.
 */
function applyModeDefaults(mode: Mode): void {
  const range = isRange(mode)
  controls.months.value = String(range ? 2 : 1)
  controls.presets.checked = range
  controls.autoApply.checked = mode === 'date'
  if (!range) {
    controls.allowOpenRange.checked = false
    controls.weekSelection.value = 'off'
    controls.maxSpan.value = '0'
  }
}

let currentMode = controls.mode.value as Mode

for (const [name, control] of Object.entries(controls)) {
  control.addEventListener('change', () => {
    if (name === 'mode' && controls.mode.value !== currentMode) {
      currentMode = controls.mode.value as Mode
      applyModeDefaults(currentMode)
    }
    rebuild()
  })
}
rebuild()

/* -------------------------------------------------------------- ukázky */

example('ex-single', { mode: 'date', locale: 'cs', dropdowns: true, weekNumbers: true })

example('ex-range', { mode: 'range', locale: 'cs', weekNumbers: true })

example('ex-datetime', { mode: 'datetime', locale: 'cs', timeStep: 15 })

/* -------------------------------------------------------------- motivy */

interface Theme {
  className: string
  name: string
  note: string
  /** Pozadí vzorku a v něm accent, výplň rozsahu a značka dneška. */
  swatch: [bg: string, accent: string, range: string, today: string]
}

const THEMES: Theme[] = [
  {
    className: '',
    name: 'Výchozí',
    note: 'Neutrální, drží se systémového vzhledu',
    swatch: ['#ffffff', '#2f6fed', '#e7efff', '#e8590c'],
  },
  {
    className: 'gr-theme-blueprint',
    name: 'Blueprint',
    note: 'Technický výkres, monospace, hustá mřížka',
    swatch: ['#0d1b2a', '#4cc2ff', '#12304c', '#ff6b4a'],
  },
  {
    className: 'gr-theme-riso',
    name: 'Riso',
    note: 'Dvoubarevný tisk, posunutý stín místo rozostřeného',
    swatch: ['#fbfaf5', '#ff3e80', '#dfe3ff', '#2b44ff'],
  },
  {
    className: 'gr-theme-clinic',
    name: 'Ordinace',
    note: 'Klidná, vzdušná, vybrané dny jako pilulky',
    swatch: ['#ffffff', '#0e7c86', '#ddf0f1', '#b45309'],
  },
  {
    className: 'gr-theme-nocturne',
    name: 'Nokturno',
    note: 'Skoro černá s teplým jantarem, na noční provoz',
    swatch: ['#08090b', '#ffb020', '#2b2413', '#7dd3fc'],
  },
]

const themeStage = $('#theme-stage')
const themePicks = $('#theme-picks')
const themeCode = $('#theme-code')
const themeDensity = $<HTMLSelectElement>('#theme-density')
let themePicker: Gregory | null = null
let currentTheme: Theme

function showTheme(theme: Theme): void {
  currentTheme = theme
  themePicker?.destroy()
  themeStage.replaceChildren()

  const className = [theme.className, themeDensity.value].filter(Boolean).join(' ')

  themePicker = new Gregory(themeStage, {
    mode: 'range',
    locale: 'cs',
    inline: true,
    months: 2,
    presets: false,
    weekNumbers: true,
    autoApply: true,
    value: ['2026-08-10', '2026-08-16'],
    ...(className ? { className } : {}),
  })

  themeCode.innerHTML = paint(
    className
      ? `import '@svatekr70/gregory/themes.css'\n\nconst picker = new Gregory('#vstup', {\n  mode: 'range',\n  className: '${className}',\n})`
      : `const picker = new Gregory('#vstup', {\n  mode: 'range',\n})`,
  )

  for (const button of themePicks.querySelectorAll('[aria-checked]')) {
    button.setAttribute('aria-checked', String(button.getAttribute('data-theme') === theme.className))
  }
}

THEMES.forEach((theme, index) => {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'theme-pick'
  button.setAttribute('role', 'radio')
  button.setAttribute('aria-checked', String(index === 0))
  button.setAttribute('data-theme', theme.className)

  const [bg, accent, range, today] = theme.swatch
  button.innerHTML =
    `<span class="theme-chip" style="background:${bg}">` +
    `<i style="background:${accent}"></i><i style="background:${range}"></i><i style="background:${today}"></i>` +
    `</span><span><b>${theme.name}</b><small>${theme.note}</small></span>`

  button.addEventListener('click', () => showTheme(theme))
  themePicks.append(button)
})

themeDensity.addEventListener('change', () => showTheme(currentTheme))

showTheme(THEMES[0]!)

/* -------------------------------------------------------------- ukázky */

example('ex-week', {
  mode: 'range',
  locale: 'cs',
  weekNumbers: true,
  weekSelection: 'number',
  presets: false,
  months: 1,
})

example('ex-weekday', {
  mode: 'range',
  locale: 'cs',
  weekSelection: 'day',
  presets: false,
  months: 1,
})

example('ex-open', {
  mode: 'range',
  locale: 'cs',
  allowOpenRange: true,
  presets: false,
  months: 1,
})

example('ex-hours', {
  mode: 'datetime-range',
  locale: 'cs',
  timeStep: 30,
  minTime: '08:00',
  maxTime: '18:00',
  presets: false,
  months: 1,
})

example('ex-limited', {
  mode: 'range',
  locale: 'cs',
  min: today(),
  max: addDays(today(), 90),
  maxSpan: 14,
  presets: false,
})

/** Pohyblivé i pevné české státní svátky pro zobrazený rozsah let. */
const HOLIDAYS = new Set([
  '01-01', '05-01', '05-08', '07-05', '07-06', '09-28', '10-28', '11-17', '12-24', '12-25', '12-26',
])

example('ex-workdays', {
  mode: 'date',
  locale: 'cs',
  isDisabled: (date) => date.getDay() === 0 || date.getDay() === 6,
  dayClass: (date) => (HOLIDAYS.has(formatISODate(date).slice(5)) ? 'is-holiday' : null),
})

const QUARTERS: RangePreset[] = [1, 2, 3, 4].map((quarter) => ({
  label: `Q${quarter}`,
  range: () => {
    const year = today().getFullYear()
    const firstMonth = (quarter - 1) * 3
    return [new Date(year, firstMonth, 1), new Date(year, firstMonth + 3, 0)]
  },
}))

example('ex-custom', {
  mode: 'range',
  locale: 'cs',
  presets: QUARTERS,
  format: (value) => {
    if (!value || value instanceof Date || !value.from || !value.to) return ''
    const quarter = Math.floor(value.from.getMonth() / 3) + 1
    return `Q${quarter} ${value.from.getFullYear()} (${formatISODate(value.from)} – ${formatISODate(value.to)})`
  },
})

new Gregory('#ex-theme', { mode: 'range', locale: 'cs', inline: true, months: 1, presets: false, autoApply: true })

const element = document.getElementById('ex-element')
const elementOut = document.querySelector<HTMLElement>('[data-for="ex-element"]')
element?.addEventListener('gregory:apply', (event) => {
  const { value } = (event as CustomEvent<{ value: DateRange }>).detail
  if (elementOut) elementOut.textContent = `value="${element.getAttribute('value')}"  →  ${describe(value, 'range')}`
})
