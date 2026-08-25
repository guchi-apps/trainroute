import { callEkispert, readText } from "./client";
import type { CourseUrlQuery } from "./types";

/**
 * 「駅すぱあと for Web」への経路URLを作る。
 *
 * **フリープランは経路の中身（所要時間・運賃・乗換）をJSONで返さない。** 返るのは
 * 検索結果ページのURLだけなので、このアプリは数値を持たず、リンクへ飛ばす形にしている。
 * 所要時間や運賃をアプリ内に出したくなった時点で、上位プランへの変更が必要になる。
 */
export async function generateCourseUrl(query: CourseUrlQuery): Promise<string | null> {
  const json = (await callEkispert("/search/course/light", {
    from: query.from.code,
    to: query.to.code,
    via: query.via?.code,
    date: query.date,
    time: query.time,
    searchType: query.searchType ?? "departure",
  })) as { ResultSet?: { ResourceURI?: unknown } };

  return readText(json.ResultSet?.ResourceURI);
}

/**
 * 日本時間での `YYYYMMDD` / `HHMM`。
 *
 * **VPSのタイムゾーンはUTC。** 何も渡さないと駅すぱあと側の現在時刻で探索されるが、
 * 「いま出発したら」を意図するならこちらでJSTを作って渡すほうが確実。
 */
export function tokyoDateTime(now: Date): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${get("year")}${get("month")}${get("day")}`,
    // hour12:false でも 24 時が返る環境があるため 0 に丸める。
    time: `${(get("hour") === "24" ? "00" : get("hour"))}${get("minute")}`,
  };
}
