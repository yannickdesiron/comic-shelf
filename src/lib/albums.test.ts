import { beforeEach, describe, expect, it } from "vitest";

import { createDb, type Db } from "@/db/client";
import { createAlbum, listAlbums, newAlbumSchema } from "./albums";

let db: Db;

beforeEach(() => {
  db = createDb(":memory:");
});

const texasrakkers = newAlbumSchema.parse({
  seriesTitle: "Suske en Wiske",
  title: "De Texasrakkers",
  number: "67",
  publisher: "Standaard Uitgeverij",
  year: "1995",
  isbn: "978-90-02-25466-6",
});

describe("newAlbumSchema", () => {
  it("normalises empty optional fields to null", () => {
    const parsed = newAlbumSchema.parse({ seriesTitle: "A", title: "B", number: "", year: "", isbn: "" });
    expect(parsed.number).toBeNull();
    expect(parsed.year).toBeNull();
    expect(parsed.isbn).toBeNull();
    expect(parsed.language).toBe("nl");
  });

  it("rejects an invalid ISBN with a readable message", () => {
    const result = newAlbumSchema.safeParse({ seriesTitle: "A", title: "B", number: "", year: "", isbn: "123" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(["isbn"]);
      expect(result.error.issues[0].message).toBe("Ongeldig ISBN");
    }
  });
});

describe("createAlbum", () => {
  it("creates series, album, edition and copy", () => {
    const { slug } = createAlbum(db, texasrakkers);
    expect(slug).toBe("suske-en-wiske-67-de-texasrakkers");

    const shelf = listAlbums(db);
    expect(shelf).toHaveLength(1);
    expect(shelf[0]).toMatchObject({
      title: "De Texasrakkers",
      number: 67,
      seriesTitle: "Suske en Wiske",
      publisher: "Standaard Uitgeverij",
      year: 1995,
      readStatus: "unread",
    });
  });

  it("reuses an existing series", () => {
    createAlbum(db, texasrakkers);
    createAlbum(db, newAlbumSchema.parse({ seriesTitle: "suske en wiske", title: "De Zwarte Madam", number: "1" }));

    const shelf = listAlbums(db);
    expect(shelf).toHaveLength(2);
    expect(new Set(shelf.map((a) => a.seriesTitle))).toEqual(new Set(["Suske en Wiske"]));
  });

  it("makes slugs unique when the same album is added twice", () => {
    const first = createAlbum(db, texasrakkers);
    const second = createAlbum(db, texasrakkers);
    expect(first.slug).toBe("suske-en-wiske-67-de-texasrakkers");
    expect(second.slug).toBe("suske-en-wiske-67-de-texasrakkers-2");
  });
});

describe("listAlbums", () => {
  beforeEach(() => {
    createAlbum(db, texasrakkers);
    createAlbum(
      db,
      newAlbumSchema.parse({
        seriesTitle: "Blake en Mortimer",
        title: "Het Gele Teken",
        number: "6",
        publisher: "Blake en Mortimer Uitgeverij",
      }),
    );
  });

  it("returns everything when the query is empty", () => {
    expect(listAlbums(db, "")).toHaveLength(2);
  });

  it("searches across series, title, publisher and isbn", () => {
    expect(listAlbums(db, "wiske").map((a) => a.title)).toEqual(["De Texasrakkers"]);
    expect(listAlbums(db, "gele").map((a) => a.title)).toEqual(["Het Gele Teken"]);
    expect(listAlbums(db, "standaard").map((a) => a.title)).toEqual(["De Texasrakkers"]);
    expect(listAlbums(db, "9789002254666").map((a) => a.title)).toEqual(["De Texasrakkers"]);
    expect(listAlbums(db, "kuifje")).toHaveLength(0);
  });
});
