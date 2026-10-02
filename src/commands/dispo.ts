import { MessageFlags, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import type { Ctx } from "./context.js";
import { describeDay, isOpen, parisToday, parseDay, toDate } from "../dates.js";
import { validateHourRange } from "../hours.js";
import { effectiveFavorites } from "../favorites.js";
import { searchSite } from "../paris/availability.js";
import { filterSlots, formatSite, truncateForDiscord } from "./dispo-format.js";

export const dispoCommand = new SlashCommandBuilder()
  .setName("dispo")
  .setDescription("Créneaux libres sur vos terrains préférés (lecture seule)")
  .addStringOption((o) => o.setName("date").setDescription("demain, jeudi, 08/10 ou 08/10/2026").setRequired(true))
  .addIntegerOption((o) => o.setName("heure_debut").setDescription("Première heure (8-21)").setMinValue(8).setMaxValue(21).setRequired(true))
  .addIntegerOption((o) => o.setName("heure_fin").setDescription("Fin de la plage (9-22), exclue").setMinValue(9).setMaxValue(22).setRequired(true))
  .addBooleanOption((o) => o.setName("couvert").setDescription("Seulement couvert (oui) ou découvert (non)"));

export async function runDispo(i: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  const now = new Date();
  const today = parisToday(now);
  const day = parseDay(i.options.getString("date", true), today);
  if (!day) {
    await i.reply({ content: "Date non comprise. Exemples : `demain`, `jeudi`, `08/10`, `08/10/2026`.", flags: MessageFlags.Ephemeral });
    return;
  }
  const from = i.options.getInteger("heure_debut", true);
  const to = i.options.getInteger("heure_fin", true);
  const error = validateHourRange(day, from, to);
  if (error) {
    await i.reply({ content: error, flags: MessageFlags.Ephemeral });
    return;
  }
  const favorites = effectiveFavorites(ctx.db, i.user.id);
  if (favorites.length === 0) {
    await i.reply({ content: "Aucun terrain préféré. Ajoutez-en avec `/terrains ajouter`.", flags: MessageFlags.Ephemeral });
    return;
  }

  await i.deferReply();
  const covered = i.options.getBoolean("couvert");
  const lines: string[] = [];
  for (const fav of favorites) {
    try {
      const slots = await searchSite(ctx.session, fav.siteName, toDate(day), from, to);
      lines.push(formatSite(fav.siteName, filterSlots(slots, fav, covered)));
    } catch (err) {
      console.error(`Recherche échouée pour ${fav.siteName}:`, (err as Error).message);
      lines.push(`**${fav.siteName}** — recherche impossible`);
    }
  }
  const notOpen = isOpen(day, now, ctx.config.opening.days_ahead)
    ? ""
    : "\n⏳ Ce jour n'est pas encore ouvert à la réservation : les créneaux apparaîtront à 8h00.";
  await i.editReply(truncateForDiscord(`📅 **${describeDay(day)}**, ${from}h–${to}h\n\n${lines.join("\n\n")}${notOpen}`));
}
