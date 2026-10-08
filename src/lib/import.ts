import { eq } from "drizzle-orm";
import * as XLSX from "xlsx";

import type { Db } from "@/db/client";
import { albums, series } from "@/db/schema";
import { createAlbum, newAlbumSchema, type NewAlbum, type NewAlbumInput } from "@/lib/albums";
import { slugify } from "@/lib/slug";

/**
 * Spreadsheet import: one row per album. Headers are matched loosely
 * (case, whitespace and a few Dutch/English aliases), enum values are
 * mapped from human words ("Gelezen", "hardcover", "Frans") to our codes.
 */

type Field = keyof NewAlbumInput;

export const COLUMNS: { field: Field; label: string; aliases: string[]; example: string }[] = [
  { field: "seriesTitle", label: "Reeks", aliases: ["reeks", "serie", "series"], example: "Suske en Wiske" },
  { field: "number", label: "Nummer", aliases: ["nummer", "nr", "no", "number", "#"], example: "67" },
  { field: "title", label: "Titel", aliases: ["titel", "title", "album"], example: "De Texasrakkers" },
  { field: "publisher", label: "Uitgever", aliases: ["uitgever", "uitgeverij", "publisher"], example: "Standaard Uitgeverij" },
  { field: "year", label: "Jaar", aliases: ["jaar", "year", "jaartal"], example: "1966" },
  { field: "isbn", label: "ISBN", aliases: ["isbn", "ean", "barcode"], example: "" },
  { field: "language", label: "Taal", aliases: ["taal", "language", "lang"], example: "Nederlands" },
  { field: "format", label: "Uitvoering", aliases: ["uitvoering", "format", "band", "binding"], example: "Softcover" },
  { field: "kind", label: "Soort", aliases: ["soort", "kind", "type", "exemplaar"], example: "Fysiek" },
  { field: "owned", label: "In bezit", aliases: ["in bezit", "bezit", "owned", "eigendom", "heb ik"], example: "Ja" },
  { field: "readStatus", label: "Gelezen", aliases: ["gelezen", "leesstatus", "status", "read"], example: "Ja" },
  { field: "location", label: "Locatie", aliases: ["locatie", "location", "plaats", "kast"], example: "Kast woonkamer, plank 1" },
  { field: "notes", label: "Notities", aliases: ["notities", "notes", "opmerkingen", "opmerking"], example: "" },
];

const ENUM_WORDS: Partial<Record<Field, Record<string, string>>> = {
  language: { nl: "nl", nederlands: "nl", dutch: "nl", fr: "fr", frans: "fr", français: "fr", francais: "fr", french: "fr", en: "en", engels: "en", english: "en" },
  format: { softcover: "softcover", sc: "softcover", zacht: "softcover", zachte: "softcover", paperback: "softcover", hardcover: "hardcover", hc: "hardcover", hard: "hardcover", harde: "hardcover", digitaal: "digital", digital: "digital", pdf: "digital" },
  kind: { fysiek: "physical", physical: "physical", papier: "physical", boek: "physical", digitaal: "digital", digital: "digital" },
  owned: { ja: "yes", yes: "yes", x: "yes", "in bezit": "yes", bezit: "yes", owned: "yes", nee: "no", no: "no", gezocht: "no", wanted: "no", "niet in bezit": "no" },
  readStatus: { gelezen: "read", read: "read", ja: "read", yes: "read", x: "read", bezig: "reading", reading: "reading", "nog niet": "unread", "niet gelezen": "unread", unread: "unread", nee: "unread", no: "unread" },
};

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

function fieldForHeader(header: string): Field | null {
  const h = normalize(header);
  return COLUMNS.find((c) => c.aliases.includes(h) || normalize(c.label) === h)?.field ?? null;
}

export type ParsedSheet = {
  /** Fields found, in sheet order. */
  fields: Field[];
  /** Headers we could not map. */
  unknownHeaders: string[];
  /** One record per non-empty data row; `row` is the 1-based sheet row. */
  rows: { row: number; values: Partial<Record<Field, string>> }[];
};

