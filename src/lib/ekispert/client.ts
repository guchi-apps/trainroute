/**
 * 駅すぱあと API（フリープラン）のクライアント。
 *
 * **アクセスキーはサーバー側だけで扱う。** ブラウザから直接叩かせない
 * （キーが露出するうえ、駅すぱあとはドメイン単位の契約のため）。呼び出しは
 * すべて `src/app/api/` 配下のルートハンドラを経由させる。
 *
 * フリープランで使えるのは駅・路線・会社のマスタと「駅すぱあと for Web」への
 * URL生成のみ。運賃・所要時間のJSONと運行情報は上位プランでしか返らないため、
 * このクライアントにもそれらのエンドポイントは置いていない。
 */

const BASE_URL = "https://api.ekispert.com/v1/json";

/**
 * 1本あたりの制限時間。
 * 画面の入力補完から呼ばれるため、相手が遅いときに待たせ続けないよう短く切る。
 */
const TIMEOUT_MS = 5_000;

export class EkispertError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "EkispertError";
  }
}

/** アクセスキー未設定を「空の結果」と区別できるようにするための番兵。 */
export class EkispertNotConfiguredError extends EkispertError {
  constructor() {
    super("EKISPERT_ACCESS_KEY is not configured");
    this.name = "EkispertNotConfiguredError";
  }
}

function accessKey(): string {
  const key = process.env.EKISPERT_ACCESS_KEY;
  if (!key) throw new EkispertNotConfiguredError();
  return key;
}

/**
 * 駅すぱあとを1回叩く。
 *
 * **例外メッセージにURLを載せない。** クエリにアクセスキーが入っているため、
 * そのまま出すとログやレスポンスにキーが流れる。
 */
export async function callEkispert(
  path: string,
  params: Record<string, string | undefined>,
): Promise<unknown> {
  const query = new URLSearchParams({ key: accessKey() });
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(name, value);
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}?${query.toString()}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (cause) {
    const timedOut = cause instanceof Error && cause.name === "TimeoutError";
    throw new EkispertError(
      timedOut ? `駅すぱあとが ${TIMEOUT_MS}ms 以内に応答しませんでした` : "駅すぱあとに接続できませんでした",
    );
  }

  if (!res.ok) {
    // 401/403 はキーの問題、429 は上限。ステータスだけを外へ出す。
    throw new EkispertError(`駅すぱあとが HTTP ${res.status} を返しました`, res.status);
  }

  try {
    return await res.json();
  } catch {
    throw new EkispertError("駅すぱあとの応答をJSONとして読めませんでした");
  }
}

/**
 * 駅すぱあとのJSONは、要素が1件のときに配列ではなくオブジェクトを返す。
 * 呼び出し側で毎回分岐しないよう、ここで必ず配列へ均す。
 */
export function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/** ネストしたレスポンスから文字列を取り出す（`{ "Name": "○○駅" }` と `"○○駅"` の両方に対応）。 */
export function readText(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "text" in value) {
    const text = (value as { text?: unknown }).text;
    if (typeof text === "string") return text;
  }
  return null;
}
