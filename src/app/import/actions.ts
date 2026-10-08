"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db/client";
import { existingAlbumKeys, importAlbums, markDuplicates, parseSpreadsheet, validateRows, type ParsedSheet } from "@/lib/import";

export type PreviewRow = {
  row: number;
  status: "new" | "duplicate" | "error";
  seriesTitle: string;
  number: string;
  title: string;
  errors: string[];
};

export type ImportState =
  | { step: "upload"; error?: string }
  | {
      step: "preview";
      fileName: string;
      unknownHeaders: string[];
      rows: PreviewRow[];
      counts: { new: number; duplicate: number; error: number };
      /** JSON of the raw rows that will be imported; re-validated on confirm. */
      payload: string;
    };

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export async function previewImportAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const file = formData.get("file");
  const text = formData.get("text");

  let sheet: ParsedSheet;
  let fileName: string;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_FILE_BYTES) return { step: "upload", error: "Bestand is groter dan 10 MB" };
    if (!/\.(xlsx|xls|csv|tsv|txt)$/i.test(file.name)) return { step: "upload", error: "Kies een .xlsx of .csv bestand" };
    sheet = parseSpreadsheet(Buffer.from(await file.arrayBuffer()));
    fileName = file.name;
  } else if (typeof text === "string" && text.trim() !== "") {
    sheet = parseSpreadsheet(text);
    fileName = "geplakte rijen";
  } else {
    return { step: "upload", error: "Kies een bestand of plak rijen uit Excel" };
  }

  if (sheet.rows.length === 0) {
    return { step: "upload", error: sheet.fields.length === 0 ? "Geen herkenbare kolomkoppen gevonden. Download het sjabloon voor het juiste formaat." : "Geen rijen onder de kolomkoppen" };
  }
  if (!sheet.fields.includes("seriesTitle") || !sheet.fields.includes("title")) {
    return { step: "upload", error: "De kolommen Reeks en Titel zijn verplicht" };
  }

  const validated = validateRows(sheet.rows);
  const valid = validated.flatMap((r) => (r.ok ? [r.data] : []));
  const { duplicates } = markDuplicates(valid, existingAlbumKeys(getDb()));
  const duplicateSet = new Set(duplicates);

  const rows: PreviewRow[] = validated.map((r) => {
    const raw = sheet.rows.find((s) => s.row === r.row)?.values ?? {};
    const base = { row: r.row, seriesTitle: raw.seriesTitle ?? "", number: raw.number ?? "", title: raw.title ?? "" };
    if (!r.ok) return { ...base, status: "error", errors: r.errors.map((e) => `${labelFor(e.field)}: ${e.message}`) };
    if (duplicateSet.has(r.data)) return { ...base, status: "duplicate", errors: [] };
    return { ...base, status: "new", errors: [] };
  });

  const newRowNumbers = new Set(rows.filter((r) => r.status === "new").map((r) => r.row));
  const payload = JSON.stringify(sheet.rows.filter((r) => newRowNumbers.has(r.row)));

  return {
    step: "preview",
    fileName,
    unknownHeaders: sheet.unknownHeaders,
    rows,
    counts: {
      new: newRowNumbers.size,
      duplicate: rows.filter((r) => r.status === "duplicate").length,
      error: rows.filter((r) => r.status === "error").length,
    },
    payload,
  };
}

export async function confirmImportAction(formData: FormData): Promise<void> {
  const payload = formData.get("payload");
  if (typeof payload !== "string") redirect("/import");

  let rows: ParsedSheet["rows"];
  try {
    rows = JSON.parse(payload);
  } catch {
    redirect("/import");
  }

  const valid = validateRows(rows).flatMap((r) => (r.ok ? [r.data] : []));
  const result = importAlbums(getDb(), valid);

  revalidatePath("/");
  redirect(`/import?created=${result.created}&skipped=${result.skipped}`);
}

const FIELD_LABELS: Record<string, string> = {
  seriesTitle: "Reeks",
  number: "Nummer",
  title: "Titel",
  publisher: "Uitgever",
  year: "Jaar",
  isbn: "ISBN",
  language: "Taal",
  format: "Uitvoering",
  kind: "Soort",
  readStatus: "Gelezen",
  location: "Locatie",
  notes: "Notities",
};
const labelFor = (field: string) => FIELD_LABELS[field] ?? field;
