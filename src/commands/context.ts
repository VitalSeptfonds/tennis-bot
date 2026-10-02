import type { AppConfig } from "../config.js";
import type { Db } from "../db.js";
import type { ParisSession } from "../paris/session.js";

export interface Ctx {
  db: Db;
  config: AppConfig;
  session: ParisSession;
}
