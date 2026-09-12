"use server";

import crypto from "node:crypto";
import fs from "node:fs/promises";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getDb } from "@/db/client";
import { createAlbum, newAlbumSchema } from "@/lib/albums";
import { coverPath, coversDir } from "@/lib/storage";

export type FormState = {
  errors: Record<string, string>;
  values: Record<string, string>;
};

const MAX_COVER_BYTES = 5 * 1024 * 1024;
const COVER_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function createAlbumAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    // Skip React's internal $ACTION_* fields, keep only our own inputs.
    if (typeof value === "string" && !key.startsWith("$")) values[key] = value;
  }

  const parsed = newAlbumSchema.safeParse(values);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      errors[key] ??= issue.message;
    }
    return { errors, values };
  }

  let coverFile: string | null = null;
  const cover = formData.get("cover");
  if (cover instanceof File && cover.size > 0) {
    const ext = COVER_TYPES[cover.type];
    if (!ext) return { errors: { cover: "Alleen JPG, PNG of WebP" }, values };
    if (cover.size > MAX_COVER_BYTES) return { errors: { cover: "Maximaal 5 MB" }, values };

    await fs.mkdir(coversDir(), { recursive: true });
    coverFile = `${crypto.randomUUID()}.${ext}`;
    await fs.writeFile(coverPath(coverFile), Buffer.from(await cover.arrayBuffer()));
  }

  createAlbum(getDb(), { ...parsed.data, coverFile });

  revalidatePath("/");
  redirect("/");
}
