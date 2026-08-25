import { auth } from "@/auth";
import { deleteRoute } from "@/lib/routes";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const deleted = await deleteRoute(email, id);
  if (!deleted) return Response.json({ error: "見つかりませんでした" }, { status: 404 });

  return new Response(null, { status: 204 });
}
