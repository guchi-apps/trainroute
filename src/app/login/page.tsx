import Link from "next/link";
import { TrainFront, OctagonAlert } from "lucide-react";

import { safeNextPath } from "@/lib/request-origin";

const errorMessages: Record<string, string> = {
  not_allowed: "許可されていないアカウントです。別のGoogleアカウントでお試しください。",
  auth_failed: "ログインに失敗しました。時間をおいて、もう一度お試しください。",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { callbackUrl, error } = await searchParams;
  const next = safeNextPath(typeof callbackUrl === "string" ? callbackUrl : null);
  const errorMessage =
    typeof error === "string" ? (errorMessages[error] ?? errorMessages.auth_failed) : null;

  return (
    <div className="flex flex-1 items-center justify-center py-10">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 text-center">
        <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl bg-accent text-white">
          <TrainFront className="size-6" />
        </span>
        <h1 className="text-lg font-semibold tracking-tight">ログイン</h1>
        <p className="mt-1 text-sm text-muted">Googleアカウントでログインしてください。</p>

        {errorMessage && (
          <p className="mt-4 flex items-start gap-2 rounded-md bg-red-500/10 px-3 py-2 text-left text-sm text-red-500">
            <OctagonAlert className="mt-0.5 size-4 shrink-0" />
            {errorMessage}
          </p>
        )}

        {/*
          ログインは素のリンクにしておく。onClick でログインを開始すると、クライアントJSの
          ハイドレーションが完了するまでボタンを押しても何も起きない状態が生まれる。
        */}
        <Link
          href={`/auth/signin?next=${encodeURIComponent(next)}`}
          className="mt-5 flex h-10 w-full items-center justify-center rounded-md bg-accent px-6 text-sm font-medium text-white hover:opacity-90"
        >
          Googleでログイン
        </Link>

        <p className="mt-3 text-xs text-muted">許可されたGoogleアカウントのみログインできます。</p>
      </div>
    </div>
  );
}
