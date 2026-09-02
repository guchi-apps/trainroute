/**
 * NAVITIME API（RapidAPI経由）のクライアント。
 *
 * **アクセスキーはサーバー側だけで扱う。** 駅すぱあとと同じく、ブラウザからは直接叩かせない。
 * このアプリでの用途はサーバー間参照用API（`/api/internal/route-transit`）だけで、
 * 画面からは呼ばない。
 *
 * ## なぜ駅すぱあとではなくNAVITIMEなのか
 *
 * 駅すぱあとのフリープランは経路の中身（所要時間・運賃）をJSONで返さず、返るのは
 * 「駅すぱあと for Web」のURLだけ（`src/lib/ekispert/course.ts`）。所要時間を数値で
 * 他アプリへ渡す用途はこのプランでは満たせないため、経路探索だけNAVITIMEへ分けている。
 * 検討して落選した取得元とその理由は guchi-apps/trainroute#13 に残してある。
 *
 * ## 呼ぶときの約束
 *
 * - **応答をキャッシュへ保存しない。** RapidAPI経由のNAVITIME利用規約 第5条第5項が
 *   「本サービスを通じて当社から提供を受けたデータをキャッシュ等に保存してはならない」と
 *   定めている（2026-09-02 に確認）。`fetch` にも `cache: "no-store"` を付けている
 * - **呼ばれたときだけ問い合わせる。** 無料枠は月500回のハードリミットで、
 *   先読みや定期取得を入れると枠が数日で消える
 */

/**
 * RapidAPI上のNAVITIME Route (totalnavi) のホスト。
 *
 * NAVITIME自身の仕様書は `https://{HOST}/{CID}/v1/route_transit` を示すが、**RapidAPI経由では
 * CIDとバージョンはプロキシ側が持つ**ため、こちらから送るパスは `/route_transit` だけになる。
 * 契約先をSBIの「API Hub」へ替える場合はホストだけでなく認証ヘッダーも変わるので、
 * ここを差し替えるだけでは済まない。
 */
const RAPIDAPI_HOST = "navitime-route-totalnavi.p.rapidapi.com";
const BASE_URL = `https://${RAPIDAPI_HOST}`;

/**
 * 1本あたりの制限時間。
 *
 * **呼び出し元（DaySpan）のタイムアウトは5秒**なので、それより内側で必ず答えを返す。
 * 同じ5秒にすると先に呼び出し元が諦め、こちらが枠を1回使ったことだけが残る。
 */
const TIMEOUT_MS = 4_500;

export class NavitimeError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "NavitimeError";
  }
}

/** アクセスキー未設定を「結果0件」と区別できるようにするための番兵。 */
export class NavitimeNotConfiguredError extends NavitimeError {
  constructor() {
    super("NAVITIME_API_KEY is not configured");
    this.name = "NavitimeNotConfiguredError";
  }
}

/** 無料枠を使い切ったときの番兵。呼び出し元へ 429 として伝えるために型で分ける。 */
export class NavitimeQuotaExceededError extends NavitimeError {
  constructor() {
    super("NAVITIMEの利用枠を使い切りました", 429);
    this.name = "NavitimeQuotaExceededError";
  }
}

/** アクセスキーが設定されているか。ルートハンドラが 503 を返すかの判定に使う。 */
export function isNavitimeConfigured(): boolean {
  return Boolean(process.env.NAVITIME_API_KEY);
}

function accessKey(): string {
  const key = process.env.NAVITIME_API_KEY;
  if (!key) throw new NavitimeNotConfiguredError();
  return key;
}

/**
 * NAVITIMEを1回叩く。
 *
 * **例外メッセージにURLを載せない。** クエリには座標（自宅・勤務先になりうる）が入るため、
 * ログへ流すと公開リポジトリの外であっても居場所が残る。キーはヘッダー側だが同じ扱いにする。
 */
export async function callNavitime(
  path: string,
  params: Record<string, string | undefined>,
): Promise<unknown> {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(name, value);
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}?${query.toString()}`, {
      headers: {
        accept: "application/json",
        "x-rapidapi-key": accessKey(),
        "x-rapidapi-host": RAPIDAPI_HOST,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // 利用規約でキャッシュへの保存が禁じられているため、Next.jsのfetchキャッシュにも載せない。
      cache: "no-store",
    });
  } catch (cause) {
    if (cause instanceof NavitimeNotConfiguredError) throw cause;
    const timedOut = cause instanceof Error && cause.name === "TimeoutError";
    throw new NavitimeError(
      timedOut ? `NAVITIMEが ${TIMEOUT_MS}ms 以内に応答しませんでした` : "NAVITIMEに接続できませんでした",
    );
  }

  // RapidAPIは無料枠を使い切ると 429 を返す。これは障害ではなく「今月はもう取れない」なので、
  // 呼び出し元がAIの見積もりへ落とせるように型で分けて伝える。
  if (res.status === 429) throw new NavitimeQuotaExceededError();

  if (!res.ok) {
    // 401/403 はキーの問題。本文にキーが載ることがあるため、ステータスだけを外へ出す。
    throw new NavitimeError(`NAVITIMEが HTTP ${res.status} を返しました`, res.status);
  }

  try {
    return await res.json();
  } catch {
    throw new NavitimeError("NAVITIMEの応答をJSONとして読めませんでした");
  }
}
