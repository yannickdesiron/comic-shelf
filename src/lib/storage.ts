import path from "node:path";

/** Absolute path of the directory that holds uploaded covers. */
export function coversDir(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.COVERS_DIR ?? "data/covers");
}

/** Absolute path of one cover file. Callers validate `file` before use. */
export function coverPath(file: string): string {
  return path.join(/*turbopackIgnore: true*/ coversDir(), file);
}
