/**
 * 経路検索に使う外部APIの利用枠（残り回数）の記録と読み出し。
 *
 * ## なぜ保存するのか
 *
 * NAVITIME の無料枠は月500回のハードリミット。使い切ったことに気付けないと、実データのはずの
 * 所要時間が黙って呼び出し側の見積もりへ戻り、値が変わった理由がどこにも出ない
 * （guchi-apps/dayspan#423）。そこで残数を DaySpan の画面へ出せるようにしている。
 *
 * **残数を読むために外部APIを叩かない。** 残りを確かめる操作そのものが枠を消費してしまうため、
 * 経路検索を呼んだ「ついで」に応答ヘッダーから残数を控え、DBの1行へ上書きしておく（履歴は持たない）。
 * `GET /api/internal/transit-quota` はその行を返すだけ。
 *
 * ## 枠が戻る時刻をこちらで計算しない
 *
 * **枠が戻るのは暦の月末ではなく契約日からの請求サイクル。** 月初でリセットする実装にすると
 * 実際の枠とずれるため、`resetAt` は提供元が返した値（RapidAPI は「残り秒数」）だけを根拠にする。
 */

import { db } from "@/lib/db";

/** 残数の出どころ。`local` は trainroute が自分の呼び出しを数えた概算。 */
export type TransitQuotaSource = "provider" | "local";

/** サーバー間参照用APIが返す1提供元ぶんの利用枠。 */
export interface TransitQuota {
  key: string;
  label: string;
  /** 枠の上限。分からなければ null。 */
  limit: number | null;
  /** 残り回数。**必須**（読めない提供元は行ごと返さない）。 */
  remaining: number;
  /** 枠が戻る日時（ISO 8601）。分からなければ null。 */
  resetAt: string | null;
  /** 最後に残数を見た時刻（ISO 8601）。 */
  updatedAt: string;
  source: TransitQuotaSource;
}

interface QuotaProviderDefinition {
  /** DBの主キーであり、APIの `key` としてそのまま出る識別子。 */
  key: string;
  /** 画面に出す名前。 */
  label: string;
  /**
   * この提供元を経路検索に使える状態か（アクセスキーが配られているか）。
   *
   * 未設定・未契約のときに古い行を返し続けると、使っていない提供元の残数が画面に出る。
   * 呼び出し側は「出す数字が無い」ことを区画ごと出さない判断に使うので、ここで落とす。
   */
  isConfigured: () => boolean;
}

/**
 * 提供元の一覧。**経路検索に実際に使うものを先頭に置く**
 * （呼び出し側の入力画面は先頭の1件だけを出す）。
 *
 * 駅すぱあと（`EKISPERT_ACCESS_KEY`）はここに入れていない。フリープランは応答に残数を
 * 返さず、自前カウントの `local` でしか出せないため。必要になったらこの配列へ足す。
 */
const PROVIDERS: QuotaProviderDefinition[] = [
  {
    key: "navitime",
    label: "NAVITIME",
    // キー名は guchi-apps/trainroute#13（経路検索の実装）と揃えてある。
    isConfigured: () => Boolean(process.env.NAVITIME_API_KEY),
  },
];

/**
 * 保存済みの利用枠を返す。**外部APIは叩かない。**
 *
 * 次の行は返さない（呼び出し側は「取れなかった」として扱い、区画ごと出さない）。
 *
 * - アクセスキーが設定されていない提供元（未契約・使っていない）
 * - まだ一度も経路検索を呼んでいない提供元（記録が無い）
 * - `resetAt` を過ぎている行。枠は戻っているのに古い残数を出すと、使い切ったと誤解させる。
 *   次の経路検索で新しい残数が入るまでは、間違った数字より「分からない」を返すほうがよい
 */
export async function listTransitQuotas(now: Date = new Date()): Promise<TransitQuota[]> {
  const configured = PROVIDERS.filter((provider) => provider.isConfigured());
  if (configured.length === 0) return [];

  const rows = await db.transitApiQuota.findMany({
    where: { provider: { in: configured.map((provider) => provider.key) } },
  });
  const byProvider = new Map(rows.map((row) => [row.provider, row]));

  // 並び順はDBの取得順ではなく PROVIDERS の順にする（先頭＝経路検索に使うもの）。
  return configured.flatMap((provider): TransitQuota[] => {
    const row = byProvider.get(provider.key);
    if (!row) return [];
    if (row.resetAt && row.resetAt.getTime() <= now.getTime()) return [];

    return [
      {
        key: provider.key,
        label: provider.label,
        limit: row.quotaLimit,
        remaining: row.remaining,
        resetAt: row.resetAt?.toISOString() ?? null,
        updatedAt: row.updatedAt.toISOString(),
        source: row.source === "local" ? "local" : "provider",
      },
    ];
  });
}

/**
 * RapidAPI が応答に付ける残数ヘッダーを控える。**経路検索を呼ぶたびに呼び出すこと。**
 *
 * 読むのは次の3つ（https://docs.rapidapi.com/docs/response-headers）。
 *
 * - `x-ratelimit-requests-limit` … 枠の上限
 * - `x-ratelimit-requests-remaining` … 残り回数
 * - `x-ratelimit-requests-reset` … 枠が戻るまでの**残り秒数**（日時ではない）
 *
 * **残数が読めない応答では何も書かない。** 前回の値をそのまま残すほうが、0やnullで上書きして
 * 「使い切った」ように見せるより害が小さい。残数だけが読めて上限・リセット時刻が欠けている
 * 場合は、その2つを null で上書きする（1回の観測をそのまま残し、古い値と混ぜない）。
 *
 * **記録の失敗で経路検索を落とさない。** 呼び出し側にとって本題は経路であり、残数は付随情報。
 */
export async function recordRapidApiQuota(
  providerKey: string,
  headers: Headers,
  now: Date = new Date(),
): Promise<void> {
  const remaining = readNonNegativeInt(headers.get("x-ratelimit-requests-remaining"));
  if (remaining === null) return;

  const limit = readNonNegativeInt(headers.get("x-ratelimit-requests-limit"));
  const resetSeconds = readNonNegativeInt(headers.get("x-ratelimit-requests-reset"));

  await saveTransitQuota({
    provider: providerKey,
    quotaLimit: limit,
    remaining,
    // 残り秒数を日時へ直して持つ。請求サイクルの起点はこちらで持たない。
    resetAt: resetSeconds === null ? null : new Date(now.getTime() + resetSeconds * 1_000),
    source: "provider",
  });
}

/** 利用枠の1行を上書き保存する。履歴は持たない。 */
export async function saveTransitQuota(input: {
  provider: string;
  quotaLimit: number | null;
  remaining: number;
  resetAt: Date | null;
  source: TransitQuotaSource;
}): Promise<void> {
  const value = {
    quotaLimit: input.quotaLimit,
    remaining: input.remaining,
    resetAt: input.resetAt,
    source: input.source,
  };

  try {
    await db.transitApiQuota.upsert({
      where: { provider: input.provider },
      create: { provider: input.provider, ...value },
      update: value,
    });
  } catch (cause) {
    console.warn(`[transit-quota] ${input.provider} の利用枠を保存できませんでした`, cause);
  }
}

/** 0以上の整数として読めれば返す。読めなければ null（「分からない」）。 */
function readNonNegativeInt(value: string | null): number | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;

  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) ? parsed : null;
}
