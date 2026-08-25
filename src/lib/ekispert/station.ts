import { callEkispert, readText, toArray } from "./client";
import type { OperationLineHit, StationHit } from "./types";

/** 一度に返す件数。入力補完から呼ばれるため、画面に出し切れる範囲で切る。 */
const STATION_LIMIT = 20;

interface RawPoint {
  Station?: { code?: unknown; Name?: unknown; Yomi?: unknown };
  Prefecture?: { Name?: unknown };
}

/**
 * 駅名で駅を探す。前方一致で、鉄道の駅のみ。
 *
 * `type=train` を付けてバス停・空港を落としている。通勤経路の登録が用途なので、
 * ここに混ざると選びにくくなるため。
 */
export async function searchStations(name: string): Promise<StationHit[]> {
  const trimmed = name.trim();
  if (!trimmed) return [];

  const json = (await callEkispert("/station", {
    name: trimmed,
    type: "train",
    limit: String(STATION_LIMIT),
  })) as { ResultSet?: { Point?: RawPoint | RawPoint[] } };

  return toArray(json.ResultSet?.Point)
    .map((point): StationHit | null => {
      const code = readText(point.Station?.code);
      const stationName = readText(point.Station?.Name);
      if (!code || !stationName) return null;
      return {
        code,
        name: stationName,
        yomi: readText(point.Station?.Yomi),
        prefecture: readText(point.Prefecture?.Name),
      };
    })
    .filter((hit): hit is StationHit => hit !== null);
}

interface RawLine {
  code?: unknown;
  Name?: unknown;
  corporationIndex?: unknown;
}

interface RawCorporation {
  code?: unknown;
  Name?: unknown;
}

/**
 * 運行路線を名前で探す。経路に「どの路線を使うか」を登録するために使う。
 *
 * 会社名は `ResultSet.Corporation` 側にあり、路線は `corporationIndex` で
 * そこを指している。単一件のときにオブジェクトで返る仕様のため、
 * 添字の対応付けは配列へ均してから行う。
 */
export async function searchOperationLines(name: string): Promise<OperationLineHit[]> {
  const trimmed = name.trim();
  if (!trimmed) return [];

  const json = (await callEkispert("/operationLine", {
    name: trimmed,
    nameMatchType: "partial",
  })) as { ResultSet?: { Line?: RawLine | RawLine[]; Corporation?: RawCorporation | RawCorporation[] } };

  const corporations = toArray(json.ResultSet?.Corporation);

  return toArray(json.ResultSet?.Line)
    .map((line): OperationLineHit | null => {
      const code = readText(line.code);
      const lineName = readText(line.Name);
      if (!code || !lineName) return null;

      // corporationIndex は 1 始まり。範囲外なら会社名なしで返す。
      const index = Number(readText(line.corporationIndex) ?? "");
      const corporation = Number.isInteger(index) ? corporations[index - 1] : undefined;

      return { code, name: lineName, operator: readText(corporation?.Name) };
    })
    .filter((hit): hit is OperationLineHit => hit !== null);
}
