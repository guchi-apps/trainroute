"use client";

import { useEffect, useRef, useState } from "react";

import type { OperationLineHit } from "@/lib/ekispert/types";

const DEBOUNCE_MS = 300;

export interface SelectedLine {
  operator: string;
  code: string | null;
  name: string;
}

/**
 * 経路が使う路線を選ぶ。
 *
 * ここで選んだ路線が、運行情報（遅延）を実装したときに「どこを見るか」の指定になる
 * （`src/lib/transit/index.ts`）。今は表示とAIDEへの受け渡しだけに使う。
 */
export function LinePicker({
  lines,
  onChange,
}: {
  lines: SelectedLine[];
  onChange: (lines: SelectedLine[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<OperationLineHit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const latestQuery = useRef("");

  useEffect(() => {
    const trimmed = query.trim();
    latestQuery.current = trimmed;

    // 空のときは何もしない。ここで setState すると効果の同期実行になり、
    // 連鎖レンダリングを招く（react-hooks/set-state-in-effect）。表示は下で出し分ける。
    if (!trimmed) return;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/lines?name=${encodeURIComponent(trimmed)}`);
        const body = (await res.json()) as { lines?: OperationLineHit[]; error?: string };
        if (latestQuery.current !== trimmed) return;

        if (!res.ok) {
          setError(body.error ?? "路線を検索できませんでした");
          setHits([]);
          return;
        }
        setError(null);
        setHits(body.lines ?? []);
      } catch {
        if (latestQuery.current === trimmed) {
          setError("路線を検索できませんでした");
          setHits([]);
        }
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  function add(hit: OperationLineHit) {
    // 同じ路線コードを二重に持たない。
    if (hit.code && lines.some((line) => line.code === hit.code)) return;
    onChange([...lines, { operator: hit.operator ?? "不明", code: hit.code, name: hit.name }]);
    setHits([]);
    setQuery("");
  }

  // 入力が空になったら、前回の候補・エラーは出さない（状態は消さずに表示だけ落とす）。
  const active = query.trim() !== "";
  const visibleHits = active ? hits : [];

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted">
        使う路線<span className="ml-1 font-normal">（任意）</span>
      </span>

      {lines.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {lines.map((line, index) => (
            <li
              key={`${line.code ?? line.name}-${index}`}
              className="flex items-center gap-1.5 rounded border border-border bg-surface px-2 py-1 text-xs"
            >
              <span>
                {line.operator} {line.name}
              </span>
              <button
                type="button"
                onClick={() => onChange(lines.filter((_, i) => i !== index))}
                className="text-muted hover:text-foreground"
                aria-label={`${line.name} を外す`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="路線名を入力（例: 神戸本線）"
        className="rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
      />

      {active && error && <p className="text-xs text-red-500">{error}</p>}

      {visibleHits.length > 0 && (
        <ul className="max-h-56 overflow-y-auto rounded-md border border-border bg-surface">
          {visibleHits.map((hit) => (
            <li key={hit.code}>
              <button
                type="button"
                onClick={() => add(hit)}
                className="flex w-full items-baseline gap-2 px-3 py-2 text-left text-sm hover:bg-background"
              >
                <span>{hit.name}</span>
                {hit.operator && <span className="text-xs text-muted">{hit.operator}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
