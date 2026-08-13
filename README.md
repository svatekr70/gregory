# Gregory

Picker data, rozsahu dat, času a období pro obyčejné weby. Vznikl z otravné
situace, kterou zná asi každý, kdo spravuje víc než jeden projekt: tady jQuery
daterangepicker, tam nativní `<input type="date">`, jinde něco třetího. Každý
vypadá jinak, jinak se ovládá a jinak vrací hodnotu. Gregory je jedna
komponenta, která to všechno zvládne — bez jediné runtime závislosti a bez
toho, aby si diktovala, jakým frameworkem je stránka postavená.

```js
const picker = new Gregory('#termin', { mode: 'range', locale: 'cs' })
picker.on('apply', ({ value }) => console.log(value.from, value.to))
```

Do pole se napíše `10.–16. 8. 2026`, ven vypadnou dva obyčejné `Date`. Žádné
momenty, žádné řetězce, které se pak musí luštit.

## Proč zrovna tenhle

- **Osm režimů, jedno API.** Jedno datum, rozsah, datum s časem, rozsah
  s časem, seznam samostatných dnů, měsíc, čtvrtletí, rok. Přepíná se jedinou
  volbou `mode`, zbytek zůstává stejný.
- **~17 kB gzip** JavaScriptu a 2,6 kB stylů. Žádné závislosti — ani jQuery,
  ani knihovna na práci s daty.
- **Funguje všude.** Ve staré jQuery aplikaci stejně jako v Reactu; vedle třídy
  je i custom element `<gregory-picker>` pro deklarativní použití.
- **Omezení, která dávají smysl v praxi.** `min`/`max`, zakázané dny,
  nejkratší i nejdelší rozsah, zákaz přeskočit obsazený termín, časové okno
  zvlášť pro každý den. Co picker nepustí do výběru, to nepustí ani do hodnoty.
- **Lokalizace přes `Intl`.** Názvy měsíců, formáty a skloňování počtu dnů
  fungují pro jakýkoli jazyk; popisky tlačítek jsou hotové pro osm z nich.
- **Vzhled přes CSS proměnné.** Motivy i hustota jsou jen sady `--gr-*`, takže
  se nikdy nemusíš prát o specificitu. Tmavý režim automaticky.
- **Ovládání klávesnicí.** Šipky, PageUp/PageDown, Enter, Escape — a datum jde
  do pole i prostě napsat rukou.
- **Místní čas, žádná magie.** Datum, na které uživatel klikne, je to datum,
  které dostaneš. Časové zóny knihovna vědomě neřeší.
- **300+ testů** ve Vitestu nad jádrem i nad DOM, pokrytí přes 90 % příkazů.

Dokumentace se staví ze složky `site/` (`npm run site:dev`): úvod, demo
s konfigurátorem, [uživatelská příručka](site/guide/index.html) na nasazení
krok za krokem a [API reference](site/api/index.html) s úplným výčtem voleb.

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

npm run site:dev       # projektový web (úvod, demo, příručka, API dokumentace)
npm run site:build     # statický web do dist-site/
```

Web v `site/` importuje knihovnu přímo ze `src/`, takže demo vždy ukazuje
aktuální kód. `dist-site/` je čistě statický — nahraje se kamkoli.

## Podpora prohlížečů

Moderní evergreen prohlížeče — Chrome a Edge 90+, Firefox 88+, Safari 15+.
Knihovna se sestavuje na ES2022 a nepoužívá polyfilly. `Intl.Locale#getWeekInfo()`
(první den v týdnu) zatím neumí každý prohlížeč, takže na něj existuje záložní
tabulka.

## Licence

MIT © Rudolf Svátek
