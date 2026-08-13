import type { Locale } from './types.js'

/**
 * Překlady popisků. Názvy měsíců, dnů a formát data řeší `Intl`, ale slova
 * jako „Použít" nebo „Posledních 7 dní" odnikud vzít nejdou — tahle tabulka
 * je jediné místo, kde je knihovna nese.
 */
export interface Translation {
  labels: Locale['labels']
  presets: {
    today: string
    yesterday: string
    last7: string
    last30: string
    thisMonth: string
    lastMonth: string
    thisYear: string
  }
  /** Tvary slova „den" podle `Intl.PluralRules`. */
  days: Partial<Record<Intl.LDMLPluralRule, string>>
}

const en: Translation = {
  labels: {
    previousMonth: 'Previous month',
    nextMonth: 'Next month',
    today: 'Today',
    clear: 'Clear',
    apply: 'Apply',
    cancel: 'Cancel',
    customRange: 'Custom range',
    weekNumber: 'Week',
    from: 'From',
    to: 'To',
    hours: 'Hours',
    minutes: 'Minutes',
    openStart: 'No start',
    openEnd: 'No end',
    since: 'from',
    until: 'until',
    nothingSelected: 'Nothing selected',
  },
  presets: {
    today: 'Today',
    yesterday: 'Yesterday',
    last7: 'Last 7 days',
    last30: 'Last 30 days',
    thisMonth: 'This month',
    lastMonth: 'Last month',
    thisYear: 'This year',
  },
  days: { one: 'day', other: 'days' },
}

const cs: Translation = {
  labels: {
    previousMonth: 'Předchozí měsíc',
    nextMonth: 'Následující měsíc',
    today: 'Dnes',
    clear: 'Vymazat',
    apply: 'Použít',
    cancel: 'Zrušit',
    customRange: 'Vlastní rozsah',
    weekNumber: 'Týden',
    from: 'Od',
    to: 'Do',
    hours: 'Hodiny',
    minutes: 'Minuty',
    openStart: 'Bez začátku',
    openEnd: 'Bez konce',
    since: 'od',
    until: 'do',
    nothingSelected: 'Nic nevybráno',
  },
  presets: {
    today: 'Dnes',
    yesterday: 'Včera',
    last7: 'Posledních 7 dní',
    last30: 'Posledních 30 dní',
    thisMonth: 'Tento měsíc',
    lastMonth: 'Minulý měsíc',
    thisYear: 'Letos',
  },
  days: { one: 'den', few: 'dny', many: 'dne', other: 'dní' },
}

const sk: Translation = {
  labels: {
    previousMonth: 'Predchádzajúci mesiac',
    nextMonth: 'Nasledujúci mesiac',
    today: 'Dnes',
    clear: 'Vymazať',
    apply: 'Použiť',
    cancel: 'Zrušiť',
    customRange: 'Vlastný rozsah',
    weekNumber: 'Týždeň',
    from: 'Od',
    to: 'Do',
    hours: 'Hodiny',
    minutes: 'Minúty',
    openStart: 'Bez začiatku',
    openEnd: 'Bez konca',
    since: 'od',
    until: 'do',
    nothingSelected: 'Nič nevybrané',
  },
  presets: {
    today: 'Dnes',
    yesterday: 'Včera',
    last7: 'Posledných 7 dní',
    last30: 'Posledných 30 dní',
    thisMonth: 'Tento mesiac',
    lastMonth: 'Minulý mesiac',
    thisYear: 'Tento rok',
  },
  days: { one: 'deň', few: 'dni', many: 'dňa', other: 'dní' },
}

const de: Translation = {
  labels: {
    previousMonth: 'Voriger Monat',
    nextMonth: 'Nächster Monat',
    today: 'Heute',
    clear: 'Löschen',
    apply: 'Übernehmen',
    cancel: 'Abbrechen',
    customRange: 'Eigener Zeitraum',
    weekNumber: 'Woche',
    from: 'Von',
    to: 'Bis',
    hours: 'Stunden',
    minutes: 'Minuten',
    openStart: 'Ohne Anfang',
    openEnd: 'Ohne Ende',
    since: 'ab',
    until: 'bis',
    nothingSelected: 'Nichts ausgewählt',
  },
  presets: {
    today: 'Heute',
    yesterday: 'Gestern',
    last7: 'Letzte 7 Tage',
    last30: 'Letzte 30 Tage',
    thisMonth: 'Dieser Monat',
    lastMonth: 'Letzter Monat',
    thisYear: 'Dieses Jahr',
  },
  days: { one: 'Tag', other: 'Tage' },
}

