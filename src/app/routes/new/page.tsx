import Link from "next/link";

import { RouteForm } from "@/components/route-form";

export default function NewRoutePage() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-lg font-semibold tracking-tight">経路を追加</h1>
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          戻る
        </Link>
      </div>
      <RouteForm />
    </div>
  );
}
