import { readFileSync } from "node:fs";
import { parse } from "yaml";

export interface AppConfig {
  timezone: string;
  opening: { hour: string; days_ahead: number };
  prewarm_minutes: number;
  max_parallel_workers: number;
  partial_policy: "keep" | "rollback";
  captcha: { provider: string; timeout_s: number };
  reminder_hours_before: number;
}

export interface Env {
  discordToken: string;
  discordClientId: string;
  discordGuildId: string;
  vaultKey: Buffer;
  dataDir: string;
  configPath: string;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
}

export function loadEnv(): Env {
  const vaultKey = Buffer.from(required("VAULT_KEY"), "base64");
  if (vaultKey.length !== 32) {
    throw new Error("VAULT_KEY doit faire 32 octets encodés en base64 (openssl rand -base64 32)");
  }
  return {
    discordToken: required("DISCORD_TOKEN"),
    discordClientId: required("DISCORD_CLIENT_ID"),
    discordGuildId: required("DISCORD_GUILD_ID"),
    vaultKey,
    dataDir: process.env.DATA_DIR ?? "./data",
    configPath: process.env.CONFIG_PATH ?? "./config.yaml",
  };
}

export function loadConfig(path: string): AppConfig {
  const config = parse(readFileSync(path, "utf8")) as AppConfig;
  if (!["keep", "rollback"].includes(config.partial_policy)) {
    throw new Error(`partial_policy invalide : ${config.partial_policy}`);
  }
  if (![6, 7].includes(config.opening.days_ahead)) {
    throw new Error(`opening.days_ahead doit valoir 6 ou 7 : ${config.opening.days_ahead}`);
  }
  return config;
}
