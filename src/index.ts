import { mkdirSync, writeFileSync } from "node:fs";
import { Client, Events, GatewayIntentBits, MessageFlags, REST, Routes, SlashCommandBuilder } from "discord.js";
import { loadConfig, loadEnv } from "./config.js";
import { openDb } from "./db.js";
import { HEARTBEAT_INTERVAL_MS, heartbeatPath } from "./heartbeat.js";
import { ParisSession } from "./paris/session.js";
import type { Ctx } from "./commands/context.js";
import { dispoCommand, runDispo } from "./commands/dispo.js";
import { autocompleteSite, runTerrains, terrainsCommand } from "./commands/terrains.js";

const env = loadEnv();
const config = loadConfig(env.configPath);
mkdirSync(env.dataDir, { recursive: true });
const ctx: Ctx = { db: openDb(env.dataDir), config, session: new ParisSession() };

const commands = [
  new SlashCommandBuilder().setName("ping").setDescription("Vérifie que TennisBot répond"),
  dispoCommand,
  terrainsCommand,
];

async function registerCommands(): Promise<void> {
  const rest = new REST().setToken(env.discordToken);
  await rest.put(Routes.applicationGuildCommands(env.discordClientId, env.discordGuildId), {
    body: commands.map((c) => c.toJSON()),
  });
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, (c) => {
  console.log(`TennisBot connecté en tant que ${c.user.tag} (fuseau ${config.timezone})`);
  const beat = () => writeFileSync(heartbeatPath(env.dataDir), new Date().toISOString());
  beat();
  setInterval(beat, HEARTBEAT_INTERVAL_MS).unref();
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isAutocomplete()) {
      if (interaction.commandName === "terrains") await autocompleteSite(interaction, ctx);
      return;
    }
    if (!interaction.isChatInputCommand()) return;
    switch (interaction.commandName) {
      case "ping":
        await interaction.reply({ content: `pong (${Date.now() - interaction.createdTimestamp} ms)` });
        break;
      case "dispo":
        await runDispo(interaction, ctx);
        break;
      case "terrains":
        await runTerrains(interaction, ctx);
        break;
    }
  } catch (err) {
    console.error("Erreur de commande :", (err as Error).message);
    if (interaction.isRepliable()) {
      const msg = { content: "Une erreur est survenue, réessayez dans un instant.", flags: MessageFlags.Ephemeral } as const;
      await (interaction.deferred || interaction.replied ? interaction.followUp(msg) : interaction.reply(msg)).catch(() => {});
    }
  }
});

function shutdown(signal: string): void {
  console.log(`Signal ${signal} reçu, arrêt de TennisBot`);
  void client.destroy().finally(() => process.exit(0));
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

await registerCommands();
await client.login(env.discordToken);
