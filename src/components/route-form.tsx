"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { LinePicker, type SelectedLine } from "@/components/line-picker";
import { StationPicker } from "@/components/station-picker";
import type { StationRef } from "@/lib/ekispert/types";

export function RouteForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [origin, setOrigin] = useState<StationRef | null>(null);
  const [destination, setDestination] = useState<StationRef | null>(null);
  const [via, setVia] = useState<StationRef | null>(null);
  const [lines, setLines] = useState<SelectedLine[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim() !== "" && origin !== null && destination !== null && !submitting;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/routes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), origin, destination, via, lines }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "保存できませんでした");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("保存できませんでした");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">名前</span>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="通勤"
          maxLength={100}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </label>

      <StationPicker label="出発駅" value={origin} onChange={setOrigin} />
      <StationPicker label="経由駅" value={via} onChange={setVia} optional />
      <StationPicker label="到着駅" value={destination} onChange={setDestination} />

      <LinePicker lines={lines} onChange={setLines} />

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={!canSubmit}
        className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "保存中…" : "保存"}
      </button>
    </form>
  );
}
