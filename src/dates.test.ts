import { test } from "node:test";
import assert from "node:assert/strict";
import { closingHour, isOpen, parseDay, parisToday } from "./dates.js";
import { validateHourRange } from "./hours.js";

// Vendredi 2 octobre 2026, 7h30 puis 8h00 à Paris (UTC+2).
const fri0730 = new Date("2026-10-02T05:30:00Z");
const fri0800 = new Date("2026-10-02T06:00:00Z");
const today = { year: 2026, month: 10, day: 2 };

test("parisToday suit le fuseau de Paris", () => {
  assert.deepEqual(parisToday(new Date("2026-10-01T22:30:00Z")), today);
});

test("parseDay : demain, jour de semaine, JJ/MM", () => {
  assert.deepEqual(parseDay("demain", today), { year: 2026, month: 10, day: 3 });
  assert.deepEqual(parseDay("Jeudi", today), { year: 2026, month: 10, day: 8 });
  assert.deepEqual(parseDay("vendredi", today), { year: 2026, month: 10, day: 9 });
  assert.deepEqual(parseDay("08/10", today), { year: 2026, month: 10, day: 8 });
  assert.deepEqual(parseDay("01/03", today), { year: 2027, month: 3, day: 1 });
  assert.equal(parseDay("31/02/2026", today), null);
  assert.equal(parseDay("bientôt", today), null);
});

test("ouverture : vendredi 8h00 ouvre le jeudi suivant (J+6)", () => {
  const thursday = { year: 2026, month: 10, day: 8 };
  assert.equal(isOpen(thursday, fri0730, 6), false);
  assert.equal(isOpen(thursday, fri0800, 6), true);
  assert.equal(isOpen({ year: 2026, month: 10, day: 9 }, fri0800, 6), false);
});

test("horaires : dimanche jusqu'à 18h, sinon 22h", () => {
  const sunday = { year: 2026, month: 10, day: 4 };
  assert.equal(closingHour(sunday), 18);
  assert.equal(closingHour(today), 22);
  assert.match(validateHourRange(sunday, 17, 19) ?? "", /18h/);
  assert.equal(validateHourRange(today, 21, 22), null);
  assert.ok(validateHourRange(today, 7, 9));
  assert.ok(validateHourRange(today, 10, 10));
});
