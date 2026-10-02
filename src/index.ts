import { mkdirSync, writeFileSync } from "node:fs";
import {
  Client,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
} from "discord.js";
import { loadConfig, loadEnv } from "./config.js";
import { HEARTBEAT_INTERVAL_MS, heartbeatPath } from "./heartbeat.js";

const env = loadEnv();
const config = loadConfig(env.configPath);
mkdirSync(env.dataDir, { recursive: true });

// Les commandes de la spécification (/dispo, /reserver, ...) seront ajoutées jalon par jalon.
const commands = [
  new SlashCommandBuilder().setName("ping").setDescription("Vérifie que TennisBot répond"),
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
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === "ping") {
    await interaction.reply({ content: `pong (${Date.now() - interaction.createdTimestamp} ms)` });
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
