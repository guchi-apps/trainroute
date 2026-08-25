/**
 * 運行情報（遅延）の取得元。**現時点では未実装で、常に null を返す。**
 *
 * ## なぜ空のままなのか
 *
 * 当初の計画（guchi-apps/aide#33）は ODPT（公共交通オープンデータセンター）から
 * 運行情報を取る前提だった。しかし対象が関西の事業者だったため成立しない。
 * 2026-08-25 にデータカタログを検索した結果:
 *
 * | 検索語 | ヒット数 |
 * | --- | --- |
 * | 阪急 | 0 |
 * | 近鉄 | 0 |
 * | JR西日本 | 0 |
 * | 関西 | 0 |
 *
 * ODPT は首都圏の事業者が中心で、阪急電鉄・大阪メトロ・JR西日本のいずれも
 * データを提供していない。
 *
 * ## 取りうる選択肢（決まっていない）
 *
 * 1. **各社の公式運行情報ページを解析する。** 阪急は
 *    `https://www.hankyu.co.jp/railinfo/include/page_railinfo.html` が
 *    6KB 程度のサーバーレンダリング済みHTML断片で、神戸線・宝塚線・京都線それぞれの
 *    「平常運転 / 遅延あり / 運転見合わせ」がそのまま入っている。追加費用はかからないが、
 *    **阪急が出すのは20分以上の遅れのみ**で、先方のHTML変更で壊れる
 * 2. **駅すぱあとを上位プランへ変更する。** スタンダードプラン以上の
 *    「鉄道運行情報（レスキューナウ）」なら全国の事業者を正規のAPIで取れる。月額費用が要る
 *
 * ## 実装するときの約束
 *
 * - **取れなかったときに「平常運転」を返さない。** 落ちている・壊れている・未実装は
 *   すべて null（不明）にする。遅れているのに平常と答えるほうが害が大きい
 * - 取得元ごとの実装はこのディレクトリに分けて置き、`fetchServiceStatus` から束ねる
 */

import type { CommuteRouteLine } from "@prisma/client";

/** 路線の状態。取れなかった場合はこの型ではなく null で表す。 */
export type ServiceStatusLevel = "normal" | "delayed" | "suspended";

export interface LineServiceStatus {
  operator: string;
  lineName: string;
  level: ServiceStatusLevel;
  /** 事業者が出している本文（あれば）。 */
  message: string | null;
  /** 取得元が情報を更新した時刻。分からなければ null。 */
  observedAt: string | null;
  /** どこから取ったか（`hankyu-web` など）。利用者に出典を示すために持つ。 */
  source: string;
}

/**
 * 指定した路線の運行情報を取る。
 *
 * @returns 取得元が未実装、または取得に失敗した場合は null。
 *          **null は「平常運転」ではなく「分からない」を意味する。**
 */
export async function fetchServiceStatus(
  _lines: Pick<CommuteRouteLine, "operator" | "lineName">[],
): Promise<LineServiceStatus[] | null> {
  return null;
}
