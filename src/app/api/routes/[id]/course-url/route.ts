import { auth } from "@/auth";
import { db } from "@/lib/db";
import { generateCourseUrl, tokyoDateTime } from "@/lib/ekispert/course";
import { EkispertError, EkispertNotConfiguredError } from "@/lib/ekispert/client";

/**
 * 「駅すぱあと for Web」で開くためのURLを作る。
 *
 * **画面を開くたびに作らず、押されたときだけ作る。** フリープランには呼び出し回数の
 * 上限があり、一覧に並ぶ経路の分をまとめて生成すると無駄に消費するため。
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const route = await db.commuteRoute.findFirst({ where: { id, userEmail: email } });
  if (!route) return Response.json({ error: "見つかりませんでした" }, { status: 404 });

  // VPSのタイムゾーンはUTCのため、日付・時刻はこちらでJSTを作って渡す。
  const { date, time } = tokyoDateTime(new Date());
  const searchType = new URL(request.url).searchParams.get("searchType");

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
      searchType: searchType === "arrival" || searchType === "lastTrain" || searchType === "firstTrain"
        ? searchType
        : "departure",
    });

    if (!url) return Response.json({ error: "経路URLを生成できませんでした" }, { status: 502 });
    return Response.json({ url });
  } catch (cause) {
    if (cause instanceof EkispertNotConfiguredError) {
      return Response.json({ error: "駅すぱあとのアクセスキーが未設定です" }, { status: 503 });
    }
    if (cause instanceof EkispertError) {
      return Response.json({ error: cause.message }, { status: 502 });
    }
    throw cause;
  }
}
