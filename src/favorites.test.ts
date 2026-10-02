import { test } from "node:test";
import assert from "node:assert/strict";
import { openMemoryDb } from "./db.js";
import { GROUP_SCOPE, addFavorite, effectiveFavorites, listFavorites, moveFavorite, removeFavorite } from "./favorites.js";
import { parseCourts } from "./commands/terrains.js";

const names = (db: ReturnType<typeof openMemoryDb>, scope = GROUP_SCOPE) => listFavorites(db, scope).map((f) => f.siteName);

test("ajout, rang et réordonnancement", () => {
  const db = openMemoryDb();
  addFavorite(db, GROUP_SCOPE, "Lenglen", { courtNumbers: [7, 5] });
  addFavorite(db, GROUP_SCOPE, "Poliveau");
  addFavorite(db, GROUP_SCOPE, "Elisabeth", { rank: 1 });
  assert.deepEqual(names(db), ["Elisabeth", "Lenglen", "Poliveau"]);
  assert.deepEqual(listFavorites(db, GROUP_SCOPE)[1].courtNumbers, [5, 7]);
  assert.ok(moveFavorite(db, GROUP_SCOPE, "Poliveau", 1));
  assert.deepEqual(names(db), ["Poliveau", "Elisabeth", "Lenglen"]);
  assert.equal(moveFavorite(db, GROUP_SCOPE, "Inconnu", 1), false);
});

test("ajouter deux fois met à jour les filtres sans doublon", () => {
  const db = openMemoryDb();
  addFavorite(db, GROUP_SCOPE, "Lenglen");
  addFavorite(db, GROUP_SCOPE, "Lenglen", { covered: true });
  assert.equal(listFavorites(db, GROUP_SCOPE).length, 1);
  assert.equal(listFavorites(db, GROUP_SCOPE)[0].covered, true);
});

test("retrait renumérote", () => {
  const db = openMemoryDb();
  for (const n of ["A", "B", "C"]) addFavorite(db, GROUP_SCOPE, n);
  assert.ok(removeFavorite(db, GROUP_SCOPE, "B"));
  assert.deepEqual(listFavorites(db, GROUP_SCOPE).map((f) => [f.siteName, f.rank]), [["A", 1], ["C", 2]]);
  assert.equal(removeFavorite(db, GROUP_SCOPE, "B"), false);
});

test("la liste personnelle remplace celle du groupe", () => {
  const db = openMemoryDb();
  addFavorite(db, GROUP_SCOPE, "Groupe");
  assert.deepEqual(effectiveFavorites(db, "u1").map((f) => f.siteName), ["Groupe"]);
  addFavorite(db, "u1", "Perso");
  assert.deepEqual(effectiveFavorites(db, "u1").map((f) => f.siteName), ["Perso"]);
  assert.deepEqual(effectiveFavorites(db, "u2").map((f) => f.siteName), ["Groupe"]);
});

test("parseCourts", () => {
  assert.deepEqual(parseCourts("5, 7"), [5, 7]);
  assert.deepEqual(parseCourts(null), []);
  assert.equal(parseCourts("cinq"), null);
});
