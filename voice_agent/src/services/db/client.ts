import Database from "better-sqlite3";
import { existsSync, mkdirSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { config } from "../../config";

function findMigrationsPath(): string {
  const candidates = [
    resolve(process.cwd(), "db-migrations.sql"),
    resolve(process.cwd(), "voice_agent/db-migrations.sql"),
    resolve(process.cwd(), "..", "db-migrations.sql"),
  ];
  for (const p of candidates) if (existsSync(p)) return p;
  return candidates[0];
}
const MIGRATIONS_PATH = findMigrationsPath();

// Ensure parent dir exists so better-sqlite3 can create the DB file.
// Skip for :memory: which has no fs path.
if (config.DONNA_DB_PATH !== ":memory:") {
  const parent = dirname(resolve(config.DONNA_DB_PATH));
  if (parent && !existsSync(parent)) mkdirSync(parent, { recursive: true });
}

export const db = new Database(config.DONNA_DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function runMigrations(): void {
  try {
    const sql = readFileSync(MIGRATIONS_PATH, "utf-8");
    db.exec(sql);
    console.log(`[db] migrations applied from ${MIGRATIONS_PATH}`);
  } catch (err) {
    console.error("[db] migrations failed:", err);
    throw err;
  }
}
