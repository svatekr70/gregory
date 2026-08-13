# Gregory — poznámky pro Claude Code

Knihovna pro výběr data / rozsahu / času. Publikuje se jako
`@svatekr70/gregory`, repo `svatekr70/gregory`.

## Architektura

- `src/core/` je **bez DOM** a plně testovatelné čistými funkcemi:
  - `date.ts` — datová aritmetika, vše v lokálním čase
  - `calendar.ts` — sestavení mřížky měsíce a pravidla pro zakázané dny
  - `locale.ts` — vše přes `Intl`, žádné jazykové balíčky
  - `presets.ts` — zkratky typu „Posledních 7 dní", vyhodnocované líně
  - `emitter.ts` — typovaný emitter událostí
- `src/gregory.ts` — třída `Gregory`: stav, vykreslování, události
- `src/element.ts` — `<gregory-picker>`, tenká obálka nad třídou
- `src/styles/gregory.css` — light DOM, téma jen přes CSS proměnné

Nové chování patří do `core/` jako čistá funkce, pokud to jde. Třída má držet
jen stav a DOM.

## Pravidla, na kterých záleží

- **Nikdy neparsovat datum přes `new Date('2026-08-13')`** — je to UTC půlnoc a
  v našem pásmu to spadne o den zpátky. Používej `parseDate()` z `core/date.ts`.
- Data se porovnávají na úrovni dne (`compareDay`, `isSameDay`), ne přes
  `getTime()` — jinak čas rozbije výběr rozsahu.
- Oba konce rozsahu jsou **inkluzivní**. `maxSpan: 7` znamená 7 dní včetně obou
  krajů.
- Panel se vykresluje vždy na 6 řádků, aby popover neposkakoval.
- Vykreslování je celé znovu (`replaceChildren`), žádný diffing. Je to
  dost rychlé a drží to stav na jednom místě.

## Testy

Vitest + happy-dom, `npm test`. Prahy pokrytí jsou ve `vite.config.ts` a build
je nemá snižovat. Ke každé opravené chybě patří test, který ji reprodukuje —
dvě už takhle vznikly (neplatný `locale` tag, znovuotevření panelu po Escape).

## Playground

`npm run dev` a `index.html` v kořeni — jsou tam všechny módy vedle sebe.
Změny v chování ověřuj i tam, nejen v testech.
