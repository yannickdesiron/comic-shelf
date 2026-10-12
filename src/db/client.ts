import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";

import { foldText } from "@/lib/search";

import * as schema from "./schema";

export type Db = ReturnType<typeof createDb>;

/**
 * Creates a Drizzle client for the given SQLite file (or ":memory:") and
 * applies pending migrations. Used both by the app and by the test suite.
 */
export function createDb(file: string) {
  if (file !== ":memory:") {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  // Lets the shelf search compare text without case or diacritics, which
  // SQLite's LIKE cannot do on its own. See src/lib/search.ts.
  sqlite.function("unaccent", { deterministic: true }, (value) =>
    typeof value === "string" ? foldText(value) : (value ?? null),
  );

  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return db;
}

declare global {
  // Cached across hot reloads in development.
  var __comicShelfDb: Db | undefined;
}

export function getDb(): Db {
  if (!globalThis.__comicShelfDb) {
    globalThis.__comicShelfDb = createDb(process.env.DATABASE_PATH ?? "./data/comic-shelf.db");
  }
  return globalThis.__comicShelfDb;
}
