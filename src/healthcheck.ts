// Utilisé par le HEALTHCHECK Docker : sain si le bot a écrit son battement récemment.
import { statSync } from "node:fs";
import { HEARTBEAT_MAX_AGE_MS, heartbeatPath } from "./heartbeat.js";

try {
  const age = Date.now() - statSync(heartbeatPath(process.env.DATA_DIR ?? "./data")).mtimeMs;
  process.exit(age < HEARTBEAT_MAX_AGE_MS ? 0 : 1);
} catch {
  process.exit(1);
}
