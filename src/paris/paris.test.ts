import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseAvailability } from "./availability.js";
import { matchSite, parseDirectory, suggestSites } from "./directory.js";
import { filterSlots, formatSite } from "../commands/dispo-format.js";

// Les fixtures sont du HTML/JSON réel de Paris Tennis, conservé dans src/test-fixtures.
const fixture = (name: string) => readFileSync(fileURLToPath(new URL(`../../src/test-fixtures/${name}`, import.meta.url)), "utf8");

test("parseAvailability lit heures, courts, couvert et prix", () => {
  const slots = parseAvailability(fixture("alain-mimoun.html"), "Alain Mimoun");
  assert.equal(slots.length, 31);
  assert.deepEqual([...new Set(slots.map((s) => s.hour))], [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
  assert.deepEqual([...new Set(slots.map((s) => s.courtNo))].sort(), [2, 3, 4, 5, 6]);
  const s = slots[0];
  assert.equal(s.site, "Alain Mimoun");
  assert.match(s.label, /^Court N°\d+ - Béton poreux - Eclairé$/);
  assert.match(s.price, /^\d+ €$/);
  assert.ok(slots.some((x) => x.covered) && slots.some((x) => !x.covered));
});

test("parseAvailability : page sans créneau = liste vide", () => {
  assert.deepEqual(parseAvailability("<div class='search-result-block'></div>", "X"), []);
});

test("filterSlots : courts préférés et couvert", () => {
  const slots = parseAvailability(fixture("alain-mimoun.html"), "Alain Mimoun");
  const fav = { scope: "group", siteName: "Alain Mimoun", courtNumbers: [3], covered: null, rank: 1 };
  assert.ok(filterSlots(slots, fav, null).every((s) => s.courtNo === 3));
  const covered = filterSlots(slots, { ...fav, courtNumbers: [] }, true);
  assert.ok(covered.length > 0 && covered.every((s) => s.covered));
  assert.equal(filterSlots(slots, fav, null).length > 0, true);
});

test("formatSite", () => {
  assert.match(formatSite("Alain Mimoun", []), /rien de libre/);
  const slots = parseAvailability(fixture("alain-mimoun.html"), "Alain Mimoun").slice(0, 3);
  assert.match(formatSite("Alain Mimoun", slots), /\*\*Alain Mimoun\*\*[\s\S]*\d+h : n°/);
});

test("annuaire : dédoublonné, padel exclu, recherche sans accents", () => {
  const sites = parseDirectory(fixture("map.json"));
  assert.equal(new Set(sites.map((s) => s.name)).size, sites.length);
  assert.ok(!sites.some((s) => /padel/i.test(s.name)));
  assert.equal(matchSite(sites, "alain mimoun")?.name, "Alain Mimoun");
  assert.equal(matchSite(sites, "zzz"), null);
  assert.ok(suggestSites(sites, "AMAND").some((s) => s.name === "Amandiers"));
});
