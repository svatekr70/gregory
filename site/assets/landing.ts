import { Gregory, formatISODate } from '../../src/index.js'
import type { DateRange } from '../../src/index.js'

// Viz demo.ts: styly patří do vstupního souboru, ne jen do index.ts.
import '../../src/styles/gregory.css'

const readout = document.getElementById('hero-readout')

const picker = new Gregory('#hero-picker', {
  mode: 'range',
  locale: 'cs',
  inline: true,
  weekNumbers: true,
  autoApply: true,
  presets: true,
})

function render({ from, to }: DateRange): void {
  if (!readout) return
  if (!from) {
    readout.textContent = 'zatím nic nevybráno'
    return
  }
  const days = to ? Math.round((+to - +from) / 86_400_000) + 1 : null
  readout.textContent = to
    ? `{ from: '${formatISODate(from)}', to: '${formatISODate(to)}' }  →  ${days} dní`
    : `{ from: '${formatISODate(from)}', to: null }  →  vyber druhý konec`
}

picker.on('change', ({ value }) => render(value as DateRange))
