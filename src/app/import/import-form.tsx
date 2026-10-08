"use client";

import { useActionState } from "react";

import { confirmImportAction, previewImportAction, type ImportState, type PreviewRow } from "./actions";

const initial: ImportState = { step: "upload" };

export function ImportForm() {
  const [state, action, pending] = useActionState(previewImportAction, initial);

  if (state.step === "preview") return <Preview state={state} />;

  return (
    <form action={action} className="flex flex-col gap-6">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Bestand</span>
        <input type="file" name="file" accept=".xlsx,.xls,.csv,.tsv,.txt" className="text-sm text-muted" />
        <span className="text-xs text-muted">
          Excel of CSV, maximaal 10 MB.{" "}
          <a href="/import/template" className="text-accent underline">
            Download het sjabloon
          </a>{" "}
          voor de juiste kolommen.
        </span>
      </label>

      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" />
        of
        <span className="h-px flex-1 bg-line" />
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Plak rijen uit Excel</span>
        <textarea
          name="text"
          rows={6}
          placeholder={"Reeks\tNummer\tTitel\nSuske en Wiske\t67\tDe Texasrakkers"}
          className="rounded-md border border-line bg-card px-3 py-2 font-mono text-xs outline-none focus:border-accent"
        />
        <span className="text-xs text-muted">Selecteer de cellen in Excel, inclusief de kopregel, en plak ze hier.</span>
      </label>

      {state.error && <p className="text-sm text-accent">{state.error}</p>}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Controleren…" : "Controleren"}
        </button>
      </div>
    </form>
  );
}

function Preview({ state }: { state: Extract<ImportState, { step: "preview" }> }) {
  const { counts, rows, unknownHeaders, fileName, payload } = state;
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-line bg-card p-4 text-sm">
        <p className="font-medium">{fileName}</p>
        <p className="text-muted">
          <Count n={counts.new} word="nieuw album" plural="nieuwe albums" /> ·{" "}
          <Count n={counts.duplicate} word="al op de plank" plural="al op de plank" /> ·{" "}
          <Count n={counts.error} word="rij met fouten" plural="rijen met fouten" />
        </p>
        {unknownHeaders.length > 0 && (
          <p className="mt-2 text-xs text-muted">Overgeslagen kolommen: {unknownHeaders.join(", ")}</p>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead className="bg-card text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Rij</th>
              <th className="px-3 py-2 font-medium">Reeks</th>
              <th className="px-3 py-2 font-medium">Nr</th>
              <th className="px-3 py-2 font-medium">Titel</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Row key={r.row} r={r} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        {counts.new > 0 ? (
          <form action={confirmImportAction}>
            <input type="hidden" name="payload" value={payload} />
            <button type="submit" className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90">
              {counts.new === 1 ? "1 album importeren" : `${counts.new} albums importeren`}
            </button>
          </form>
        ) : (
          <p className="text-sm text-muted">Niets te importeren.</p>
        )}
        <a href="/import" className="text-sm text-muted hover:underline">
          Ander bestand kiezen
        </a>
      </div>
    </div>
  );
}

function Row({ r }: { r: PreviewRow }) {
  const tone = r.status === "new" ? "text-ink" : "text-muted";
  return (
    <tr className={`border-t border-line ${tone}`}>
      <td className="px-3 py-2 font-mono text-xs">{r.row}</td>
      <td className="px-3 py-2">{r.seriesTitle}</td>
      <td className="px-3 py-2">{r.number}</td>
      <td className="px-3 py-2">{r.title}</td>
      <td className="px-3 py-2">
        {r.status === "new" && <span className="text-green-700 dark:text-green-400">Nieuw</span>}
        {r.status === "duplicate" && <span>Al op de plank</span>}
        {r.status === "error" && (
          <ul className="text-accent">
            {r.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
      </td>
    </tr>
  );
}

function Count({ n, word, plural }: { n: number; word: string; plural: string }) {
  return (
    <span className={n > 0 ? "text-ink" : ""}>
      {n} {n === 1 ? word : plural}
    </span>
  );
}
