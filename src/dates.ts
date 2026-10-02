// Dates et horaires métier, toujours évalués à l'heure de Paris.
const TZ = "Europe/Paris";

export interface ParisDay {
  year: number;
  month: number; // 1-12
  day: number;
}

export function parisToday(now = new Date()): ParisDay {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(now)
    .split("-")
    .map(Number);
  return { year: p[0], month: p[1], day: p[2] };
}

export function parisHour(now = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" }).format(now));
}

const dayKey = (d: ParisDay) => Date.UTC(d.year, d.month - 1, d.day);
const fromKey = (k: number): ParisDay => {
  const d = new Date(k);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
};

export function addDays(d: ParisDay, n: number): ParisDay {
  return fromKey(dayKey(d) + n * 86_400_000);
}

export function diffDays(a: ParisDay, b: ParisDay): number {
  return Math.round((dayKey(a) - dayKey(b)) / 86_400_000);
}

/** 0 = dimanche … 6 = samedi */
export function weekday(d: ParisDay): number {
  return new Date(dayKey(d)).getUTCDay();
}

const WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export function describeDay(d: ParisDay): string {
  return `${WEEKDAYS[weekday(d)]} ${d.day} ${MONTHS[d.month - 1]}`;
}

export function toDate(d: ParisDay): Date {
  return new Date(Date.UTC(d.year, d.month - 1, d.day, 12));
}

/** JJ/MM/AAAA pour le formulaire Paris Tennis (accepte un Date ou une date du jour). */
export function formatParisDate(date: Date, _locale: "fr"): string {
  const d = parisToday(date);
  return `${String(d.day).padStart(2, "0")}/${String(d.month).padStart(2, "0")}/${d.year}`;
}

const strip = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

/**
 * Accepte : "aujourd'hui", "demain", un jour de semaine ("jeudi" = prochaine occurrence),
 * "JJ/MM" ou "JJ/MM/AAAA". Renvoie null si la saisie n'est pas comprise.
 */
export function parseDay(input: string, today: ParisDay): ParisDay | null {
  const s = strip(input);
  if (s === "aujourd'hui" || s === "aujourdhui") return today;
  if (s === "demain") return addDays(today, 1);
  const wd = WEEKDAYS.map(strip).indexOf(s);
  if (wd >= 0) {
    const delta = (wd - weekday(today) + 7) % 7;
    return addDays(today, delta === 0 ? 7 : delta);
  }
  const m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/.exec(s);
  if (!m) return null;
  let year = m[3] ? Number(m[3]) : today.year;
  const day = Number(m[1]);
  const month = Number(m[2]);
  let result: ParisDay = { year, month, day };
  if (!m[3] && diffDays(result, today) < 0) result = { year: ++year, month, day };
  const check = fromKey(dayKey(result));
  return check.day === day && check.month === month ? result : null;
}

/** Lun–sam 8h–22h, dim. 8h–18h : dernière heure de début incluse = fermeture - 1. */
export function closingHour(d: ParisDay): number {
  return weekday(d) === 0 ? 18 : 22;
}

/** Jours d'avance : un jour est ouvert à la réservation à partir de 8h00, `daysAhead` jours avant. */
export function isOpen(target: ParisDay, now: Date, daysAhead: number): boolean {
  const today = parisToday(now);
  const ahead = diffDays(target, today);
  return ahead < daysAhead || (ahead === daysAhead && parisHour(now) >= 8);
}
