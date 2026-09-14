"use client";

import { useTransition } from "react";

import { setOwnedAction } from "@/app/albums/actions";

export function OwnedButton({ slug, owned }: { slug: string; owned: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => setOwnedAction(slug, !owned))}
      className={
        owned
          ? "rounded-md border border-line px-3 py-1.5 text-sm text-muted hover:border-accent hover:text-accent disabled:opacity-50"
          : "rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      }
    >
      {pending ? "Even wachten…" : owned ? "Markeer als gezocht" : "Markeer als in bezit"}
    </button>
  );
}
