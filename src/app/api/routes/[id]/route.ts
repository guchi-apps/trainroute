import { requireUserEmail } from "@/lib/auth-user";
import { deleteRoute } from "@/lib/routes";

export async function DELETE(_request: Request, context: RouteContext<"/api/routes/[id]">) {
  const email = await requireUserEmail();
  if (!email) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const deleted = await deleteRoute(email, id);
  if (!deleted) return Response.json({ error: "見つかりませんでした" }, { status: 404 });

  return new Response(null, { status: 204 });
}
