import Link from "next/link";

import { ImportForm } from "./import-form";

export const metadata = { title: "Importeren · Comic Shelf" };

export default async function ImportPage({ searchParams }: PageProps<"/import">) {
  const { created, skipped } = await searchParams;
  const done = typeof created === "string" ? Number(created) : null;
  const skippedCount = typeof skipped === "string" ? Number(skipped) : 0;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Albums importeren</h1>
        <p className="text-sm text-muted">
          Eén rij per album. Reeks en Titel zijn verplicht, de rest mag leeg blijven. Je ziet eerst een controle voordat er iets wordt opgeslagen.
        </p>
      </div>

      {done !== null && (
        <div className="rounded-lg border border-line bg-card p-4 text-sm">
          <p className="font-medium">
            {done === 1 ? "1 album toegevoegd" : `${done} albums toegevoegd`}
            {skippedCount > 0 && <span className="text-muted">, {skippedCount} overgeslagen omdat ze al op de plank stonden</span>}
          </p>
          <Link href="/" className="text-accent underline">
            Naar de plank
          </Link>
        </div>
      )}

      <ImportForm />
    </div>
  );
}
