import { requireUserEmail } from "@/lib/auth-user";
import { createRoute, listRoutes, parseRouteInput } from "@/lib/routes";

export async function GET() {
  const email = await requireUserEmail();
  if (!email) return Response.json({ error: "Unauthorized" }, { status: 401 });

  return Response.json({ routes: await listRoutes(email) });
}

export async function POST(request: Request) {
  const email = await requireUserEmail();
  if (!email) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "JSONとして読めませんでした" }, { status: 400 });
  }

  const parsed = parseRouteInput(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  return Response.json({ route: await createRoute(email, parsed.value) }, { status: 201 });
}
