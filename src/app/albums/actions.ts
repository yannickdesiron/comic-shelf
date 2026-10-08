"use server";

import crypto from "node:crypto";
import fs from "node:fs/promises";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getDb } from "@/db/client";
import {
  createAlbum,
  deleteAlbum,
  getAlbum,
  newAlbumSchema,
  setOwned,
  setReadStatus,
  updateAlbum,
  type NewAlbum,
  type ReadStatus,
} from "@/lib/albums";
import { coverPath, coversDir, removeCover } from "@/lib/storage";

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

type Parsed = { ok: true; data: NewAlbum } | { ok: false; state: FormState };

/** Validates the form and stores an uploaded cover, if any. */
async function parseAlbumForm(formData: FormData): Promise<Parsed> {
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
    return { ok: false, state: { errors, values } };
  }

  let coverFile: string | null = null;
  const cover = formData.get("cover");
  if (cover instanceof File && cover.size > 0) {
    const ext = COVER_TYPES[cover.type];
    if (!ext) return { ok: false, state: { errors: { cover: "Alleen JPG, PNG of WebP" }, values } };
    if (cover.size > MAX_COVER_BYTES) return { ok: false, state: { errors: { cover: "Maximaal 5 MB" }, values } };

    await fs.mkdir(coversDir(), { recursive: true });
    coverFile = `${crypto.randomUUID()}.${ext}`;
    await fs.writeFile(coverPath(coverFile), Buffer.from(await cover.arrayBuffer()));
  }

  return { ok: true, data: { ...parsed.data, coverFile } };
}

export async function createAlbumAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = await parseAlbumForm(formData);
  if (!parsed.ok) return parsed.state;

  const { slug } = createAlbum(getDb(), parsed.data);

  revalidatePath("/");
  redirect(`/albums/${slug}`);
}

export async function updateAlbumAction(slug: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const db = getDb();
  const detail = getAlbum(db, slug);
  if (!detail) return { errors: { form: "Dit album bestaat niet meer" }, values: {} };

  const parsed = await parseAlbumForm(formData);
  if (!parsed.ok) return parsed.state;

  const { previousCover } = updateAlbum(db, detail.album.id, parsed.data);
  if (previousCover) await removeCover(previousCover);

  revalidatePath("/");
  revalidatePath(`/albums/${slug}`);
  redirect(`/albums/${slug}`);
}

export async function deleteAlbumAction(slug: string): Promise<void> {
  const db = getDb();
  const detail = getAlbum(db, slug);
  if (detail) {
    const { coverFiles } = deleteAlbum(db, detail.album.id);
    await Promise.all(coverFiles.map(removeCover));
  }

  revalidatePath("/");
  redirect("/");
}

export async function setReadStatusAction(slug: string, status: ReadStatus): Promise<void> {
  const db = getDb();
  const detail = getAlbum(db, slug);
  if (!detail) return;
  setReadStatus(db, detail.album.id, status);
  revalidatePath("/");
  revalidatePath(`/albums/${slug}`);
}

export async function setOwnedAction(slug: string, owned: boolean): Promise<void> {
  const db = getDb();
  const detail = getAlbum(db, slug);
  if (!detail) return;
  setOwned(db, detail.album.id, owned);
  revalidatePath("/");
  revalidatePath(`/albums/${slug}`);
}
