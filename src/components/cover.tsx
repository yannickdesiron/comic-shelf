type Props = {
  coverFile: string | null;
  title: string;
  seriesTitle: string;
  number: number | null;
};

/** Cover image, or a typographic placeholder when none was uploaded. */
export function Cover({ coverFile, title, seriesTitle, number }: Props) {
  if (coverFile) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- local files served by our own route
      <img
        src={`/covers/${encodeURIComponent(coverFile)}`}
        alt={`Cover van ${seriesTitle}${number !== null ? ` ${number}` : ""}: ${title}`}
        className="aspect-[3/4] w-full rounded-md object-cover shadow-sm"
        loading="lazy"
      />
    );
  }
  return (
    <div
      aria-hidden
      className="flex aspect-[3/4] w-full flex-col justify-between rounded-md border border-line bg-card p-3 shadow-sm"
    >
      <span className="text-[10px] uppercase tracking-widest text-muted">{seriesTitle}</span>
      <span className="text-sm font-semibold leading-tight">{title}</span>
      {number !== null && <span className="self-end font-mono text-2xl text-accent">{number}</span>}
    </div>
  );
}
