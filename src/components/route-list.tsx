"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface RouteListItem {
  id: string;
  name: string;
  originName: string;
  destinationName: string;
  viaName: string | null;
  lines: { id: string; operator: string; name: string }[];
}

export function RouteList({ routes }: { routes: RouteListItem[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {routes.map((route) => (
        <li key={route.id}>
          <RouteCard route={route} />
        </li>
      ))}
    </ul>
  );
}

function RouteCard({ route }: { route: RouteListItem }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"open" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * 経路URLは押されたときに作る。
   *
   * **`window.open` を先に開いておく。** 生成を待ってから開くと、ユーザー操作から
   * 離れた非同期処理での `open` になり、ブラウザにポップアップとして塞がれる。
   */
  async function openCourse() {
    setBusy("open");
    setError(null);
    const tab = window.open("", "_blank", "noopener,noreferrer");

    try {
      const res = await fetch(`/api/routes/${route.id}/course-url`);
      const body = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !body.url) {
        tab?.close();
        setError(body.error ?? "経路URLを取得できませんでした");
        return;
      }
      if (tab) tab.location.href = body.url;
      else window.location.href = body.url;
    } catch {
      tab?.close();
      setError("経路URLを取得できませんでした");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!window.confirm(`「${route.name}」を削除します。よろしいですか？`)) return;

    setBusy("delete");
    setError(null);
    try {
      const res = await fetch(`/api/routes/${route.id}`, { method: "DELETE" });
      if (!res.ok) {
        setError("削除できませんでした");
        return;
      }
      router.refresh();
    } catch {
      setError("削除できませんでした");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{route.name}</p>
          <p className="mt-1 text-sm text-muted">
            {route.originName}
            {route.viaName ? ` → ${route.viaName}` : ""} → {route.destinationName}
          </p>
        </div>
        <button
          type="button"
          onClick={remove}
          disabled={busy !== null}
          className="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-muted hover:text-foreground disabled:opacity-50"
        >
          削除
        </button>
      </div>

      {route.lines.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {route.lines.map((line) => (
            <li
              key={line.id}
              className="rounded border border-border px-2 py-0.5 text-xs text-muted"
            >
              {line.operator} {line.name}
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={openCourse}
        disabled={busy !== null}
        className="mt-4 w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {busy === "open" ? "経路を取得中…" : "駅すぱあとで経路を見る"}
      </button>

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </div>
  );
}
