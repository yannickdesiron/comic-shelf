import Link from "next/link";
import { notFound } from "next/navigation";

import { getDb } from "@/db/client";
import { getAlbum } from "@/lib/albums";

import { updateAlbumAction } from "../../actions";
import { AlbumForm } from "../../album-form";

export const metadata = { title: "Album bewerken · Comic Shelf" };

export default async function EditAlbumPage({ params }: PageProps<"/albums/[slug]/edit">) {
  const { slug } = await params;
  const detail = getAlbum(getDb(), slug);
  if (!detail) notFound();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <p className="text-sm text-muted">
          <Link href={`/albums/${slug}`} className="hover:underline">
            ← {detail.album.title}
          </Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Album bewerken</h1>
      </div>
      <AlbumForm action={updateAlbumAction.bind(null, slug)} album={detail} submitLabel="Wijzigingen opslaan" />
    </div>
  );
}
