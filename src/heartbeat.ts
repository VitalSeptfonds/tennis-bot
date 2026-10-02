import { join } from "node:path";

export const HEARTBEAT_FILE = "heartbeat";
export const HEARTBEAT_INTERVAL_MS = 30_000;
export const HEARTBEAT_MAX_AGE_MS = 90_000;

export function heartbeatPath(dataDir: string): string {
  return join(dataDir, HEARTBEAT_FILE);
}
