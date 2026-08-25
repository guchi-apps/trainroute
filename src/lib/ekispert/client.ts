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

/**
 * **ホストは `api.ekispert.jp`。`api.ekispert.com` ではない。**
 *
 * 公式のAPIリファレンス（docs.ekispert.com）には `https://api.ekispert.com/v1/...` と
 * 書かれているが、**このホストは443が応答せず接続がタイムアウトする**。実際に応答するのは
 * `api.ekispert.jp` で、こちらは60ms程度で駅すぱあと自身のエラー形式
 * （`ResultSet.Error.code`）を返す。2026-08-26 に両方へ接続して確認した。
 *
 * ドキュメントを信じて `.com` にすると、症状が「5秒でタイムアウト」になり
 * 原因がアクセスキーや通信環境の問題に見えるため、ここを勝手に直さないこと。
 */
const BASE_URL = "https://api.ekispert.jp/v1/json";

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

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    // 本文が読めない場合はステータスだけで判断する。
    if (!res.ok) throw new EkispertError(`駅すぱあとが HTTP ${res.status} を返しました`, res.status);
    throw new EkispertError("駅すぱあとの応答をJSONとして読めませんでした");
  }

  // 駅すぱあとは失敗を `ResultSet.Error` に入れて返す（401/403のときは本文にも入る）。
  // **成功ステータスでもここにエラーが入ることがある**ため、res.ok に関わらず先に見る。
  // 見ないと「結果0件」に化けて、キーの誤りや上限超過が画面から分からなくなる。
  const apiError = readApiError(json);
  if (apiError) {
    throw new EkispertError(`駅すぱあとがエラーを返しました（${apiError}）`, res.status);
  }

  if (!res.ok) {
    // 401/403 はキーの問題、429 は上限。ステータスだけを外へ出す。
    throw new EkispertError(`駅すぱあとが HTTP ${res.status} を返しました`, res.status);
  }

  return json;
}

/** `ResultSet.Error` があれば、外へ出してよい粒度の文言へ落とす。無ければ null。 */
function readApiError(json: unknown): string | null {
  if (typeof json !== "object" || json === null) return null;
  const resultSet = (json as { ResultSet?: unknown }).ResultSet;
  if (typeof resultSet !== "object" || resultSet === null) return null;

  const error = (resultSet as { Error?: unknown }).Error;
  if (typeof error !== "object" || error === null) return null;

  const message = (error as { Message?: unknown }).Message;
  const code = (error as { code?: unknown }).code;
  const parts = [typeof code === "string" ? code : null, typeof message === "string" ? message : null];
  const text = parts.filter(Boolean).join(" ");
  return text || "詳細不明";
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
