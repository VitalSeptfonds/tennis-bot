import { ParisSession } from "./session.js";
import { formatParisDate } from "../dates.js";

export interface Site {
  id: number;
  name: string;
  arrondissement: number;
}

// Tous les revêtements et les deux types de courts : on filtre ensuite côté bot.
export const ALL_COATINGS = ["96", "2095", "94", "1324", "2016", "92"];
export const ALL_IN_OUT = ["V", "F"];

const TTL_MS = 24 * 3600_000;
let cache: { at: number; sites: Site[] } | null = null;

interface GeoFeature {
  properties: { general: { _id: number; _nomSrtm: string; _arrondissement: number } };
}

/** Annuaire des sites, tiré de l'endpoint carte (dédoublonné par nom, padel exclu). */
export function parseDirectory(json: string): Site[] {
  const data = JSON.parse(json) as { features: GeoFeature[] };
  const byName = new Map<string, Site>();
  for (const f of data.features) {
    const g = f.properties.general;
    if (/^padel\b/i.test(g._nomSrtm) || byName.has(g._nomSrtm)) continue;
    byName.set(g._nomSrtm, { id: g._id, name: g._nomSrtm, arrondissement: g._arrondissement });
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

export async function getSites(session: ParisSession, now = new Date()): Promise<Site[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.sites;
  await session.ensureSession();
  const form = new URLSearchParams({ hourRange: "8-22", when: formatParisDate(now, "fr") });
  for (const c of ALL_COATINGS) form.append("selCoating[]", c);
  for (const v of ALL_IN_OUT) form.append("selInOut[]", v);
  const sites = parseDirectory(await session.postForm("page=recherche&action=ajax_disponibilite_map", form, true));
  if (sites.length === 0) throw new Error("Annuaire des tennis vide");
  cache = { at: Date.now(), sites };
  return sites;
}

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Retrouve un site à partir d'une saisie libre (nom exact, sinon unique correspondance partielle). */
export function matchSite(sites: Site[], input: string): Site | null {
  const q = norm(input.trim());
  const exact = sites.find((s) => norm(s.name) === q);
  if (exact) return exact;
  const partial = sites.filter((s) => norm(s.name).includes(q));
  return partial.length === 1 ? partial[0] : null;
}

export function suggestSites(sites: Site[], input: string, limit = 25): Site[] {
  const q = norm(input.trim());
  return sites.filter((s) => norm(s.name).includes(q)).slice(0, limit);
}