const pl: Translation = {
  labels: {
    previousMonth: 'Poprzedni miesiąc',
    nextMonth: 'Następny miesiąc',
    today: 'Dziś',
    clear: 'Wyczyść',
    apply: 'Zastosuj',
    cancel: 'Anuluj',
    customRange: 'Własny zakres',
    weekNumber: 'Tydzień',
    from: 'Od',
    to: 'Do',
    hours: 'Godziny',
    minutes: 'Minuty',
    openStart: 'Bez początku',
    openEnd: 'Bez końca',
    since: 'od',
    until: 'do',
    nothingSelected: 'Nic nie wybrano',
  },
  presets: {
    today: 'Dziś',
    yesterday: 'Wczoraj',
    last7: 'Ostatnie 7 dni',
    last30: 'Ostatnie 30 dni',
    thisMonth: 'Ten miesiąc',
    lastMonth: 'Poprzedni miesiąc',
    thisYear: 'Ten rok',
  },
  days: { one: 'dzień', few: 'dni', many: 'dni', other: 'dnia' },
}

const es: Translation = {
  labels: {
    previousMonth: 'Mes anterior',
    nextMonth: 'Mes siguiente',
    today: 'Hoy',
    clear: 'Borrar',
    apply: 'Aplicar',
    cancel: 'Cancelar',
    customRange: 'Rango personalizado',
    weekNumber: 'Semana',
    from: 'Desde',
    to: 'Hasta',
    hours: 'Horas',
    minutes: 'Minutos',
    openStart: 'Sin inicio',
    openEnd: 'Sin fin',
    since: 'desde',
    until: 'hasta',
    nothingSelected: 'Nada seleccionado',
  },
  presets: {
    today: 'Hoy',
    yesterday: 'Ayer',
    last7: 'Últimos 7 días',
    last30: 'Últimos 30 días',
    thisMonth: 'Este mes',
    lastMonth: 'Mes anterior',
    thisYear: 'Este año',
  },
  days: { one: 'día', other: 'días' },
}

const fr: Translation = {
  labels: {
    previousMonth: 'Mois précédent',
    nextMonth: 'Mois suivant',
    today: "Aujourd'hui",
    clear: 'Effacer',
    apply: 'Appliquer',
    cancel: 'Annuler',
    customRange: 'Période personnalisée',
    weekNumber: 'Semaine',
    from: 'Du',
    to: 'Au',
    hours: 'Heures',
    minutes: 'Minutes',
    openStart: 'Sans début',
    openEnd: 'Sans fin',
    since: 'à partir du',
    until: "jusqu'au",
    nothingSelected: 'Rien de sélectionné',
  },
  presets: {
    today: "Aujourd'hui",
    yesterday: 'Hier',
    last7: '7 derniers jours',
    last30: '30 derniers jours',
    thisMonth: 'Ce mois-ci',
    lastMonth: 'Mois dernier',
    thisYear: 'Cette année',
  },
  days: { one: 'jour', other: 'jours' },
}

const it: Translation = {
  labels: {
    previousMonth: 'Mese precedente',
    nextMonth: 'Mese successivo',
    today: 'Oggi',
    clear: 'Cancella',
    apply: 'Applica',
    cancel: 'Annulla',
    customRange: 'Intervallo personalizzato',
    weekNumber: 'Settimana',
    from: 'Dal',
    to: 'Al',
    hours: 'Ore',
    minutes: 'Minuti',
    openStart: 'Senza inizio',
    openEnd: 'Senza fine',
    since: 'dal',
    until: 'al',
    nothingSelected: 'Niente selezionato',
  },
  presets: {
    today: 'Oggi',
    yesterday: 'Ieri',
    last7: 'Ultimi 7 giorni',
    last30: 'Ultimi 30 giorni',
    thisMonth: 'Questo mese',
    lastMonth: 'Mese scorso',
    thisYear: "Quest'anno",
  },
  days: { one: 'giorno', other: 'giorni' },
}

const TRANSLATIONS: Record<string, Translation> = { en, cs, sk, de, pl, es, fr, it }

/** Jazyky, pro které knihovna nese popisky. */
export function availableTranslations(): string[] {
  return Object.keys(TRANSLATIONS).sort()
}

/**
 * Doplní jazyk, který knihovna nemá — nebo přepíše ten, který nese.
 * Volat před vytvořením pickeru.
 */
export function registerTranslation(language: string, translation: Translation): void {
  TRANSLATIONS[language.split('-')[0]?.toLowerCase() ?? language] = translation
}

/** Překlad pro BCP 47 tag. Nezná-li jazyk, spadne na angličtinu. */
export function translationFor(code: string): Translation {
  const language = code.split('-')[0]?.toLowerCase() ?? 'en'
  return TRANSLATIONS[language] ?? en
}
