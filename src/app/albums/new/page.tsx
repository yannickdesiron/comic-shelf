import { AlbumForm } from "./album-form";

export const metadata = { title: "Album toevoegen · Comic Shelf" };

export default function NewAlbumPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Album toevoegen</h1>
        <p className="text-sm text-muted">Bestaat de reeks al, dan wordt het album eraan gekoppeld.</p>
      </div>
      <AlbumForm />
    </div>
  );
}
