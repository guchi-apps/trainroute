import { requireInternalApiKey } from "@/lib/internal-auth";
import { listTransitQuotas } from "@/lib/transit/quota";

/**
 * サーバー間参照用API。経路検索に使う外部APIの利用枠（残り回数）を返す。
 * 仕様の正本は `docs/internal-api.md`、記録の仕組みは `src/lib/transit/quota.ts`。
 *
 * **ここから外部APIを叩かない。** 残数を確かめる操作そのものが枠を消費するのを避けるため、
 * 返すのは経路検索のついでに控えておいた保存済みの値だけ。
 *
 * 出す数字が無いときは 404 や 503 ではなく `providers: []` を返す。呼び出し側（DaySpan）は
 * これを「出す数字が無い」として区画ごと出さない。
 *
 * `/api/internal/routes` と違い `ALLOWED_EMAIL` は要らない。利用枠はアプリ全体のもので、
 * 利用者に紐づかないため。
 */
export async function GET(request: Request) {
  const denied = requireInternalApiKey(request);
  if (denied) return denied;

  return Response.json({
    generatedAt: new Date().toISOString(),
    providers: await listTransitQuotas(),
  });
}
