import { describe, expect, it } from "vitest";

import { createDb } from "@/db/client";
import { createAlbum, listAlbums, newAlbumSchema } from "@/lib/albums";
import { foldText, isbnFragment, likePattern } from "@/lib/search";

describe("foldText", () => {
  it("strips diacritics and lowercases", () => {
    expect(foldText("Léonard")).toBe("leonard");
    expect(foldText("LÉONARD")).toBe("leonard");
    expect(foldText("Blake et Mortimer")).toBe("blake et mortimer");
  });

  it("leaves text without diacritics alone", () => {
    expect(foldText("Jommeke")).toBe("jommeke");
  });
});

describe("likePattern", () => {
  it("wraps the folded query in wildcards", () => {
    expect(likePattern("Léonard")).toBe("%leonard%");
  });

  it("escapes characters LIKE would read as wildcards", () => {
    expect(likePattern("100%")).toBe("%100\\%%");
    expect(likePattern("_")).toBe("%\\_%");
    expect(likePattern("a\\b")).toBe("%a\\\\b%");
  });
});

describe("isbnFragment", () => {
  it("strips the separators printed on the album", () => {
    expect(isbnFragment("978-90-02-12345-6")).toBe("9789002123456");
    expect(isbnFragment("90 02 12345")).toBe("900212345");
  });

  it("ignores anything that is not an isbn fragment", () => {
    expect(isbnFragment("Suske")).toBeNull();
    expect(isbnFragment("12")).toBeNull();
  });
});

/** Regression tests for the search bugs confirmed against a real database. */
describe("shelf search", () => {
  const seeded = () => {
    const db = createDb(":memory:");
    const add = (seriesTitle: string, title: string, extra: Record<string, string> = {}) =>
      createAlbum(db, newAlbumSchema.parse({ seriesTitle, title, ...extra }));
    add("Léonard", "Een genie slaapt nooit");
    add("Jommeke", "De Zingende Aap", { publisher: "Ballon Media" });
    add("Blake en Mortimer", "Het Gele Teken", { isbn: "9789002123450" });
    return db;
  };

  it("finds an accented series without typing the accent", () => {
    const db = seeded();
    expect(listAlbums(db, "leonard")).toHaveLength(1);
    expect(listAlbums(db, "Leonard")).toHaveLength(1);
    expect(listAlbums(db, "LEONARD")).toHaveLength(1);
    expect(listAlbums(db, "Léonard")).toHaveLength(1);
  });

  it("still finds plain ascii titles in any case", () => {
    const db = seeded();
    expect(listAlbums(db, "jommeke")).toHaveLength(1);
    expect(listAlbums(db, "JOMMEKE")).toHaveLength(1);
    expect(listAlbums(db, "ballon")).toHaveLength(1);
  });

  it("treats wildcards typed by the user as literal characters", () => {
    const db = seeded();
    expect(listAlbums(db, "%")).toHaveLength(0);
    expect(listAlbums(db, "_")).toHaveLength(0);
    expect(listAlbums(db, "%ommeke%")).toHaveLength(0);
  });

  it("finds an isbn whether or not you type the hyphens", () => {
    const db = seeded();
    expect(listAlbums(db, "9789002123450")).toHaveLength(1);
    expect(listAlbums(db, "978-90-02-12345-0")).toHaveLength(1);
  });

  it("returns everything for an empty query", () => {
    expect(listAlbums(seeded(), "")).toHaveLength(3);
  });
});
