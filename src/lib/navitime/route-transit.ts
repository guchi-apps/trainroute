import { callNavitime } from "./client";
import type { TransitAttribution, TransitRouteSummary, TransitSearchQuery } from "./types";

/**
 * 提供元の明示。RapidAPI経由のNAVITIME利用規約（第5条第3項）が権利表示の除去を禁じているため、
 * 経路を出す画面には提供元が分かる表示を添える。呼び出し元はこの2つをそのまま出す。
 */
export const NAVITIME_ATTRIBUTION: TransitAttribution = {
  provider: "NAVITIME",
  termsUrl: "https://api-sdk.navitime.co.jp/api/specs/description/rapid_tou.html",
};

/**
 * 探索の並び順。**所要時間の短い順に固定する。**
 *
 * どれを使うかは trainroute でも呼び出し元でも決めず、画面で利用者に選ばせる。
 * 既定の `time_optimized` は乗換の少なさなども加味して並べ替えるため、
 * 「上ほど早く着く」という読み方ができない。
 */
const ORDER = "time";

/**
 * 探索の時間幅（分）。NAVITIMEの既定は1440分（24時間）。
 *
 * 指定時刻の前後で候補が見つからないときに翌日の便まで拾ってしまうと、
 * 「今日の予定に間に合う経路」を選ぶ用途では邪魔になるため6時間で切る。
 */
const TERM_MINUTES = "360";

interface RawFare {
  [unit: string]: unknown;
}

interface RawMove {
  time?: unknown;
  transit_count?: unknown;
  from_time?: unknown;
  to_time?: unknown;
  fare?: RawFare;
}

interface RawSection {
  type?: unknown;
  /** `type: "point"` のときの地点名（駅名・バス停名）。 */
  name?: unknown;
  /** `type: "move"` のときの移動手段（`walk` / `local_train` など）。 */
  move?: unknown;
  line_name?: unknown;
  time?: unknown;
  transport?: { company?: { name?: unknown }; links?: { name?: unknown }[] };
}

interface RawItem {
  summary?: { move?: RawMove };
  sections?: RawSection[];
}

/**
 * 2地点間の公共交通の経路を探す。
 *
 * **返す順序はNAVITIMEが返した順のまま**（`order=time` なので所要時間の短い順）。
 * こちらで並べ替えたり、1本に絞ったりしない。
 */
export async function searchTransitRoutes(query: TransitSearchQuery): Promise<TransitRouteSummary[]> {
  const json = (await callNavitime("/route_transit", {
    start: `${query.start.lat},${query.start.lon}`,
    goal: `${query.goal.lat},${query.goal.lon}`,
    // start_time と goal_time は同時に指定できない（NAVITIMEの仕様）。
    ...(query.goalTime
      ? { goal_time: tokyoLocalIso(query.goalTime) }
      : { start_time: tokyoLocalIso(query.startTime ?? new Date()) }),
    limit: String(query.limit),
    order: ORDER,
    term: TERM_MINUTES,
    coord_unit: "degree",
    datum: "wgs84",
  })) as { items?: RawItem[] };

  const items = Array.isArray(json.items) ? json.items : [];
  return items
    .map(toSummary)
    .filter((route): route is TransitRouteSummary => route !== null);
}

/**
 * 1本ぶんの応答を、呼び出し元へ渡す形へ均す。
 *
 * **所要時間・出発時刻・到着時刻のどれかが読めない行は落とす。** その3つが無い候補は
 * 押しても予定の時刻を埋められず、画面に出しても選べない行が並ぶだけになる。
 */
