import fs from "node:fs/promises";
import path from "node:path";

import { coverPath } from "@/lib/storage";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/** Serves uploaded covers from COVERS_DIR. File names are UUID + extension only. */
export async function GET(_req: Request, { params }: RouteContext<"/covers/[file]">) {
  const { file } = await params;
  if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(file)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const data = await fs.readFile(/*turbopackIgnore: true*/ coverPath(file));
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": CONTENT_TYPES[path.extname(file)],
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