/** Reads an .xlsx/.csv buffer, or pasted text (tab or comma separated). */
export function parseSpreadsheet(input: Buffer | string): ParsedSheet {
  const workbook =
    typeof input === "string"
      ? XLSX.read(input, { type: "string", raw: true })
      : XLSX.read(input, { type: "buffer", raw: true, cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return { fields: [], unknownHeaders: [], rows: [] };

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false, blankrows: true });
  if (matrix.length === 0) return { fields: [], unknownHeaders: [], rows: [] };

  const headerRow = matrix[0].map((h) => String(h ?? ""));
  const mapping = headerRow.map(fieldForHeader);
  const fields = mapping.filter((f): f is Field => f !== null);
  const unknownHeaders = headerRow.filter((h, i) => mapping[i] === null && h.trim() !== "");

  const rows: ParsedSheet["rows"] = [];
  matrix.slice(1).forEach((cells, i) => {
    const values: Partial<Record<Field, string>> = {};
    let empty = true;
    mapping.forEach((field, col) => {
      if (!field) return;
      const text = String(cells[col] ?? "").trim();
      if (text !== "") empty = false;
      values[field] = text;
    });
    if (!empty) rows.push({ row: i + 2, values });
  });

  return { fields, unknownHeaders, rows };
}

export type ValidatedRow =
  | { row: number; ok: true; data: NewAlbum }
  | { row: number; ok: false; values: Partial<Record<Field, string>>; errors: { field: string; message: string }[] };

/** Maps human enum words to codes, then runs the album schema per row. */
export function validateRows(rows: ParsedSheet["rows"]): ValidatedRow[] {
  return rows.map(({ row, values }) => {
    const input: Record<string, string> = {};
    const errors: { field: string; message: string }[] = [];

    for (const [field, raw] of Object.entries(values) as [Field, string][]) {
      const words = ENUM_WORDS[field];
      if (!words) {
        input[field] = raw;
        continue;
      }
      if (raw === "") continue; // let the schema default apply
      const code = words[normalize(raw)];
      if (code) input[field] = code;
      else errors.push({ field, message: `Onbekende waarde "${raw}"` });
    }

    const parsed = newAlbumSchema.safeParse(input);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push({ field: String(issue.path[0] ?? "row"), message: issue.message });
      }
    }
    if (errors.length > 0 || !parsed.success) return { row, ok: false, values, errors };
    return { row, ok: true, data: parsed.data };
  });
}

const dupKey = (seriesTitle: string, number: number | null, title: string) =>
  `${slugify(seriesTitle)}|${number ?? ""}|${slugify(title)}`;

/** Keys of albums already on the shelf: series + number + title. */
export function existingAlbumKeys(db: Db): Set<string> {
  const rows = db
    .select({ seriesTitle: series.title, number: albums.number, title: albums.title })
    .from(albums)
    .innerJoin(series, eq(series.id, albums.seriesId))
    .all();
  return new Set(rows.map((r) => dupKey(r.seriesTitle, r.number, r.title)));
}

/** Splits valid rows into new ones and duplicates (of the shelf or of each other). */
export function markDuplicates(rows: NewAlbum[], existing: Set<string>): { fresh: NewAlbum[]; duplicates: NewAlbum[] } {
  const seen = new Set(existing);
  const fresh: NewAlbum[] = [];
  const duplicates: NewAlbum[] = [];
  for (const row of rows) {
    const key = dupKey(row.seriesTitle, row.number, row.title);
    if (seen.has(key)) duplicates.push(row);
    else {
      seen.add(key);
      fresh.push(row);
    }
  }
  return { fresh, duplicates };
}

/** Imports rows in one transaction, skipping duplicates. */
export function importAlbums(db: Db, rows: NewAlbum[]): { created: number; skipped: number } {
  return db.transaction((tx) => {
    const { fresh, duplicates } = markDuplicates(rows, existingAlbumKeys(tx as unknown as Db));
    for (const row of fresh) createAlbum(tx as unknown as Db, row);
    return { created: fresh.length, skipped: duplicates.length };
  });
}

/** An .xlsx with the expected headers and one example row. */
export function buildTemplate(): Buffer {
  const sheet = XLSX.utils.aoa_to_sheet([COLUMNS.map((c) => c.label), COLUMNS.map((c) => c.example)]);
  sheet["!cols"] = COLUMNS.map((c) => ({ wch: Math.max(12, c.example.length + 2) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Albums");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
