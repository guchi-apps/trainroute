import { requireUserEmail } from "@/lib/auth-user";
import { EkispertError, EkispertNotConfiguredError } from "@/lib/ekispert/client";
import { searchStations } from "@/lib/ekispert/station";

/**
 * 駅名の入力補完。**駅すぱあとのアクセスキーをブラウザへ出さないための中継**であり、
 * ここ以外から駅すぱあとを直接叩かせない。ログイン必須（`src/middleware.ts`）。
 */
export async function GET(request: Request) {
  // /api/* は proxy.ts でリダイレクトせず素通しているため、ここで認証する。
  if (!(await requireUserEmail())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const name = new URL(request.url).searchParams.get("name") ?? "";
  if (!name.trim()) return Response.json({ stations: [] });

  try {
    return Response.json({ stations: await searchStations(name) });
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
