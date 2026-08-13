# Gregory

Rychlý date / range / datetime picker bez závislostí. Jedno jádro, dvě API:
obyčejná JS třída pro imperativní použití a `<gregory-picker>` pro deklarativní.

- **~16 kB gzip** včetně stylů, žádné runtime závislosti
- **framework-agnostický** — funguje ve staré jQuery aplikaci i v Reactu
- **rozsahy dat** s presety, `minSpan`/`maxSpan`, náhledem při přejíždění myší
- **čas** (`datetime`, `datetime-range`), čísla týdnů, dropdowny měsíc/rok
- **lokalizace přes `Intl`** — měsíce a formáty pro jakýkoli jazyk,
  popisky pro cs, sk, de, pl, en, es, fr, it (další jde doplnit)
- **klávesnice** — šipky, PageUp/PageDown, Enter, Escape
- **témata přes CSS proměnné**, světlé i tmavé

## Instalace

```bash
npm install @svatekr70/gregory
```

```js
import { Gregory } from '@svatekr70/gregory'
import '@svatekr70/gregory/style.css'
```

## Použití

### Imperativně

```js
const picker = new Gregory('#input', {
  mode: 'range',
  locale: 'cs',
  maxSpan: 31,
})

picker.on('apply', ({ value }) => {
  console.log(value.from, value.to)
})
```

### Na jiném prvku než inputu

```html
<span id="termin" data-value="2026-08-13" data-placeholder="Nezadáno">
  📅 <b data-gr-value>13. 8. 2026</b>
</span>
```

```js
new Gregory('#termin', { mode: 'date' })
```

Klik nebo Enter otevře panel, potvrzená hodnota se vypíše do `[data-gr-value]`
(nebo do prvku, když takový potomek není) a strojová podoba do `data-value`.

### Deklarativně

```js
import { defineElement } from '@svatekr70/gregory'
defineElement()
```

```html
<gregory-picker mode="range" locale="cs" months="2" value="2026-08-01/2026-08-13">
</gregory-picker>
```

Element vypisuje `gregory:change`, `gregory:apply`, `gregory:open` a
`gregory:close` jako bublající `CustomEvent`, hodnota je v `event.detail.value`.

## Volby

| volba | výchozí | popis |
| --- | --- | --- |
| `mode` | `'date'` | `date`, `range`, `datetime`, `datetime-range`, `multiple`, `month`, `quarter`, `year` |
| `className` | — | vlastní třídy pro kořen panelu (takhle se aplikují motivy) |
| `value` | `null` | `Date`, ISO string, `{from,to}` nebo `[from, to]` |
| `locale` | jazyk prohlížeče | BCP 47 tag nebo částečný objekt `Locale` |
| `min` / `max` | `null` | hranice výběru |
| `firstDayOfWeek` | podle locale | `0` = neděle … `6` = sobota |
| `months` | `2` v range módu, jinak `1` | počet panelů vedle sebe |
| `linkedCalendars` | `false` | listovat všemi panely najednou místo každým zvlášť |
| `weekNumbers` | `false` | sloupec s ISO čísly týdnů |
| `showOutsideDays` | `true` | zobrazovat dny přesahující ze sousedních měsíců |
| `weekSelection` | `'off'` | výběr celého týdne: `'number'` klikem na číslo týdne, `'day'` klikem na kterýkoli den, `'both'` obojí |
| `dropdowns` | `false` | výběr měsíce a roku: `true` nativní `<select>`, `'menu'` seznam po kliknutí na caption |
| `endInput` | — | druhé pole pro konec rozsahu (`from` do prvního, `to` do druhého) |
| `allowTyping` | `true` | číst datum napsané rukou do pole |
| `submitName` | — | skrytá pole s ISO hodnotou pro odeslání formuláře |
| `disabled` | `false` | zamkne picker; totéž udělá `disabled` i `readonly` na poli |
| `inline` | `false` | vykreslit na místo místo popoveru |
| `autoApply` | `true` jen v módu `date` | potvrdit hned, bez tlačítek Apply/Cancel |
| `presets` | vestavěné v range módu | postranní zkratky, `false` je skryje |
| `maxSpan` | `null` | nejdelší povolený rozsah ve dnech |
| `minSpan` | `null` | nejkratší povolený rozsah ve dnech |
| `stopAtDisabled` | `false` | rozsah nesmí přeskočit den zakázaný přes `isDisabled` |
| `allowOpenRange` | `false` | povolí rozsah otevřený na jednom konci (`{ from, to: null }`) |
| `maxSelected` | `null` | nejvíc dnů v režimu `multiple` |
| `timeStep` | `5` | krok minut v časových režimech |
| `timeUi` | `'select'` | ovládání času: `'select'` selecty, `'slider'` posuvníky, `'input'` nativní pole |
| `minTime` / `maxTime` | `null` | okno dne, `'HH:MM'`, včetně obou hranic |
| `timeWindow` | — | `(date) => { min, max }` — okno dne pro konkrétní den |
| `fullscreenBelow` | `480` | pod touto šířkou okna se panel otevře přes celou obrazovku |
| `opens` / `drops` | `'right'` / `'auto'` | umístění popoveru |
| `isDisabled` | — | `(date) => boolean` |
| `dayClass` | — | `(date) => string \| null`, např. svátky |
| `dayBadge` | — | `(date) => string \| null` — značka pod číslem dne |
| `format` | — | `(value, locale) => string` pro text v inputu |
| `summary` | `false` | řádek v panelu s právě vybranými daty (`true` nebo vlastní funkce) |

