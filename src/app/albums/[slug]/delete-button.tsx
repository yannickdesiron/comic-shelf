"use client";

import { useTransition } from "react";

type Props = { title: string; onDelete: () => Promise<void> };

export function DeleteButton({ title, onDelete }: Props) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (window.confirm(`"${title}" verwijderen? Dit kan niet ongedaan worden gemaakt.`)) {
          start(() => onDelete());
        }
      }}
      className="rounded-md border border-line px-3 py-1.5 text-sm text-muted hover:border-accent hover:text-accent disabled:opacity-50"
    >
      {pending ? "Verwijderen…" : "Verwijderen"}
    </button>
  );
}
