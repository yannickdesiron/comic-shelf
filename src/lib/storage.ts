import path from "node:path";

/** Absolute path of the directory that holds uploaded covers. */
export function coversDir(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.COVERS_DIR ?? "data/covers");
}

/** Absolute path of one cover file. Callers validate `file` before use. */
export function coverPath(file: string): string {
  return path.join(/*turbopackIgnore: true*/ coversDir(), file);
}

/** Deletes a cover file if it exists. Missing files are not an error. */
export async function removeCover(file: string): Promise<void> {
  const fs = await import("node:fs/promises");
  await fs.rm(/*turbopackIgnore: true*/ coverPath(file), { force: true });
}
