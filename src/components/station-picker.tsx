"use client";

import { useEffect, useRef, useState } from "react";

import type { StationHit, StationRef } from "@/lib/ekispert/types";

/** 打鍵のたびに駅すぱあとを叩かないための待ち時間。 */
const DEBOUNCE_MS = 300;

interface Props {
  label: string;
  value: StationRef | null;
  onChange: (station: StationRef | null) => void;
  /** 省略可能な項目（経由駅）であることを示す。 */
  optional?: boolean;
}

export function StationPicker({ label, value, onChange, optional }: Props) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<StationHit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 入力が速いと応答の到着順が入れ替わるため、最後のリクエスト以外は捨てる。
  const latestQuery = useRef("");

  useEffect(() => {
    const trimmed = query.trim();
    latestQuery.current = trimmed;

    // 空のときは何もしない。ここで setState すると効果の同期実行になり、
    // 連鎖レンダリングを招く（react-hooks/set-state-in-effect）。表示は下で出し分ける。
    if (!trimmed) return;

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/stations?name=${encodeURIComponent(trimmed)}`);
        const body = (await res.json()) as { stations?: StationHit[]; error?: string };
        if (latestQuery.current !== trimmed) return;

        if (!res.ok) {
          setError(body.error ?? "駅を検索できませんでした");
          setHits([]);
          return;
        }
        setError(null);
        setHits(body.stations ?? []);
      } catch {
        if (latestQuery.current === trimmed) {
          setError("駅を検索できませんでした");
          setHits([]);
        }
      } finally {
        if (latestQuery.current === trimmed) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  // 入力が空になったら、前回の候補・エラーは出さない（状態は消さずに表示だけ落とす）。
  const active = query.trim() !== "";
  const visibleHits = active ? hits : [];

  if (value) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">{label}</span>
        <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2">
          <span className="truncate text-sm">{value.name}</span>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setQuery("");
            }}
            className="shrink-0 text-xs text-muted hover:text-foreground"
          >
            変更
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted">
        {label}
        {optional && <span className="ml-1 font-normal">（任意）</span>}
      </span>
      <input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="駅名を入力"
        className="rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
      />

      {active && loading && <p className="text-xs text-muted">検索中…</p>}
      {active && error && <p className="text-xs text-red-500">{error}</p>}

      {visibleHits.length > 0 && (
        <ul className="max-h-56 overflow-y-auto rounded-md border border-border bg-surface">
          {visibleHits.map((hit) => (
            <li key={hit.code}>
              <button
                type="button"
                onClick={() => {
                  onChange({ code: hit.code, name: hit.name });
                  setHits([]);
                  setQuery("");
                }}
                className="flex w-full items-baseline gap-2 px-3 py-2 text-left text-sm hover:bg-background"
              >
                <span>{hit.name}</span>
                {/* 同名駅を見分けられるよう都道府県を添える。 */}
                {hit.prefecture && <span className="text-xs text-muted">{hit.prefecture}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
