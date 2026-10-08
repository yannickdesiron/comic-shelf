import { and, desc, eq, exists, isNull, like, not, or, sql } from "drizzle-orm";
import { z } from "zod";

import type { Db } from "@/db/client";
import { albums, copies, editions, series, type Album, type Copy, type Edition, type Series } from "@/db/schema";
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

export const READ_STATUSES = ["unread", "reading", "read"] as const;
export type ReadStatus = (typeof READ_STATUSES)[number];

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
  readStatus: z.enum(READ_STATUSES).default("unread"),
  /** "yes" creates a copy; "no" records the album as wanted. */
  owned: z.enum(["yes", "no"]).default("yes"),
  kind: z.enum(["physical", "digital"]).default("physical"),
  location: optionalText,
  notes: optionalText,
  coverFile: z.string().nullable().optional().default(null),
});

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export type NewAlbumInput = z.input<typeof newAlbumSchema>;
export type NewAlbum = z.output<typeof newAlbumSchema>;

/**
 * Creates the series (when it does not exist yet), the album, one edition
 * and, when owned, one copy, in a single transaction. Returns the album slug.
 */
export function createAlbum(db: Db, input: NewAlbum): { albumId: number; slug: string } {
  return db.transaction((tx) => {
    const seriesRow = findOrCreateSeries(tx, input.seriesTitle);
    const albumSlug = uniqueAlbumSlug(tx, seriesRow.slug, input.number, input.title);
    const albumRow = tx
      .insert(albums)
      .values({
        seriesId: seriesRow.id,
        title: input.title,
        number: input.number,
        slug: albumSlug,
        readStatus: input.readStatus,
      })
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

    if (input.owned === "yes") {
      tx.insert(copies)
        .values({ editionId: editionRow.id, kind: input.kind, location: input.location, notes: input.notes })
        .run();
    }

    return { albumId: albumRow.id, slug: albumSlug };
  });
}

function findOrCreateSeries(db: Tx, title: string): Series {
  const slug = slugify(title);
  return (
    db.select().from(series).where(eq(series.slug, slug)).get() ??
    db.insert(series).values({ title, slug }).returning().get()
  );
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
  readStatus: ReadStatus;
  owned: boolean;
  createdAt: Date;
};

export type ShelfFilters = {
  /** Text query across series, title, publisher, ISBN. */
  q?: string;
  owned?: "yes" | "no";
  readStatus?: ReadStatus;
};