## API

```ts
picker.getValue()      // Date | DateRange | Date[] | null — potvrzená hodnota
picker.getSelection()  // rozpracovaný výběr (v range módu i poloviční)
picker.setValue(value, { silent })
picker.clear()
picker.setOptions(patch)
picker.goTo('2026-12-01')
picker.openPanel() / picker.close() / picker.toggle()
picker.apply() / picker.cancel()
picker.on(event, listener)   // vrací odhlašovací funkci
picker.destroy()
```

Události: `change` (s příznakem `complete`), `apply`, `cancel`, `open`,
`close`, `invalid` (hodnota neprošla omezeními), `month-change`.

## Lokalizace

Názvy měsíců, zkratky dnů, první den v týdnu i formát data řeší `Intl`,
takže fungují pro jakýkoli jazyk. Popisky tlačítek a presetů knihovna nese
sama — pro `cs`, `sk`, `de`, `pl`, `en`, `es`, `fr`, `it`. Rozhoduje jazyk,
ne region, takže `de-AT` dostane němčinu. Ostatní jazyky mají popisky
anglicky.

Chybějící jazyk se dodá zvenčí:

```js
import { registerTranslation } from '@svatekr70/gregory'

registerTranslation('ja', {
  labels: { apply: '適用', cancel: 'キャンセル', today: '今日', /* … */ },
  presets: { today: '今日', yesterday: '昨日', /* … */ },
  days: { other: '日' },
})
```

## Vzhled

Všechno jsou CSS proměnné na `.gr`, není potřeba přebíjet selektory:

```css
.gr {
  --gr-accent: #0f766e;
  --gr-range-bg: #ccfbf1;
  --gr-radius: 14px;
}
```

Hustotu drží čtyři proměnné — velikost dne, mezera, odsazení a písmo.
Ostatní odsazení se z `--gr-pad` dopočítává:

```css
.gr {
  --gr-day-size: 21px;
  --gr-gap: 0;
  --gr-pad: 7px;
  --gr-font-size: 13px;
  /* Čísla dnů se odvozují z velikosti políčka (výchozí 50 %), ne ze základního
     písma — prázdno okolo číslice je poměr, ne odsazení. */
  --gr-day-font-size: calc(var(--gr-day-size) * 0.6);
}
```

Hotové stupně jsou v `themes.css` jako `gr-density-compact`
a `gr-density-comfortable`; barvy neřeší, takže se s motivy kombinují.

Tmavý režim se aktivuje sám podle `prefers-color-scheme`, nebo natvrdo přes
`data-theme="dark"` / `data-theme="light"` na kořenovém prvku pickeru.

### Hotové motivy

```js
import '@svatekr70/gregory/style.css'
import '@svatekr70/gregory/themes.css'   // vždy až po style.css

new Gregory('#vstup', { className: 'gr-theme-riso' })
```

| Třída | Charakter |
| --- | --- |
| `gr-theme-blueprint` | technický výkres — tmavě modrá, monospace, hustá mřížka |
| `gr-theme-riso` | dvoubarevný tisk — papír, fluorescentní růžová, posunutý stín |
| `gr-theme-clinic` | objednávkový systém — vzdušná bílá, modrozelená, dny jako pilulky |
| `gr-theme-nocturne` | noční provoz — skoro černá s teplým jantarem |

Žádný z nich nepřepisuje selektor komponenty, mění jen proměnné `--gr-*`.

## Vývoj

```bash
npm run dev            # vývojový playground
npm test               # vitest
npm run test:coverage
npm run build          # typecheck + ESM/UMD/d.ts do dist/

npm run site:dev       # projektový web (úvod, demo, API dokumentace)
npm run site:build     # statický web do dist-site/
```

Web v `site/` importuje knihovnu přímo ze `src/`, takže demo vždy ukazuje
aktuální kód. `dist-site/` je čistě statický — nahraje se kamkoli.

## Licence

MIT
