import { beforeEach, describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import { createDb, type Db } from "@/db/client";
import { createAlbum, listAlbums, newAlbumSchema } from "./albums";
import { buildTemplate, importAlbums, markDuplicates, parseSpreadsheet, validateRows } from "./import";

function xlsxBuffer(rows: unknown[][]): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Blad1");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

const header = ["Reeks", "Nummer", "Titel", "Uitgever", "Jaar", "ISBN", "Taal", "Uitvoering", "Gelezen", "Locatie"];
const texas = ["Suske en Wiske", 67, "De Texasrakkers", "Standaard Uitgeverij", 1966, "978-90-02-25466-6", "Nederlands", "Softcover", "Ja", "Plank 1"];
const teken = ["Blake en Mortimer", 6, "Het Gele Teken", "Lombard", 1956, "", "nl", "HC", "Bezig", ""];

describe("parseSpreadsheet", () => {
  it("reads an xlsx with Dutch headers and numeric cells", () => {
    const sheet = parseSpreadsheet(xlsxBuffer([header, texas, teken]));
    expect(sheet.fields).toEqual(["seriesTitle", "number", "title", "publisher", "year", "isbn", "language", "format", "readStatus", "location"]);
    expect(sheet.unknownHeaders).toEqual([]);
    expect(sheet.rows).toHaveLength(2);
    expect(sheet.rows[0]).toEqual({
      row: 2,
      values: { seriesTitle: "Suske en Wiske", number: "67", title: "De Texasrakkers", publisher: "Standaard Uitgeverij", year: "1966", isbn: "978-90-02-25466-6", language: "Nederlands", format: "Softcover", readStatus: "Ja", location: "Plank 1" },
    });
  });

  it("accepts English and loosely spelled headers, reports unknown ones", () => {
    const sheet = parseSpreadsheet(xlsxBuffer([["Series", " TITLE ", "Nr", "Prijs"], ["Kuifje", "De Blauwe Lotus", "", "12"]]));
    expect(sheet.fields).toEqual(["seriesTitle", "title", "number"]);
    expect(sheet.unknownHeaders).toEqual(["Prijs"]);
  });

  it("maps the In bezit column", () => {
    const rows = validateRows(parseSpreadsheet("Reeks,Titel,In bezit\nNero,Matsuoka,nee\nNero,Toto,ja\n").rows);
    expect(rows.map((r) => r.ok && r.data.owned)).toEqual(["no", "yes"]);
  });

  it("reads a csv string", () => {
    const sheet = parseSpreadsheet("Reeks,Titel,Nummer\nJommeke,De Jacht op een Voetbal,1\n");
    expect(sheet.rows).toEqual([{ row: 2, values: { seriesTitle: "Jommeke", title: "De Jacht op een Voetbal", number: "1" } }]);
  });

  it("reads tab separated text as pasted from Excel and skips empty rows", () => {
    const sheet = parseSpreadsheet("Reeks\tTitel\nJommeke\tDe Jacht op een Voetbal\n\t\nKiekeboe\tDe Wollebollen\n");
    expect(sheet.rows.map((r) => [r.row, r.values.title])).toEqual([[2, "De Jacht op een Voetbal"], [4, "De Wollebollen"]]);
  });

  it("handles an empty input", () => {
    expect(parseSpreadsheet("")).toEqual({ fields: [], unknownHeaders: [], rows: [] });
  });
});

describe("validateRows", () => {
  it("maps human words to enum codes", () => {
    const [a, b] = validateRows(parseSpreadsheet(xlsxBuffer([header, texas, teken])).rows);
    expect(a.ok && a.data).toMatchObject({ language: "nl", format: "softcover", readStatus: "read", isbn: "9789002254666", number: 67, year: 1966 });
    expect(b.ok && b.data).toMatchObject({ language: "nl", format: "hardcover", readStatus: "reading", isbn: null, location: null });
  });

  it("reports schema errors and unknown enum words per row", () => {
    const rows = parseSpreadsheet("Reeks,Titel,ISBN,Taal\n,Zonder reeks,123,Klingon\n").rows;
    const [r] = validateRows(rows);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.row).toBe(2);
      expect(r.errors).toEqual(
        expect.arrayContaining([
          { field: "language", message: 'Onbekende waarde "Klingon"' },
          { field: "seriesTitle", message: "Reeks is verplicht" },
          { field: "isbn", message: "Ongeldig ISBN" },
        ]),
      );
    }
  });
});

describe("importAlbums", () => {
  let db: Db;
  beforeEach(() => {
    db = createDb(":memory:");
  });

  const valid = () =>
    validateRows(parseSpreadsheet(xlsxBuffer([header, texas, teken, texas])).rows).flatMap((r) => (r.ok ? [r.data] : []));

  it("creates albums and skips duplicates within the file", () => {
    expect(importAlbums(db, valid())).toEqual({ created: 2, skipped: 1 });
    expect(listAlbums(db).map((a) => a.title).sort()).toEqual(["De Texasrakkers", "Het Gele Teken"]);
  });

  it("skips albums that are already on the shelf", () => {
    createAlbum(db, newAlbumSchema.parse({ seriesTitle: "suske en wiske", title: "De Texasrakkers", number: "67" }));
    expect(importAlbums(db, valid())).toEqual({ created: 1, skipped: 2 });
  });

  it("treats the same title with another number as a different album", () => {
    const rows = valid();
    const { fresh, duplicates } = markDuplicates([...rows, { ...rows[0], number: 125 }], new Set());
    expect(fresh).toHaveLength(3);
    expect(duplicates).toHaveLength(1);
  });
});

describe("buildTemplate", () => {
  it("produces an xlsx whose headers parse back to every field", () => {
    const sheet = parseSpreadsheet(buildTemplate());
    expect(sheet.fields).toHaveLength(13);
    expect(sheet.unknownHeaders).toEqual([]);
    const [row] = validateRows(sheet.rows);
    expect(row.ok).toBe(true);
  });
});
