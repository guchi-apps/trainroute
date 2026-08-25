import { EkispertError, EkispertNotConfiguredError } from "@/lib/ekispert/client";
import { searchOperationLines } from "@/lib/ekispert/station";

/** 路線名の入力補完。`/api/stations` と同じく駅すぱあとへの中継。 */
export async function GET(request: Request) {
  const name = new URL(request.url).searchParams.get("name") ?? "";
  if (!name.trim()) return Response.json({ lines: [] });

  try {
    return Response.json({ lines: await searchOperationLines(name) });
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
