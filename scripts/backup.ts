/**
 * Makes a verified backup of the collection: the database and the uploaded
 * covers, into one timestamped folder.
 *
 *   npm run db:backup
 *
 * Why this exists instead of `cp data/comic-shelf.db somewhere`: the database
 * runs in WAL mode, so recent writes live in the `-wal` file next to it. A
 * plain copy of the `.db` file alone can hand you a database with no tables at
 * all. This uses SQLite's online backup API, which is safe to run while the
 * app is serving requests, and then opens the result to prove it is readable.
 *
 * Paths follow the same environment variables as the app:
 *   DATABASE_PATH   default ./data/comic-shelf.db
 *   COVERS_DIR      default data/covers
 *   BACKUP_DIR      default ./backups
 *
 * Old backups are kept. Pass --keep <n> to delete all but the newest n.
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const dbPath = path.resolve(process.env.DATABASE_PATH ?? "./data/comic-shelf.db");
const coversDir = path.resolve(process.env.COVERS_DIR ?? "data/covers");
const backupRoot = path.resolve(process.env.BACKUP_DIR ?? "./backups");

/** Folder name that sorts chronologically and is safe on every filesystem. */
function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}

const STAMP_PATTERN = /^\d{4}-\d{2}-\d{2}_\d{6}(-\d+)?$/;

/** A folder that does not exist yet, so two backups in one second cannot collide. */
function freeTarget(base: string): string {
  let candidate = path.join(backupRoot, base);
  for (let i = 2; fs.existsSync(candidate); i++) {
    candidate = path.join(backupRoot, `${base}-${i}`);
  }
  return candidate;
}

/**
 * Folds the WAL into the database file and switches the copy out of WAL mode,
 * so a finished backup is one self-contained file with no `-wal`/`-shm` beside
 * it. Without this the backup repeats the very trap it exists to avoid.
 */
function compact(file: string): void {
  const db = new Database(file, { fileMustExist: true });
  try {
    db.pragma("wal_checkpoint(TRUNCATE)");
    db.pragma("journal_mode = DELETE");
  } finally {
    db.close();
  }
  for (const side of ["-wal", "-shm"]) {
    fs.rmSync(`${file}${side}`, { force: true });
  }
}

function mb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function dirSize(dir: string): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = dirSize(full);
      files += sub.files;
      bytes += sub.bytes;
    } else if (entry.isFile()) {
      files += 1;
      bytes += fs.statSync(full).size;
    }
  }
  return { files, bytes };
}

/** Reads the counts back out of a finished backup, to prove it is not empty. */
function verify(file: string): Record<string, number> {
  const db = new Database(file, { readonly: true, fileMustExist: true });
  try {
    const tables = db
      .prepare("select name from sqlite_master where type = 'table' and name not like 'sqlite_%'")
      .all() as { name: string }[];
    if (tables.length === 0) {
      throw new Error("the backup contains no tables");
    }
    const counts: Record<string, number> = {};
    for (const table of ["series", "albums", "editions", "copies"]) {
      if (!tables.some((t) => t.name === table)) continue;
      const row = db.prepare(`select count(*) as n from "${table}"`).get() as { n: number };
      counts[table] = row.n;
    }
    return counts;
  } finally {
    db.close();
  }
}

/** Deletes all but the newest `keep` backup folders. Only touches our own. */
function prune(keep: number): string[] {
  const folders = fs
    .readdirSync(backupRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory() && STAMP_PATTERN.test(e.name))
    .map((e) => e.name)
    .sort()
    .reverse();

  const doomed = folders.slice(keep);
  for (const name of doomed) {
    fs.rmSync(path.join(backupRoot, name), { recursive: true, force: true });
  }
  return doomed;
}

function parseKeep(argv: string[]): number | null {
  const i = argv.indexOf("--keep");
  if (i === -1) return null;
  const n = Number(argv[i + 1]);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error("--keep needs a whole number of backups to keep, at least 1");
  }
  return n;
}

async function main() {
  const keep = parseKeep(process.argv.slice(2));

  if (!fs.existsSync(dbPath)) {
    throw new Error(`No database at ${dbPath}. Set DATABASE_PATH if it lives elsewhere.`);
  }

  fs.mkdirSync(backupRoot, { recursive: true });
  const target = freeTarget(stamp());
  fs.mkdirSync(target);

  const dbTarget = path.join(target, path.basename(dbPath));
  const source = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    await source.backup(dbTarget);
  } finally {
    source.close();
  }

  compact(dbTarget);
  const counts = verify(dbTarget);

  let covers = { files: 0, bytes: 0 };
  if (fs.existsSync(coversDir)) {
    const coverTarget = path.join(target, "covers");
    fs.cpSync(coversDir, coverTarget, { recursive: true });
    covers = dirSize(coverTarget);
  }

  console.log(`Backup written to ${target}`);
  console.log(`  database  ${mb(fs.statSync(dbTarget).size)}`);
  for (const [table, n] of Object.entries(counts)) {
    console.log(`    ${table.padEnd(9)} ${n}`);
  }
  console.log(`  covers    ${covers.files} files, ${mb(covers.bytes)}`);

  if (keep !== null) {
    const removed = prune(keep);
    console.log(
      removed.length === 0
        ? `  kept all backups (${keep} requested, nothing older to remove)`
        : `  removed ${removed.length} older backup(s), keeping the newest ${keep}`,
    );
  }
}

main().catch((error: unknown) => {
  console.error(`Backup failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
