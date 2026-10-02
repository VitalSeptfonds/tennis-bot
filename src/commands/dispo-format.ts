import type { Slot } from "../paris/availability.js";
import type { Favorite } from "../favorites.js";

/** Applique les filtres d'une préférence (numéros de courts, couvert/découvert) puis ceux de la commande. */
export function filterSlots(slots: Slot[], fav: Favorite, covered: boolean | null): Slot[] {
  return slots.filter((s) => {
    if (fav.courtNumbers.length && (s.courtNo === null || !fav.courtNumbers.includes(s.courtNo))) return false;
    const wanted = covered ?? fav.covered;
    return wanted === null || s.covered === wanted;
  });
}

const courtText = (s: Slot) => `n°${s.courtNo ?? "?"}${s.covered ? " (couvert)" : ""}`;

/** Une ligne par site : « 19h : n°3, n°5 (couvert) · 20h : … ». */
export function formatSite(site: string, slots: Slot[]): string {
  if (slots.length === 0) return `**${site}** — rien de libre`;
  const byHour = new Map<number, Slot[]>();
  for (const s of slots) byHour.set(s.hour, [...(byHour.get(s.hour) ?? []), s]);
  const parts = [...byHour].sort((a, b) => a[0] - b[0]).map(([h, ss]) => `${h}h : ${ss.map(courtText).join(", ")}`);
  const price = [...new Set(slots.map((s) => `${s.price} ${s.tariff}`.trim()))].join(" / ");
  return `**${site}** (${price})\n${parts.join(" · ")}`;
}

export function truncateForDiscord(text: string, max = 1900): string {
  return text.length <= max ? text : `${text.slice(0, max - 20)}\n… (tronqué)`;
}
