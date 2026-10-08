import Link from "next/link";

import { Cover } from "@/components/cover";
import { getDb } from "@/db/client";
import { listAlbums } from "@/lib/albums";

export default async function ShelfPage({ searchParams }: PageProps<"/">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q : "";
  const shelf = listAlbums(getDb(), query);

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
        <button
          type="submit"
          className="rounded-md border border-line px-3 py-2 text-sm hover:bg-card"
        >
          Zoek
        </button>
      </form>

      <p className="text-sm text-muted">
        {shelf.length} {shelf.length === 1 ? "album" : "albums"}
        {query && (
          <>
            {" "}
            voor <span className="text-ink">“{query}”</span> ·{" "}
            <Link href="/" className="underline">
              wis filter
            </Link>
          </>
        )}
      </p>

      {shelf.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line p-12 text-center text-sm text-muted">
          {query ? (
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
            <li key={album.id}>
              <Link
                href={`/albums/${album.slug}`}
                className="group flex flex-col gap-2"
              >
                <Cover
                  coverFile={album.coverFile}
                  title={album.title}
                  seriesTitle={album.seriesTitle}
                  number={album.number}
                />
                <div className="min-w-0">
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
