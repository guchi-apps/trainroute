import { requireInternalApiKey } from "@/lib/internal-auth";
import {
  NavitimeError,
  NavitimeNotConfiguredError,
  NavitimeQuotaExceededError,
} from "@/lib/navitime/client";
import { NAVITIME_ATTRIBUTION, searchTransitRoutes } from "@/lib/navitime/route-transit";

/**
 * 2地点間の公共交通の経路を返すサーバー間参照用API（guchi-apps/trainroute#13）。
 * 仕様の正本は `docs/internal-api.md`。
 *
 * 呼び出し元は DaySpan（guchi-apps/dayspan#424）と AIDE（guchi-apps/aide#33）。
 * **交通系の外部APIのキーは trainroute に集約する**方針のため、NAVITIMEを実際に叩くのはここだけ。
 *
 * **呼ばれたときだけ問い合わせる。** NAVITIMEの無料枠は月500回のハードリミットで、
 * 先読みや定期取得を入れると数日で枠が消える。
 */

/** 一度に返す経路の数。上限は、候補が縦に伸びすぎない範囲として呼び出し元と合わせてある。 */
const DEFAULT_LIMIT = 3;
const MAX_LIMIT = 5;

export async function GET(request: Request) {
  const denied = requireInternalApiKey(request);
  if (denied) return denied;

  const params = new URL(request.url).searchParams;

  const start = readCoord(params, "startLat", "startLon");
  const goal = readCoord(params, "goalLat", "goalLon");
  if (!start || !goal) {
    return Response.json(
      { error: "startLat / startLon / goalLat / goalLon を10進度の座標で指定してください" },
      { status: 400 },
    );
  }

  // NAVITIMEは出発時刻と到着時刻を同時に受けない。どちらを優先するかをこちらで決めると
  // 呼び出し元の意図と食い違うため、両方来たらエラーにする。
  const goalTime = readTime(params, "goalTime");
  const startTime = readTime(params, "startTime");
  if (goalTime === "invalid" || startTime === "invalid") {
    return Response.json({ error: "goalTime / startTime は ISO 8601 で指定してください" }, { status: 400 });
  }
  if (goalTime && startTime) {
    return Response.json({ error: "goalTime と startTime は同時に指定できません" }, { status: 400 });
  }

  // startName / goalName は呼び出し元の表示用の名前。NAVITIMEへは座標だけを渡すため
  // 探索には使わない（名前を載せても結果は変わらず、応答にも返していない）。
  // 受け口だけ残してあるのは、呼び出し元が送っても 400 にしないため。

  try {
    const routes = await searchTransitRoutes({
      start,
      goal,
      goalTime,
      startTime,
      limit: readLimit(params),
    });

    return Response.json({
      generatedAt: new Date().toISOString(),
      routes,
      attribution: NAVITIME_ATTRIBUTION,
    });
  } catch (cause) {
    if (cause instanceof NavitimeNotConfiguredError) {
      // 未設定は障害ではなく「この機能を持っていない」。呼び出し元はAIの見積もりへ落ちる。
      return Response.json({ error: "NAVITIMEのアクセスキーが未設定です" }, { status: 503 });
    }
    if (cause instanceof NavitimeQuotaExceededError) {
      // 枠切れは失敗ではなく「今月はもう取れない」。取り違えないよう 429 で区別して返す。
      return Response.json({ error: cause.message }, { status: 429 });
    }
    if (cause instanceof NavitimeError) {
      return Response.json({ error: cause.message }, { status: 502 });
    }
    throw cause;
  }
}

/** 10進度の座標を読む。未指定・数値でない・範囲外はいずれも null（呼び出し側が 400 にする）。 */
function readCoord(
  params: URLSearchParams,
  latKey: string,
  lonKey: string,
): { lat: number; lon: number } | null {
  const rawLat = params.get(latKey)?.trim();
  const rawLon = params.get(lonKey)?.trim();
  if (!rawLat || !rawLon) return null;

  const lat = Number(rawLat);
  const lon = Number(rawLon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

/** 時刻を読む。未指定は null、指定されているが読めない場合は "invalid"。 */
function readTime(params: URLSearchParams, key: string): Date | null | "invalid" {
  const raw = params.get(key)?.trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? "invalid" : parsed;
}

/** 件数。読めない値は既定へ倒し、上限を超えたぶんは切り詰める（枠を無駄に使わないため）。 */
function readLimit(params: URLSearchParams): number {
  const parsed = Number(params.get("limit"));
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.floor(parsed));
}
