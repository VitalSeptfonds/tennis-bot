import type { Db } from "./db.js";

export interface Favorite {
  scope: string;
  siteName: string;
  courtNumbers: number[];
  covered: boolean | null;
  rank: number;
}

export const GROUP_SCOPE = "group";

interface Row {
  scope: string;
  site_name: string;
  court_numbers: string;
  covered: number | null;
  rank: number;
}

const toFavorite = (r: Row): Favorite => ({
  scope: r.scope,
  siteName: r.site_name,
  courtNumbers: JSON.parse(r.court_numbers) as number[],
  covered: r.covered === null ? null : r.covered === 1,
  rank: r.rank,
});

export function listFavorites(db: Db, scope: string): Favorite[] {
  const rows = db.prepare("SELECT * FROM favorite_court WHERE scope = ? ORDER BY rank").all(scope) as unknown as Row[];
  return rows.map(toFavorite);
}

/** La liste personnelle remplace celle du groupe lorsqu'elle n'est pas vide. */
export function effectiveFavorites(db: Db, userId: string): Favorite[] {
  const personal = listFavorites(db, userId);
  return personal.length ? personal : listFavorites(db, GROUP_SCOPE);
}

function renumber(db: Db, scope: string, names: string[]): void {
  const update = db.prepare("UPDATE favorite_court SET rank = ? WHERE scope = ? AND site_name = ?");
  // Rangs temporairement négatifs : pas de contrainte d'unicité sur rank, mais on reste explicite.
  names.forEach((name, i) => update.run(i + 1, scope, name));
}

/** Ajoute (ou met à jour) un site ; `rank` est la position souhaitée (1 = premier), par défaut en fin de liste. */
export function addFavorite(
  db: Db,
  scope: string,
  siteName: string,
  opts: { courtNumbers?: number[]; covered?: boolean | null; rank?: number } = {},
): Favorite[] {
  const names = listFavorites(db, scope).map((f) => f.siteName).filter((n) => n !== siteName);
  const position = Math.min(Math.max((opts.rank ?? names.length + 1) - 1, 0), names.length);
  db.prepare(
    `INSERT INTO favorite_court (scope, site_name, court_numbers, covered, rank) VALUES (?, ?, ?, ?, 0)
     ON CONFLICT (scope, site_name) DO UPDATE SET court_numbers = excluded.court_numbers, covered = excluded.covered`,
  ).run(
    scope,
    siteName,
    JSON.stringify([...new Set(opts.courtNumbers ?? [])].sort((a, b) => a - b)),
    opts.covered === undefined || opts.covered === null ? null : opts.covered ? 1 : 0,
  );
  names.splice(position, 0, siteName);
  renumber(db, scope, names);
  return listFavorites(db, scope);
}

export function removeFavorite(db: Db, scope: string, siteName: string): boolean {
  const res = db.prepare("DELETE FROM favorite_court WHERE scope = ? AND site_name = ?").run(scope, siteName);
  if (res.changes === 0) return false;
  renumber(db, scope, listFavorites(db, scope).map((f) => f.siteName));
  return true;
}

/** Déplace un site déjà présent à la position `rank`. */
export function moveFavorite(db: Db, scope: string, siteName: string, rank: number): boolean {
  const current = listFavorites(db, scope).map((f) => f.siteName);
  if (!current.includes(siteName)) return false;
  const names = current.filter((n) => n !== siteName);
  names.splice(Math.min(Math.max(rank - 1, 0), names.length), 0, siteName);
  renumber(db, scope, names);
  return true;
}

export function describeFavorite(f: Favorite): string {
  const courts = f.courtNumbers.length ? ` — courts ${f.courtNumbers.join(", ")}` : "";
  const cover = f.covered === null ? "" : f.covered ? " — couvert" : " — découvert";
  return `**${f.siteName}**${courts}${cover}`;
}
