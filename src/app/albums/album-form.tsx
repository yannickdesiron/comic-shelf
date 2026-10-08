"use client";

import { useActionState } from "react";

import { Cover } from "@/components/cover";
import type { AlbumDetail } from "@/lib/albums";

import type { FormState } from "./actions";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  album?: AlbumDetail;
  submitLabel: string;
};

const initial: FormState = { errors: {}, values: {} };

/** Add and edit share this form; `album` prefills it for editing. */
export function AlbumForm({ action, album, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, initial);
  const v = { ...(album ? toValues(album) : {}), ...state.values };
  const e = state.errors;

  return (
    <form action={formAction} className="grid gap-5 sm:grid-cols-2">
      <Field label="Reeks" name="seriesTitle" error={e.seriesTitle} required defaultValue={v.seriesTitle} placeholder="Suske en Wiske" />
      <Field label="Nummer" name="number" error={e.number} type="number" min={0} defaultValue={v.number} />
      <Field label="Titel" name="title" error={e.title} required defaultValue={v.title} placeholder="De Texasrakkers" className="sm:col-span-2" />
      <Field label="Uitgever" name="publisher" error={e.publisher} defaultValue={v.publisher} />
      <Field label="Jaar" name="year" error={e.year} type="number" min={1900} defaultValue={v.year} />
      <Field label="ISBN" name="isbn" error={e.isbn} defaultValue={v.isbn} placeholder="978-90-02-..." hint="ISBN-10 of ISBN-13, met of zonder streepjes" />

      <Select label="Taal" name="language" defaultValue={v.language ?? "nl"} options={[["nl", "Nederlands"], ["fr", "Frans"], ["en", "Engels"]]} />
      <Select label="Uitvoering" name="format" defaultValue={v.format ?? "softcover"} options={[["softcover", "Softcover"], ["hardcover", "Hardcover"], ["digital", "Digitaal"]]} />
      <Select label="Exemplaar" name="kind" defaultValue={v.kind ?? "physical"} options={[["physical", "Fysiek"], ["digital", "Digitaal"]]} />
      <Select label="Gelezen" name="readStatus" defaultValue={v.readStatus ?? "unread"} options={[["unread", "Nog niet"], ["reading", "Bezig"], ["read", "Gelezen"]]} />

      <Field label="Locatie" name="location" error={e.location} defaultValue={v.location} placeholder="Kast woonkamer, plank 2" />
      <Field label="Notities" name="notes" error={e.notes} defaultValue={v.notes} />

      <div className="flex gap-4 sm:col-span-2">
        {album?.edition.coverFile && (
          <div className="w-24 shrink-0">
            <Cover
              coverFile={album.edition.coverFile}
              title={album.album.title}
              seriesTitle={album.series.title}
              number={album.album.number}
            />
          </div>
        )}
        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span className="font-medium">{album?.edition.coverFile ? "Cover vervangen" : "Cover"}</span>
          <input type="file" name="cover" accept="image/jpeg,image/png,image/webp" className="text-sm text-muted" />
          <Hint text="JPG, PNG of WebP, maximaal 5 MB" error={e.cover} />
        </label>
      </div>

      {e.form && <p className="text-sm text-accent sm:col-span-2">{e.form}</p>}

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Opslaan…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

function toValues({ album, series, edition, copy }: AlbumDetail): Record<string, string> {
  return {
    seriesTitle: series.title,
    title: album.title,
    number: album.number?.toString() ?? "",
    publisher: edition.publisher ?? "",
    year: edition.year?.toString() ?? "",
    isbn: edition.isbn ?? "",
    language: edition.language,
    format: edition.format,
    kind: copy?.kind ?? "physical",
    readStatus: copy?.readStatus ?? "unread",
    location: copy?.location ?? "",
    notes: copy?.notes ?? "",
  };
}

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
  error?: string;
  hint?: string;
};

function Field({ label, name, error, hint, className = "", ...rest }: FieldProps) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${className}`}>
      <span className="font-medium">
        {label}
        {rest.required && <span className="text-accent"> *</span>}
      </span>
      <input
        name={name}
        aria-invalid={Boolean(error)}
        className="rounded-md border border-line bg-card px-3 py-2 outline-none focus:border-accent aria-[invalid=true]:border-accent"
        {...rest}
      />
      <Hint text={hint} error={error} />
    </label>
  );
}

function Select({ label, name, defaultValue, options }: { label: string; name: string; defaultValue: string; options: [string, string][] }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <select name={name} defaultValue={defaultValue} className="rounded-md border border-line bg-card px-3 py-2 outline-none focus:border-accent">
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

function Hint({ text, error }: { text?: string; error?: string }) {
  if (error) return <span className="text-xs text-accent">{error}</span>;
  if (text) return <span className="text-xs text-muted">{text}</span>;
  return null;
}
