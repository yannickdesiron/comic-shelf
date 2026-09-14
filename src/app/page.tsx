import Link from "next/link";

import { Cover } from "@/components/cover";
import { ReadStatusControl } from "@/components/read-status";
import { getDb } from "@/db/client";
import { listAlbums, READ_STATUSES, type ReadStatus, type ShelfFilters } from "@/lib/albums";

const OWNED_OPTIONS: [ShelfFilters["owned"] | undefined, string][] = [
  [undefined, "Alles"],
  ["yes", "In bezit"],
  ["no", "Gezocht"],
];
const READ_OPTIONS: [ReadStatus | undefined, string][] = [
  [undefined, "Alles"],
  ["unread", "Nog niet gelezen"],
  ["reading", "Bezig"],
  ["read", "Gelezen"],
];

export default async function ShelfPage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
  const query = str(params.q);
  const owned = ["yes", "no"].includes(str(params.bezit)) ? (str(params.bezit) as "yes" | "no") : undefined;
  const readStatus = (READ_STATUSES as readonly string[]).includes(str(params.gelezen))
    ? (str(params.gelezen) as ReadStatus)
    : undefined;

  const shelf = listAlbums(getDb(), { q: query, owned, readStatus });
  const hasFilter = query !== "" || owned !== undefined || readStatus !== undefined;

  const href = (patch: { bezit?: string; gelezen?: string }) => {
    const p = new URLSearchParams();
    if (query) p.set("q", query);
    const bezit = "bezit" in patch ? patch.bezit : owned;
    const gelezen = "gelezen" in patch ? patch.gelezen : readStatus;
    if (bezit) p.set("bezit", bezit);
    if (gelezen) p.set("gelezen", gelezen);
    const qs = p.toString();
    return qs ? `/?${qs}` : "/";
  };

  return (
    <div className="flex flex-col gap-6">
      <form role="search" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Zoek op reeks, titel, uitgever of ISBN"
          className="w-full rounded-md border border-line bg-card px-3 py-2 text-sm outline-none focus:border-accent"
        />
        {owned && <input type="hidden" name="bezit" value={owned} />}
        {readStatus && <input type="hidden" name="gelezen" value={readStatus} />}
        <button
          type="submit"
          className="rounded-md border border-line px-3 py-2 text-sm hover:bg-card"
        >
          Zoek
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <Chips label="Bezit" options={OWNED_OPTIONS} current={owned} href={(v) => href({ bezit: v })} />
        <Chips label="Gelezen" options={READ_OPTIONS} current={readStatus} href={(v) => href({ gelezen: v })} />
      </div>

      <p className="text-sm text-muted">
        {shelf.length} {shelf.length === 1 ? "album" : "albums"}
        {query && (
          <>
            {" "}
            voor <span className="text-ink">“{query}”</span>
          </>
        )}
        {hasFilter && (
          <>
            {" "}
            ·{" "}
            <Link href="/" className="underline">
              wis filters
            </Link>
          </>
        )}
      </p>

      {shelf.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line p-12 text-center text-sm text-muted">
          {hasFilter ? (
            "Niets gevonden."
          ) : (
            <>
              Nog geen albums.{" "}
              <Link href="/albums/new" className="text-accent underline">
                Voeg je eerste album toe.
              </Link>
            </>
          )}
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {shelf.map((album) => (
            <li key={album.id} className="relative">
              <Link
                href={`/albums/${album.slug}`}
                className={`group flex flex-col gap-2 ${album.owned ? "" : "opacity-70 hover:opacity-100"}`}
              >
                <div className="relative">
                  <Cover
                    coverFile={album.coverFile}
                    title={album.title}
                    seriesTitle={album.seriesTitle}
                    number={album.number}
                  />
                  {!album.owned && (
                    <span className="absolute left-2 top-2 rounded-full bg-paper/90 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent">
                      Gezocht
                    </span>
                  )}
                </div>
                <div className="min-w-0 pr-8">
                  <p className="truncate text-xs text-muted">
                    {album.seriesTitle}
                    {album.number !== null && ` · ${album.number}`}
                  </p>
                  <p className="truncate text-sm font-medium group-hover:text-accent">
                    {album.title}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {[album.publisher, album.year].filter(Boolean).join(", ")}
                  </p>
                </div>
              </Link>
              <div className="absolute bottom-0 right-0">
                <ReadStatusControl slug={album.slug} status={album.readStatus} variant="chip" />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Chips<T extends string | undefined>({
  label,
  options,
  current,
  href,
}: {
  label: string;
  options: [T, string][];
  current: T;
  href: (value: T) => string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="mr-1 text-xs uppercase tracking-wider text-muted">{label}</span>
      {options.map(([value, text]) => (
        <Link
          key={text}
          href={href(value)}
          aria-current={value === current ? "true" : undefined}
          className={`rounded-full border px-2.5 py-0.5 text-xs transition ${
            value === current ? "border-accent bg-accent text-white" : "border-line bg-card text-muted hover:text-ink"
          }`}
        >
          {text}
        </Link>
      ))}
    </div>
  );
}
