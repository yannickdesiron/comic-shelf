import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { z } from "zod";

import type { Db } from "@/db/client";
import { albums, copies, editions, series } from "@/db/schema";
import { parseIsbn } from "@/lib/isbn";
import { slugify } from "@/lib/slug";

const currentYear = new Date().getFullYear();

/** Form fields arrive as strings (or not at all); empty means "not set". */
const optionalText = z
  .string()
  .optional()
  .transform((v) => {
    const t = v?.trim() ?? "";
    return t.length === 0 ? null : t;
  });

const optionalInt = z
  .string()
  .optional()
  .transform((v) => {
    const t = v?.trim() ?? "";
    return t.length === 0 ? null : Number(t);
  });

/** Validated shape of the "add album" form. */
export const newAlbumSchema = z.object({
  seriesTitle: z.string().trim().min(1, "Reeks is verplicht"),
  title: z.string().trim().min(1, "Titel is verplicht"),
  number: optionalInt.pipe(z.number().int().min(0).nullable()),
  publisher: optionalText,
  year: optionalInt.pipe(z.number().int().min(1900).max(currentYear + 1).nullable()),
  isbn: z
    .string()
    .optional()
    .transform((v, ctx) => {
      const t = v?.trim() ?? "";
      if (t.length === 0) return null;
      const parsed = parseIsbn(t);
      if (!parsed) {
        ctx.addIssue({ code: "custom", message: "Ongeldig ISBN" });
        return z.NEVER;
      }
      return parsed;
    }),
  language: z.enum(["nl", "fr", "en"]).default("nl"),
  format: z.enum(["softcover", "hardcover", "digital"]).default("softcover"),
  kind: z.enum(["physical", "digital"]).default("physical"),
  readStatus: z.enum(["unread", "reading", "read"]).default("unread"),
  location: optionalText,
  notes: optionalText,
  coverFile: z.string().nullable().optional().default(null),
});

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export type NewAlbumInput = z.input<typeof newAlbumSchema>;
export type NewAlbum = z.output<typeof newAlbumSchema>;

/**
 * Creates the series (when it does not exist yet), the album, one edition
 * and one owned copy in a single transaction. Returns the album slug.
 */
export function createAlbum(db: Db, input: NewAlbum): { albumId: number; slug: string } {
  return db.transaction((tx) => {
    const seriesSlug = slugify(input.seriesTitle);
    let seriesRow = tx.select().from(series).where(eq(series.slug, seriesSlug)).get();
    if (!seriesRow) {
      seriesRow = tx
        .insert(series)
        .values({ title: input.seriesTitle, slug: seriesSlug })
        .returning()
        .get();
    }

    const albumSlug = uniqueAlbumSlug(tx, seriesSlug, input.number, input.title);
    const albumRow = tx
      .insert(albums)
      .values({ seriesId: seriesRow.id, title: input.title, number: input.number, slug: albumSlug })
      .returning()
      .get();

    const editionRow = tx
      .insert(editions)
      .values({
        albumId: albumRow.id,
        publisher: input.publisher,
        year: input.year,
        isbn: input.isbn,
        language: input.language,
        format: input.format,
        coverFile: input.coverFile,
      })
      .returning()
      .get();

    tx.insert(copies)
      .values({
        editionId: editionRow.id,
        kind: input.kind,
        readStatus: input.readStatus,
        location: input.location,
        notes: input.notes,
      })
      .run();

    return { albumId: albumRow.id, slug: albumSlug };
  });
}

function uniqueAlbumSlug(db: Tx, seriesSlug: string, number: number | null, title: string) {
  const base = [seriesSlug, number !== null ? String(number) : null, slugify(title)]
    .filter(Boolean)
    .join("-");
  let candidate = base;
  for (let i = 2; db.select({ id: albums.id }).from(albums).where(eq(albums.slug, candidate)).get(); i++) {
    candidate = `${base}-${i}`;
  }
  return candidate;
}

export type ShelfAlbum = {
  id: number;
  slug: string;
  title: string;
  number: number | null;
  seriesTitle: string;
  publisher: string | null;
  year: number | null;
  coverFile: string | null;
  readStatus: string;
  createdAt: Date;
};

/**
 * Lists albums for the shelf, newest first. A query matches series title,
 * album title, publisher or ISBN (case-insensitive substring).
 */
export function listAlbums(db: Db, query = ""): ShelfAlbum[] {
  const q = query.trim();
  const pattern = `%${q}%`;

  const rows = db
    .select({
      id: albums.id,
      slug: albums.slug,
      title: albums.title,
      number: albums.number,
      seriesTitle: series.title,
      publisher: editions.publisher,
      year: editions.year,
      coverFile: editions.coverFile,
      readStatus: sql<string>`coalesce(min(${copies.readStatus}), 'unread')`,
      createdAt: albums.createdAt,
    })
    .from(albums)
    .innerJoin(series, eq(series.id, albums.seriesId))
    .innerJoin(editions, eq(editions.albumId, albums.id))
    .leftJoin(copies, eq(copies.editionId, editions.id))
    .where(
      q.length === 0
        ? undefined
        : and(
            or(
              like(series.title, pattern),
              like(albums.title, pattern),
              like(editions.publisher, pattern),
              like(editions.isbn, pattern),
            ),
          ),
    )
    .groupBy(albums.id, editions.id)
    .orderBy(desc(albums.createdAt), desc(albums.id))
    .all();

  return rows;
}
