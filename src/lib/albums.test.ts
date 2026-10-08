import { beforeEach, describe, expect, it } from "vitest";

import { createDb, type Db } from "@/db/client";
import { createAlbum, deleteAlbum, getAlbum, listAlbums, newAlbumSchema, setOwned, setReadStatus, updateAlbum } from "./albums";
import { copies, series } from "@/db/schema";

let db: Db;

beforeEach(() => {
  db = createDb(":memory:");
});

const rawTexasrakkers = {
  seriesTitle: "Suske en Wiske",
  title: "De Texasrakkers",
  number: "67",
  publisher: "Standaard Uitgeverij",
  year: "1995",
  isbn: "978-90-02-25466-6",
};
const texasrakkers = newAlbumSchema.parse(rawTexasrakkers);

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

describe("getAlbum", () => {
  it("returns album, series, edition and copy by slug", () => {
    const { slug } = createAlbum(db, texasrakkers);
    const detail = getAlbum(db, slug);
    expect(detail?.series.title).toBe("Suske en Wiske");
    expect(detail?.album.number).toBe(67);
    expect(detail?.edition.isbn).toBe("9789002254666");
    expect(detail?.album.readStatus).toBe("unread");
    expect(detail?.copy).not.toBeNull();
  });

  it("returns null for an unknown slug", () => {
    expect(getAlbum(db, "nope")).toBeNull();
  });
});

describe("updateAlbum", () => {
  it("updates all layers and keeps the slug stable", () => {
    const { albumId, slug } = createAlbum(db, texasrakkers);
    updateAlbum(
      db,
      albumId,
      newAlbumSchema.parse({
        seriesTitle: "Suske en Wiske",
        title: "De Texasrakkers (herdruk)",
        number: "67",
        publisher: "WPG",
        year: "2010",
        isbn: "",
        format: "hardcover",
        readStatus: "read",
        location: "Plank 3",
      }),
    );
    const detail = getAlbum(db, slug);
    expect(detail?.album).toMatchObject({ title: "De Texasrakkers (herdruk)", readStatus: "read" });
    expect(detail?.edition).toMatchObject({ publisher: "WPG", year: 2010, isbn: null, format: "hardcover" });
    expect(detail?.copy).toMatchObject({ location: "Plank 3" });
  });

  it("moves the album to a new series and removes the emptied one", () => {
    const { albumId, slug } = createAlbum(db, texasrakkers);
    updateAlbum(db, albumId, newAlbumSchema.parse({ ...rawTexasrakkers, seriesTitle: "Jommeke" }));
    expect(getAlbum(db, slug)?.series.title).toBe("Jommeke");
    expect(db.select().from(series).all().map((s) => s.title)).toEqual(["Jommeke"]);
  });

  it("keeps the existing cover when none is supplied, and reports the old one when replaced", () => {
    const { albumId, slug } = createAlbum(db, { ...texasrakkers, coverFile: "old.png" });
    expect(updateAlbum(db, albumId, texasrakkers).previousCover).toBeNull();
    expect(getAlbum(db, slug)?.edition.coverFile).toBe("old.png");

    expect(updateAlbum(db, albumId, { ...texasrakkers, coverFile: "new.png" }).previousCover).toBe("old.png");
    expect(getAlbum(db, slug)?.edition.coverFile).toBe("new.png");
  });
});

describe("deleteAlbum", () => {
  it("removes the album with its edition and copy, returns orphaned covers", () => {
    const { albumId, slug } = createAlbum(db, { ...texasrakkers, coverFile: "c.png" });
    expect(deleteAlbum(db, albumId)).toEqual({ coverFiles: ["c.png"] });
    expect(getAlbum(db, slug)).toBeNull();
    expect(listAlbums(db)).toHaveLength(0);
  });

  it("removes the series when it has no albums left, keeps it otherwise", () => {
    const first = createAlbum(db, texasrakkers);
    createAlbum(db, newAlbumSchema.parse({ ...rawTexasrakkers, title: "De Zwarte Madam", number: "1" }));
    deleteAlbum(db, first.albumId);
    expect(db.select().from(series).all()).toHaveLength(1);
    deleteAlbum(db, 2);
    expect(db.select().from(series).all()).toHaveLength(0);
  });

  it("is a no-op for an unknown id", () => {
    expect(deleteAlbum(db, 999)).toEqual({ coverFiles: [] });
  });
});

describe("ownership", () => {
  it("creates no copy for a wanted album, and reports it on the shelf", () => {
    const { slug } = createAlbum(db, newAlbumSchema.parse({ ...rawTexasrakkers, owned: "no" }));
    expect(getAlbum(db, slug)?.copy).toBeNull();
    expect(listAlbums(db)[0].owned).toBe(false);
  });

  it("switches between owned and wanted through updateAlbum", () => {
    const { albumId, slug } = createAlbum(db, texasrakkers);
    updateAlbum(db, albumId, { ...texasrakkers, owned: "no" });
    expect(getAlbum(db, slug)?.copy).toBeNull();
    updateAlbum(db, albumId, { ...texasrakkers, location: "Plank 9" });
    expect(getAlbum(db, slug)?.copy).toMatchObject({ location: "Plank 9" });
  });

  it("setOwned creates or removes the copy and is idempotent", () => {
    const { albumId, slug } = createAlbum(db, newAlbumSchema.parse({ ...rawTexasrakkers, owned: "no" }));
    setOwned(db, albumId, true);
    setOwned(db, albumId, true);
    expect(getAlbum(db, slug)?.copy).not.toBeNull();
    expect(db.select().from(copies).all()).toHaveLength(1);
    setOwned(db, albumId, false);
    expect(getAlbum(db, slug)?.copy).toBeNull();
  });

  it("setReadStatus updates the album", () => {
    const { albumId, slug } = createAlbum(db, texasrakkers);
    setReadStatus(db, albumId, "reading");
    expect(getAlbum(db, slug)?.album.readStatus).toBe("reading");
    expect(listAlbums(db)[0].readStatus).toBe("reading");
  });
});

describe("listAlbums filters", () => {
  beforeEach(() => {
    createAlbum(db, newAlbumSchema.parse({ ...rawTexasrakkers, readStatus: "read" }));
    createAlbum(db, newAlbumSchema.parse({ seriesTitle: "Suske en Wiske", title: "De Zwarte Madam", number: "140", owned: "no" }));
    createAlbum(db, newAlbumSchema.parse({ seriesTitle: "Kuifje", title: "De Blauwe Lotus", readStatus: "reading" }));
  });

  it("filters on owned", () => {
    expect(listAlbums(db, { owned: "yes" }).map((a) => a.title).sort()).toEqual(["De Blauwe Lotus", "De Texasrakkers"]);
    expect(listAlbums(db, { owned: "no" }).map((a) => a.title)).toEqual(["De Zwarte Madam"]);
  });

  it("filters on read status", () => {
    expect(listAlbums(db, { readStatus: "read" }).map((a) => a.title)).toEqual(["De Texasrakkers"]);
    expect(listAlbums(db, { readStatus: "unread" }).map((a) => a.title)).toEqual(["De Zwarte Madam"]);
  });

  it("combines filters with the text query", () => {
    expect(listAlbums(db, { q: "wiske", owned: "yes" }).map((a) => a.title)).toEqual(["De Texasrakkers"]);
    expect(listAlbums(db, { q: "wiske", readStatus: "reading" })).toHaveLength(0);
  });
});
