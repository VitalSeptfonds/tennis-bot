import { parse } from "node-html-parser";
import { ParisSession } from "./session.js";
import { ALL_COATINGS, ALL_IN_OUT } from "./directory.js";
import { formatParisDate } from "../dates.js";

export interface Slot {
  site: string;
  hour: number;
  courtNo: number | null;
  label: string;
  covered: boolean;
  price: string;
  tariff: string;
}

// Sélecteurs centralisés : à ajuster ici si le HTML de Paris Tennis change.
const SEL = {
  hourPanel: ".panel-group > .panel",
  hourTitle: ".panel-title",
  courtRow: ".tennis-court",
  courtLabel: "span.court",
  price: ".price",
  priceDescription: ".price-description",
};

/** Extrait les créneaux libres d'une page de résultats pour un site. */
export function parseAvailability(html: string, site: string): Slot[] {
  const root = parse(html);
  const slots: Slot[] = [];
  for (const panel of root.querySelectorAll(SEL.hourPanel)) {
    const hour = Number.parseInt(panel.querySelector(SEL.hourTitle)?.text.trim() ?? "", 10);
    if (Number.isNaN(hour)) continue;
    for (const row of panel.querySelectorAll(SEL.courtRow)) {
      const label = (row.querySelector(SEL.courtLabel)?.text ?? "").replace(/\s+/g, " ").trim();
      if (!label) continue;
      const desc = (row.querySelector(SEL.priceDescription)?.innerHTML ?? "")
        .split(/<br\s*\/?>/i)
        .map((s) => s.replace(/<[^>]*>/g, "").trim());
      const no = /N°\s*(\d+)/i.exec(label);
      slots.push({
        site,
        hour,
        courtNo: no ? Number(no[1]) : null,
        label,
        covered: /^couvert/i.test(desc[1] ?? ""),
        price: (row.querySelector(SEL.price)?.text ?? "").trim(),
        tariff: desc[0] ?? "",
      });
    }
  }
  return slots;
}

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { at: number; slots: Slot[] }>();

/** Une requête par site couvre toute la plage horaire (cache 30 s). */
export async function searchSite(
  session: ParisSession,
  site: string,
  date: Date,
  fromHour: number,
  toHour: number,
): Promise<Slot[]> {
  const when = formatParisDate(date, "fr");
  const key = `${site}|${when}|${fromHour}|${toHour}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.slots;

  await session.ensureSession();
  const form = new URLSearchParams({
    where: site,
    when,
    hourRange: `${fromHour}-${toHour}`,
  });
  form.append("selWhereTennisName", site);
  for (const c of ALL_COATINGS) form.append("selCoating", c);
  for (const v of ALL_IN_OUT) form.append("selInOut", v);
  const html = await session.postForm("page=recherche&action=rechercher_creneau", form);
  const slots = parseAvailability(html, site).filter((s) => s.hour >= fromHour && s.hour < toHour);
  cache.set(key, { at: Date.now(), slots });
  return slots;
}
