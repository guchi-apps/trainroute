import { requireInternalApiKey, resolveInternalUserEmail } from "@/lib/internal-auth";
import { EkispertError } from "@/lib/ekispert/client";
import { generateCourseUrl, tokyoDateTime } from "@/lib/ekispert/course";
import { listRoutes } from "@/lib/routes";
import { fetchServiceStatus } from "@/lib/transit";

/**
 * サーバー間参照用API。同一VPS上のAIDE（guchi-apps/aide#33）が通勤経路を読むために使う。
 * 仕様の正本は `docs/internal-api.md`。
 *
 * **運行情報（遅延）はまだ返せない。** `serviceStatus` は常に null で、その理由は
 * `available` / `reason` に添えてある。呼び出し側が「平常運転」と取り違えないよう、
 * 値を持たないことを明示する形にしている。
 */
export async function GET(request: Request) {
  const denied = requireInternalApiKey(request);
  if (denied) return denied;

  const email = resolveInternalUserEmail();
  if (!email) {
    return Response.json({ error: "ALLOWED_EMAIL is not configured" }, { status: 503 });
  }

  const routes = await listRoutes(email);

  // 経路URLの生成は駅すぱあとへの呼び出しを伴うので、明示的に要求されたときだけ行う。
  const includeCourseUrl = new URL(request.url).searchParams.get("includeCourseUrl") === "true";
  const courseUrls = includeCourseUrl ? await buildCourseUrls(routes) : new Map<string, string | null>();

  const status = await fetchServiceStatus(routes.flatMap((route) => route.lines));

  return Response.json({
    generatedAt: new Date().toISOString(),
    routes: routes.map((route) => ({
      id: route.id,
      name: route.name,
      origin: { code: route.originStationCode, name: route.originStationName },
      destination: { code: route.destinationStationCode, name: route.destinationStationName },
      via:
        route.viaStationCode && route.viaStationName
          ? { code: route.viaStationCode, name: route.viaStationName }
          : null,
      lines: route.lines.map((line) => ({
        operator: line.operator,
        code: line.lineCode,
        name: line.lineName,
      })),
      // includeCourseUrl=false のときは undefined ではなく null を返し、
      // 「要求していない」と「生成に失敗した」をキー有無で区別しない。
      courseUrl: includeCourseUrl ? (courseUrls.get(route.id) ?? null) : null,
    })),
    serviceStatus: {
      available: status !== null,
      reason:
        status === null
          ? "運行情報の取得元が未実装です。ODPTは阪急電鉄・大阪メトロ・JR西日本のデータを持たないため使えません（src/lib/transit/index.ts を参照）"
          : null,
      lines: status,
    },
  });
}

/**
 * 経路URLをまとめて作る。1本でも失敗したら全体を落とすのではなく、その経路だけ null にする。
 * AIDEは経路の構成だけでも使えるため、URLの生成失敗で全部を失うほうが損。
 */
async function buildCourseUrls(
  routes: Awaited<ReturnType<typeof listRoutes>>,
): Promise<Map<string, string | null>> {
  const { date, time } = tokyoDateTime(new Date());

  const entries = await Promise.all(
    routes.map(async (route): Promise<[string, string | null]> => {
      try {
        const url = await generateCourseUrl({
          from: { code: route.originStationCode, name: route.originStationName },
          to: { code: route.destinationStationCode, name: route.destinationStationName },
          via:
            route.viaStationCode && route.viaStationName
              ? { code: route.viaStationCode, name: route.viaStationName }
              : null,
          date,
          time,
        });
        return [route.id, url];
      } catch (cause) {
        if (cause instanceof EkispertError) return [route.id, null];
        throw cause;
      }
    }),
  );

  return new Map(entries);
}
