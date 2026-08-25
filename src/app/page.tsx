import Link from "next/link";

import { auth } from "@/auth";
import { RouteList } from "@/components/route-list";
import { listRoutes } from "@/lib/routes";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();

  // middleware が未ログインを弾いているため、ここに来る時点でセッションはある。
  // それでも型のうえでは null を取りうるので、握りつぶさず明示的に出す。
  if (!email) {
    return <p className="text-sm text-muted">ログイン情報を取得できませんでした。</p>;
  }

  const routes = await listRoutes(email);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-lg font-semibold tracking-tight">通勤経路</h1>
        <Link
          href="/routes/new"
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
        >
          経路を追加
        </Link>
      </div>

      {routes.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-6 text-sm text-muted">
          <p>まだ経路がありません。</p>
          <p className="mt-2">
            よく使う区間を登録しておくと、駅すぱあとの経路検索へ一手で飛べます。
          </p>
        </div>
      ) : (
        <RouteList
          routes={routes.map((route) => ({
            id: route.id,
            name: route.name,
            originName: route.originStationName,
            destinationName: route.destinationStationName,
            viaName: route.viaStationName,
            lines: route.lines.map((line) => ({
              id: line.id,
              operator: line.operator,
              name: line.lineName,
            })),
          }))}
        />
      )}

      <p className="text-xs leading-relaxed text-muted">
        経路の時刻・運賃は「駅すぱあと for Web」で確認します。運行情報（遅延）はまだ扱っていません。
      </p>
    </div>
  );
}
