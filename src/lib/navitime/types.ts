/**
 * 経路探索（NAVITIME）の入出力の型。
 *
 * 出力の形は呼び出し元（DaySpan の `src/services/trainroute/client.ts`）と合わせてある。
 * **項目を減らす・名前を変えるときは向こうも同時に直す。** 向こうは形の合わない項目を
 * 黙って落とし、必須（`minutes` / `departAt` / `arriveAt`）が欠けた行だけを捨てる作りなので、
 * 壊したことが画面にエラーとして出ず、所要時間がAIの見積もりへ静かに戻る。
 */

/** 経路探索の条件。座標で受けるのは、トータルナビが最寄り駅までの徒歩を含めて探索するため。 */
export interface TransitSearchQuery {
  start: { lat: number; lon: number };
  goal: { lat: number; lon: number };
  /** 到着時刻。`startTime` とは排他。 */
  goalTime?: Date | null;
  /** 出発時刻。どちらも無ければ「いま出発」。 */
  startTime?: Date | null;
  limit: number;
}

/** 探索結果の1本。 */
export interface TransitRouteSummary {
  /** 総所要時間（分）。徒歩区間を含む。 */
  minutes: number;
  /** ISO 8601。 */
  departAt: string;
  arriveAt: string;
  transitCount: number;
  /** 徒歩の合計（分）。渡した座標がずれていないかを読む手掛かりとして出す。 */
  walkMinutes: number;
  /** 利用する路線名。並び順は乗車順。 */
  lines: string[];
  /** 実際に乗り降りする駅。想定と違う駅が選ばれたときに気付くために持つ。 */
  boardStation: string | null;
  alightStation: string | null;
  /** 運賃。読めなければ null。 */
  fare: { ticket: number; ic: number | null } | null;
}

/** 提供元の明示。呼び出し元はこの中身をそのまま画面へ出す（提供元が変わっても向こうを直さない）。 */
export interface TransitAttribution {
  provider: string;
  termsUrl: string | null;
}
