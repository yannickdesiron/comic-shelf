"use client";

import { useOptimistic, useTransition } from "react";

import { setReadStatusAction } from "@/app/albums/actions";
import type { ReadStatus } from "@/lib/albums";

export const READ_LABELS: Record<ReadStatus, string> = {
  unread: "Nog niet gelezen",
  reading: "Bezig",
  read: "Gelezen",
};

const ORDER: ReadStatus[] = ["unread", "reading", "read"];

type Props = { slug: string; status: ReadStatus; variant: "chip" | "segmented" };

/**
 * Chip: one small button that cycles unread → reading → read, for the shelf.
 * Segmented: three explicit buttons, for the detail page.
 * Both update optimistically and call the same server action.
 */
export function ReadStatusControl({ slug, status, variant }: Props) {
  const [optimistic, setOptimistic] = useOptimistic(status);
  const [pending, start] = useTransition();

  const change = (next: ReadStatus) =>
    start(async () => {
      setOptimistic(next);
      await setReadStatusAction(slug, next);
    });

  if (variant === "chip") {
    const next = ORDER[(ORDER.indexOf(optimistic) + 1) % ORDER.length];
    return (
      <button
        type="button"
        onClick={() => change(next)}
        disabled={pending}
        title={`Nu: ${READ_LABELS[optimistic]}. Klik voor: ${READ_LABELS[next]}`}
        aria-label={`Leesstatus: ${READ_LABELS[optimistic]}`}
        className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-[11px] leading-none transition ${chipTone(optimistic)} disabled:opacity-60`}
      >
        {optimistic === "read" ? "✓" : optimistic === "reading" ? "…" : ""}
      </button>
    );
  }

  return (
    <div role="group" aria-label="Leesstatus" className="inline-flex overflow-hidden rounded-md border border-line text-sm">
      {ORDER.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => change(s)}
          disabled={pending}
          aria-pressed={optimistic === s}
          className={`px-3 py-1.5 transition ${
            optimistic === s ? "bg-accent text-white" : "bg-card text-muted hover:text-ink"
          } disabled:opacity-60`}
        >
          {READ_LABELS[s]}
        </button>
      ))}
    </div>
  );
}

function chipTone(s: ReadStatus) {
  if (s === "read") return "border-green-700 bg-green-700 text-white dark:border-green-500 dark:bg-green-500";
  if (s === "reading") return "border-accent text-accent bg-card";
  return "border-line bg-card text-transparent hover:border-muted";
}
