import { db } from "@/lib/db";
import type { StationRef } from "@/lib/ekispert/types";

/** 経路の登録・更新に渡す値。画面とAPIで同じ形を使う。 */
export interface RouteInput {
  name: string;
  origin: StationRef;
  destination: StationRef;
  via: StationRef | null;
  lines: { operator: string; code: string | null; name: string }[];
}

const MAX_NAME = 100;
const MAX_STATION_NAME = 100;
const MAX_STATION_CODE = 20;
const MAX_OPERATOR = 50;
/** 1経路あたりの路線数の上限。乗換だらけの経路でもこれを超えることはまず無い。 */
const MAX_LINES = 10;

/**
 * リクエストボディを検証する。
 *
 * **DBのカラム長を超える値をここで弾く。** MariaDB は既定で長すぎる文字列を
 * 黙って切り詰めることがあり、通した先で気づけなくなるため。
 */
export function parseRouteInput(body: unknown): { ok: true; value: RouteInput } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) return { ok: false, error: "リクエストボディが不正です" };
  const raw = body as Record<string, unknown>;

  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name) return { ok: false, error: "name は必須です" };
  if (name.length > MAX_NAME) return { ok: false, error: `name は ${MAX_NAME} 文字までです` };

  const origin = parseStation(raw.origin);
  if (!origin) return { ok: false, error: "origin（出発駅）が不正です" };
  const destination = parseStation(raw.destination);
  if (!destination) return { ok: false, error: "destination（到着駅）が不正です" };

  // via は省略・null どちらも「経由なし」として扱う。
  const via = raw.via === undefined || raw.via === null ? null : parseStation(raw.via);
  if (raw.via !== undefined && raw.via !== null && via === null) {
    return { ok: false, error: "via（経由駅）が不正です" };
  }

  if (origin.code === destination.code) {
    return { ok: false, error: "出発駅と到着駅が同じです" };
  }

  const rawLines = raw.lines === undefined ? [] : raw.lines;
  if (!Array.isArray(rawLines)) return { ok: false, error: "lines は配列で指定してください" };
  if (rawLines.length > MAX_LINES) return { ok: false, error: `lines は ${MAX_LINES} 件までです` };

  const lines: RouteInput["lines"] = [];
  for (const entry of rawLines) {
    if (typeof entry !== "object" || entry === null) return { ok: false, error: "lines の要素が不正です" };
    const line = entry as Record<string, unknown>;

    const lineName = typeof line.name === "string" ? line.name.trim() : "";
    const operator = typeof line.operator === "string" ? line.operator.trim() : "";
    if (!lineName) return { ok: false, error: "lines[].name は必須です" };
    if (!operator) return { ok: false, error: "lines[].operator は必須です" };
    if (lineName.length > MAX_STATION_NAME) return { ok: false, error: "lines[].name が長すぎます" };
    if (operator.length > MAX_OPERATOR) return { ok: false, error: "lines[].operator が長すぎます" };

    const code = typeof line.code === "string" && line.code.trim() ? line.code.trim() : null;
    if (code && code.length > MAX_STATION_CODE) return { ok: false, error: "lines[].code が長すぎます" };

    lines.push({ operator, code, name: lineName });
  }

  return { ok: true, value: { name, origin, destination, via, lines } };
}

function parseStation(value: unknown): StationRef | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;

  const code = typeof raw.code === "string" ? raw.code.trim() : "";
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!code || !name) return null;
  if (code.length > MAX_STATION_CODE || name.length > MAX_STATION_NAME) return null;

  return { code, name };
}

/** 登録済みの経路を並び順で返す。 */
export function listRoutes(userEmail: string) {
  return db.commuteRoute.findMany({
    where: { userEmail },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });
}

export type StoredRoute = Awaited<ReturnType<typeof listRoutes>>[number];

/** 経路を1件追加する。並び順は末尾。 */
export async function createRoute(userEmail: string, input: RouteInput): Promise<StoredRoute> {
  const last = await db.commuteRoute.findFirst({
    where: { userEmail },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  return db.commuteRoute.create({
    data: {
      userEmail,
      name: input.name,
      originStationCode: input.origin.code,
      originStationName: input.origin.name,
      destinationStationCode: input.destination.code,
      destinationStationName: input.destination.name,
      viaStationCode: input.via?.code ?? null,
      viaStationName: input.via?.name ?? null,
      sortOrder: (last?.sortOrder ?? -1) + 1,
      lines: {
        create: input.lines.map((line, index) => ({
          operator: line.operator,
          lineCode: line.code,
          lineName: line.name,
          sortOrder: index,
        })),
      },
    },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });
}

/**
 * 経路を削除する。
 *
 * **`userEmail` を条件に必ず含める。** ID だけで消せると、他人のIDを渡された時に
 * 通ってしまう（利用者が1人でも、この形は崩さない）。
 */
export async function deleteRoute(userEmail: string, id: string): Promise<boolean> {
  const result = await db.commuteRoute.deleteMany({ where: { id, userEmail } });
  return result.count > 0;
}