function toSummary(item: RawItem): TransitRouteSummary | null {
  const move = item.summary?.move;
  const minutes = readNumber(move?.time);
  const departAt = readIso(move?.from_time);
  const arriveAt = readIso(move?.to_time);
  if (minutes === null || minutes <= 0 || !departAt || !arriveAt) return null;

  const sections = Array.isArray(item.sections) ? item.sections : [];

  return {
    minutes: Math.round(minutes),
    departAt,
    arriveAt,
    transitCount: Math.max(0, Math.round(readNumber(move?.transit_count) ?? 0)),
    walkMinutes: walkMinutes(sections),
    lines: lineNames(sections),
    boardStation: boardStation(sections),
    alightStation: alightStation(sections),
    fare: readFare(move?.fare),
  };
}

/** `type: "move"` かつ乗り物（徒歩以外）の区間か。 */
function isRide(section: RawSection): boolean {
  return section.type === "move" && typeof section.move === "string" && section.move !== "walk";
}

function isWalk(section: RawSection): boolean {
  return section.type === "move" && section.move === "walk";
}

/** 徒歩区間の合計（分）。summary には徒歩の距離しか入らないため、区間から足す。 */
function walkMinutes(sections: RawSection[]): number {
  const total = sections
    .filter(isWalk)
    .reduce((sum, section) => sum + (readNumber(section.time) ?? 0), 0);
  return Math.max(0, Math.round(total));
}

/** 乗車順の路線名。路線名を持たない乗り物（バス等）は会社名で代用する。 */
function lineNames(sections: RawSection[]): string[] {
  return sections
    .filter(isRide)
    .map((section) => {
      const name =
        readString(section.line_name) ??
        readString(section.transport?.links?.[0]?.name) ??
        readString(section.transport?.company?.name);
      return name;
    })
    .filter((name): name is string => name !== null);
}

/**
 * 最初に乗る駅。
 *
 * 区間は `point` と `move` が交互に並ぶので、最初の乗車区間の**直前**の地点が乗車駅になる。
 * 出発地がそのまま駅のこともあるため、直前が無ければ null。
 */
function boardStation(sections: RawSection[]): string | null {
  const index = sections.findIndex(isRide);
  if (index <= 0) return null;
  return readString(sections[index - 1]?.name);
}

/** 最後に降りる駅。最後の乗車区間の直後の地点。 */
function alightStation(sections: RawSection[]): string | null {
  const index = sections.map(isRide).lastIndexOf(true);
  if (index < 0) return null;
  return readString(sections[index + 1]?.name);
}

/**
 * 運賃を読む。
 *
 * NAVITIMEは `unit_{料金区分ID}` の形で複数の運賃を返す。**`unit_0` がきっぷの大人運賃、
 * `unit_48` がIC運賃**（2026-09-02 時点のAPI仕様書）。`unit_128` 以降は通勤定期の値段で、
 * 1回の移動の運賃ではないため見ない。きっぷ運賃が読めなければ運賃ごと null にする
 * （IC運賃だけを出すと、券売機で買う人の目安にならない）。
 */
function readFare(fare: RawFare | undefined): TransitRouteSummary["fare"] {
  if (!fare) return null;
  const ticket = readNumber(fare["unit_0"]);
  if (ticket === null) return null;
  return { ticket: Math.round(ticket), ic: readNumber(fare["unit_48"]) };
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  // 数値を文字列で返す項目があるため、数字だけの文字列は数値として受ける。
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/** 日時として読めるものだけを通す。読めなければ null（呼び出し元がその行を落とす）。 */
function readIso(value: unknown): string | null {
  const text = readString(value);
  return text && !Number.isNaN(Date.parse(text)) ? text : null;
}

/**
 * NAVITIMEへ渡す `YYYY-MM-DDTHH:mm:ss`。
 *
 * **VPSのタイムゾーンはUTC。** NAVITIMEはタイムゾーンの付かない現地時刻を受けるため、
 * そのまま `toISOString()` を渡すと9時間ずれた時刻で探索される。
 */
function tokyoLocalIso(at: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(at);

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  // hour12:false でも 24 時が返る環境があるため 0 に丸める。
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}:${get("second")}`;
}
