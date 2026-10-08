import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Domain model, kept deliberately small:
 *
 *   series  1 ─── n  albums  1 ─── n  editions  1 ─── n  copies
 *
 * - A *series* is a comic series ("Suske en Wiske", "Blake en Mortimer").
 * - An *album* is a story in that series, usually numbered.
 * - An *edition* is one specific printing of an album (publisher, year, ISBN, cover).
 * - A *copy* is the thing you actually own: a physical book or a digital file.
 *   An album without copies is one you want but do not have yet.
 */

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
};

export const series = sqliteTable(
  "series",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    ...timestamps,
  },
  (t) => [index("series_title_idx").on(t.title)],
);

export const albums = sqliteTable(
  "albums",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    seriesId: integer("series_id")
      .notNull()
      .references(() => series.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    number: integer("number"),
    slug: text("slug").notNull().unique(),
    /** Whether you have read this story. Independent of owning a copy. */
    readStatus: text("read_status", { enum: ["unread", "reading", "read"] })
      .notNull()
      .default("unread"),
    ...timestamps,
  },
  (t) => [index("albums_series_idx").on(t.seriesId), index("albums_title_idx").on(t.title)],
);

export const editions = sqliteTable(
  "editions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    albumId: integer("album_id")
      .notNull()
      .references(() => albums.id, { onDelete: "cascade" }),
    publisher: text("publisher"),
    year: integer("year"),
    isbn: text("isbn"),
    language: text("language", { enum: ["nl", "fr", "en"] }).notNull().default("nl"),
    format: text("format", { enum: ["softcover", "hardcover", "digital"] })
      .notNull()
      .default("softcover"),
    coverFile: text("cover_file"),
    ...timestamps,
  },
  (t) => [index("editions_album_idx").on(t.albumId), index("editions_isbn_idx").on(t.isbn)],
);

export const copies = sqliteTable(
  "copies",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    editionId: integer("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["physical", "digital"] }).notNull().default("physical"),
    location: text("location"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("copies_edition_idx").on(t.editionId)],
);

export type Series = typeof series.$inferSelect;
export type Album = typeof albums.$inferSelect;
export type Edition = typeof editions.$inferSelect;
export type Copy = typeof copies.$inferSelect;