/** Lists albums for the shelf, newest first, narrowed by the given filters. */
export function listAlbums(db: Db, filters: ShelfFilters | string = {}): ShelfAlbum[] {
  const f = typeof filters === "string" ? { q: filters } : filters;
  const q = f.q?.trim() ?? "";
  const pattern = `%${q}%`;

  const hasCopy = exists(db.select({ id: copies.id }).from(copies).where(eq(copies.editionId, editions.id)));

  const conditions = [
    q.length > 0
      ? or(
          like(series.title, pattern),
          like(albums.title, pattern),
          like(editions.publisher, pattern),
          like(editions.isbn, pattern),
        )
      : undefined,
    f.owned === "yes" ? hasCopy : f.owned === "no" ? not(hasCopy) : undefined,
    f.readStatus ? eq(albums.readStatus, f.readStatus) : undefined,
  ].filter((c) => c !== undefined);

  return db
    .select({
      id: albums.id,
      slug: albums.slug,
      title: albums.title,
      number: albums.number,
      seriesTitle: series.title,
      publisher: editions.publisher,
      year: editions.year,
      coverFile: editions.coverFile,
      readStatus: albums.readStatus,
      owned: sql<number>`${hasCopy}`.mapWith(Boolean),
      createdAt: albums.createdAt,
    })
    .from(albums)
    .innerJoin(series, eq(series.id, albums.seriesId))
    .innerJoin(editions, eq(editions.albumId, albums.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(albums.id)
    .orderBy(desc(albums.createdAt), desc(albums.id))
    .all();
}

export type AlbumDetail = {
  album: Album;
  series: Series;
  edition: Edition;
  /** null when the album is wanted rather than owned. */
  copy: Copy | null;
};

/** Full record for one album by slug, or null when it does not exist. */
export function getAlbum(db: Db, slug: string): AlbumDetail | null {
  const row = db
    .select({ album: albums, series, edition: editions, copy: copies })
    .from(albums)
    .innerJoin(series, eq(series.id, albums.seriesId))
    .innerJoin(editions, eq(editions.albumId, albums.id))
    .leftJoin(copies, eq(copies.editionId, editions.id))
    .where(eq(albums.slug, slug))
    .orderBy(copies.id)
    .get();
  return row ?? null;
}

/**
 * Updates an existing album, its edition and its copy. Moving the album to a
 * different series creates that series when needed and removes the old one
 * when it is left empty. Switching `owned` creates or removes the copy. The
 * slug stays stable so links keep working. Returns the previous cover file
 * when the cover changed, so the caller can delete it from disk.
 */
export function updateAlbum(db: Db, albumId: number, input: NewAlbum): { previousCover: string | null } {
  return db.transaction((tx) => {
    const current = tx.select().from(albums).where(eq(albums.id, albumId)).get();
    if (!current) throw new Error(`Album ${albumId} not found`);

    const seriesRow = findOrCreateSeries(tx, input.seriesTitle);
    tx.update(albums)
      .set({ seriesId: seriesRow.id, title: input.title, number: input.number, readStatus: input.readStatus })
      .where(eq(albums.id, albumId))
      .run();
    if (seriesRow.id !== current.seriesId) deleteSeriesIfEmpty(tx, current.seriesId);

    const edition = tx.select().from(editions).where(eq(editions.albumId, albumId)).get();
    if (!edition) throw new Error(`Album ${albumId} has no edition`);

    const coverChanged = input.coverFile !== null && input.coverFile !== edition.coverFile;
    tx.update(editions)
      .set({
        publisher: input.publisher,
        year: input.year,
        isbn: input.isbn,
        language: input.language,
        format: input.format,
        coverFile: coverChanged ? input.coverFile : edition.coverFile,
      })
      .where(eq(editions.id, edition.id))
      .run();

    const copy = tx.select().from(copies).where(eq(copies.editionId, edition.id)).get();
    if (input.owned === "no") {
      if (copy) tx.delete(copies).where(eq(copies.editionId, edition.id)).run();
    } else {
      const copyValues = { kind: input.kind, location: input.location, notes: input.notes };
      if (copy) tx.update(copies).set(copyValues).where(eq(copies.id, copy.id)).run();
      else tx.insert(copies).values({ editionId: edition.id, ...copyValues }).run();
    }

    return { previousCover: coverChanged ? edition.coverFile : null };
  });
}

/** Marks the story as unread, reading or read. */
export function setReadStatus(db: Db, albumId: number, readStatus: ReadStatus): void {
  db.update(albums).set({ readStatus }).where(eq(albums.id, albumId)).run();
}

/** Turns a wanted album into an owned one (creates a copy) or back (removes copies). */
export function setOwned(db: Db, albumId: number, owned: boolean): void {
  db.transaction((tx) => {
    const edition = tx.select({ id: editions.id }).from(editions).where(eq(editions.albumId, albumId)).get();
    if (!edition) throw new Error(`Album ${albumId} has no edition`);
    const copy = tx.select({ id: copies.id }).from(copies).where(eq(copies.editionId, edition.id)).get();
    if (owned && !copy) tx.insert(copies).values({ editionId: edition.id }).run();
    if (!owned && copy) tx.delete(copies).where(eq(copies.editionId, edition.id)).run();
  });
}

/**
 * Deletes an album. Editions and copies go with it through cascading foreign
 * keys; an emptied series is removed too. Returns the cover files that are
 * now orphaned so the caller can delete them from disk.
 */
export function deleteAlbum(db: Db, albumId: number): { coverFiles: string[] } {
  return db.transaction((tx) => {
    const current = tx.select().from(albums).where(eq(albums.id, albumId)).get();
    if (!current) return { coverFiles: [] };

    const coverFiles = tx
      .select({ coverFile: editions.coverFile })
      .from(editions)
      .where(and(eq(editions.albumId, albumId), not(isNull(editions.coverFile))))
      .all()
      .map((e) => e.coverFile as string);

    tx.delete(albums).where(eq(albums.id, albumId)).run();
    deleteSeriesIfEmpty(tx, current.seriesId);

    return { coverFiles };
  });
}

function deleteSeriesIfEmpty(db: Tx, seriesId: number) {
  const remaining = db.select({ id: albums.id }).from(albums).where(eq(albums.seriesId, seriesId)).get();
  if (!remaining) db.delete(series).where(eq(series.id, seriesId)).run();
}
