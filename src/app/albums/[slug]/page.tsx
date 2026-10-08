import Link from "next/link";
import { notFound } from "next/navigation";

import { Cover } from "@/components/cover";
import { getDb } from "@/db/client";
import { getAlbum } from "@/lib/albums";

import { deleteAlbumAction } from "../actions";
import { DeleteButton } from "./delete-button";

const LABELS = {
  language: { nl: "Nederlands", fr: "Frans", en: "Engels" },
  format: { softcover: "Softcover", hardcover: "Hardcover", digital: "Digitaal" },
  kind: { physical: "Fysiek", digital: "Digitaal" },
  readStatus: { unread: "Nog niet gelezen", reading: "Bezig", read: "Gelezen" },
} as const;

export async function generateMetadata({ params }: PageProps<"/albums/[slug]">) {
  const { slug } = await params;
  const detail = getAlbum(getDb(), slug);
  return { title: detail ? `${detail.album.title} · Comic Shelf` : "Comic Shelf" };
}

export default async function AlbumPage({ params }: PageProps<"/albums/[slug]">) {
  const { slug } = await params;
  const detail = getAlbum(getDb(), slug);
  if (!detail) notFound();

  const { album, series, edition, copy } = detail;
  const deleteThis = deleteAlbumAction.bind(null, slug);

  return (
    <article className="mx-auto grid w-full max-w-4xl gap-8 sm:grid-cols-[240px_1fr]">
      <div>
        <Cover coverFile={edition.coverFile} title={album.title} seriesTitle={series.title} number={album.number} />
      </div>

      <div className="flex flex-col gap-6">
        <header>
          <p className="text-sm text-muted">
            <Link href={`/?q=${encodeURIComponent(series.title)}`} className="hover:underline">
              {series.title}
            </Link>
            {album.number !== null && <> · nummer {album.number}</>}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">{album.title}</h1>
        </header>

        <section>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-widest text-muted">Editie</h2>
          <Facts
            rows={[
              ["Uitgever", edition.publisher],
              ["Jaar", edition.year],
              ["ISBN", edition.isbn],
              ["Taal", LABELS.language[edition.language]],
              ["Uitvoering", LABELS.format[edition.format]],
            ]}
          />
        </section>

        <section>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-widest text-muted">Mijn exemplaar</h2>
          <Facts
            rows={[
              ["Soort", copy ? LABELS.kind[copy.kind] : null],
              ["Status", copy ? LABELS.readStatus[copy.readStatus] : null],
              ["Locatie", copy?.location],
              ["Notities", copy?.notes],
            ]}
          />
        </section>

        <footer className="flex items-center gap-3 border-t border-line pt-4">
          <Link
            href={`/albums/${slug}/edit`}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            Bewerken
          </Link>
          <DeleteButton title={album.title} onDelete={deleteThis} />
          <Link href="/" className="ml-auto text-sm text-muted hover:underline">
            Terug naar de plank
          </Link>
        </footer>
      </div>
    </article>
  );
}

function Facts({ rows }: { rows: [string, string | number | null | undefined][] }) {
  const filled = rows.filter(([, value]) => value !== null && value !== undefined && value !== "");
  if (filled.length === 0) return <p className="text-sm text-muted">Nog niets ingevuld.</p>;
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 text-sm">
      {filled.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted">{label}</dt>
          <dd className="break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
