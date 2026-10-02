import { MessageFlags, SlashCommandBuilder, type AutocompleteInteraction, type ChatInputCommandInteraction } from "discord.js";
import type { Ctx } from "./context.js";
import {
  GROUP_SCOPE,
  addFavorite,
  describeFavorite,
  listFavorites,
  moveFavorite,
  removeFavorite,
} from "../favorites.js";
import { getSites, matchSite, suggestSites } from "../paris/directory.js";

const siteOption = (o: import("discord.js").SlashCommandStringOption) =>
  o.setName("site").setDescription("Nom du tennis").setAutocomplete(true).setRequired(true);
const persoOption = (o: import("discord.js").SlashCommandBooleanOption) =>
  o.setName("perso").setDescription("Gérer votre liste personnelle au lieu de celle du groupe");

export const terrainsCommand = new SlashCommandBuilder()
  .setName("terrains")
  .setDescription("Gérer les terrains préférés")
  .addSubcommand((s) =>
    s
      .setName("ajouter")
      .setDescription("Ajouter un tennis (ou modifier ses filtres)")
      .addStringOption(siteOption)
      .addStringOption((o) => o.setName("courts").setDescription("Numéros de courts, ex. 5,7 (vide = tous)"))
      .addIntegerOption((o) => o.setName("rang").setDescription("Position dans la liste (1 = premier essayé)").setMinValue(1))
      .addBooleanOption((o) => o.setName("couvert").setDescription("Seulement couvert (oui) ou découvert (non)"))
      .addBooleanOption(persoOption),
  )
  .addSubcommand((s) =>
    s.setName("retirer").setDescription("Retirer un tennis").addStringOption(siteOption).addBooleanOption(persoOption),
  )
  .addSubcommand((s) =>
    s
      .setName("ordonner")
      .setDescription("Changer la position d'un tennis")
      .addStringOption(siteOption)
      .addIntegerOption((o) => o.setName("rang").setDescription("Nouvelle position").setMinValue(1).setRequired(true))
      .addBooleanOption(persoOption),
  )
  .addSubcommand((s) => s.setName("liste").setDescription("Afficher les terrains préférés").addBooleanOption(persoOption));

export function parseCourts(input: string | null): number[] | null {
  if (!input?.trim()) return [];
  const parts = input.split(/[,\s;]+/).filter(Boolean);
  const nums = parts.map(Number);
  return nums.every((n) => Number.isInteger(n) && n > 0 && n < 100) ? nums : null;
}

export async function autocompleteSite(i: AutocompleteInteraction, ctx: Ctx): Promise<void> {
  try {
    const sites = await getSites(ctx.session);
    const found = suggestSites(sites, i.options.getFocused());
    await i.respond(found.map((s) => ({ name: `${s.name} (${s.arrondissement}e)`, value: s.name })));
  } catch {
    await i.respond([]);
  }
}

export async function runTerrains(i: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  const sub = i.options.getSubcommand();
  const perso = i.options.getBoolean("perso") ?? false;
  const scope = perso ? i.user.id : GROUP_SCOPE;
  const where = perso ? "votre liste personnelle" : "la liste du groupe";
  const show = (favs: ReturnType<typeof listFavorites>) =>
    favs.length ? favs.map((f) => `${f.rank}. ${describeFavorite(f)}`).join("\n") : "_(vide)_";

  if (sub === "liste") {
    const favs = listFavorites(ctx.db, scope);
    const note = perso && favs.length ? "\n_Votre liste personnelle remplace celle du groupe._" : "";
    await i.reply({ content: `Terrains préférés — ${where} :\n${show(favs)}${note}`, flags: perso ? MessageFlags.Ephemeral : undefined });
    return;
  }

  const input = i.options.getString("site", true);
  const site = matchSite(await getSites(ctx.session), input);
  if (!site) {
    await i.reply({ content: `Tennis « ${input} » introuvable dans l'annuaire officiel. Utilisez l'autocomplétion.`, flags: MessageFlags.Ephemeral });
    return;
  }

  let favs;
  if (sub === "ajouter") {
    const courts = parseCourts(i.options.getString("courts"));
    if (!courts) {
      await i.reply({ content: "Courts invalides : indiquez des numéros séparés par des virgules, ex. `5,7`.", flags: MessageFlags.Ephemeral });
      return;
    }
    favs = addFavorite(ctx.db, scope, site.name, {
      courtNumbers: courts,
      covered: i.options.getBoolean("couvert"),
      rank: i.options.getInteger("rang") ?? undefined,
    });
  } else if (sub === "retirer") {
    if (!removeFavorite(ctx.db, scope, site.name)) {
      await i.reply({ content: `${site.name} n'est pas dans ${where}.`, flags: MessageFlags.Ephemeral });
      return;
    }
    favs = listFavorites(ctx.db, scope);
  } else {
    if (!moveFavorite(ctx.db, scope, site.name, i.options.getInteger("rang", true))) {
      await i.reply({ content: `${site.name} n'est pas dans ${where}.`, flags: MessageFlags.Ephemeral });
      return;
    }
    favs = listFavorites(ctx.db, scope);
  }
  await i.reply({ content: `Terrains préférés — ${where} :\n${show(favs)}`, flags: perso ? MessageFlags.Ephemeral : undefined });
}
