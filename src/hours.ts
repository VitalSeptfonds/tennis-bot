import { closingHour, type ParisDay } from "./dates.js";

/** Vérifie une plage [debut, fin[ pour un jour donné ; renvoie un message d'erreur ou null. */
export function validateHourRange(day: ParisDay, from: number, to: number): string | null {
  const close = closingHour(day);
  if (from < 8 || to > close) return `Les courts sont ouverts de 8h à ${close}h ce jour-là.`;
  if (to <= from) return "L'heure de fin doit être après l'heure de début.";
  return null;
}
