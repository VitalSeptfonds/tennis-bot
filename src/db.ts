import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";

export type Db = DatabaseSync;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS favorite_court (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  scope         TEXT NOT NULL,            -- 'group' ou identifiant Discord de l'utilisateur
  site_name     TEXT NOT NULL,
  court_numbers TEXT NOT NULL DEFAULT '[]', -- JSON : [] = tous les courts du site
  covered       INTEGER,                  -- NULL = indifférent, 1 = couvert, 0 = découvert
  rank          INTEGER NOT NULL,
  UNIQUE (scope, site_name)
);
`;

export function openDb(dataDir: string): Db {
  const db = new DatabaseSync(join(dataDir, "tennisbot.db"));
  db.exec("PRAGMA journal_mode = WAL");
  db.exec(SCHEMA);
  return db;
}

export function openMemoryDb(): Db {
  const db = new DatabaseSync(":memory:");
  db.exec(SCHEMA);
  return db;
}
