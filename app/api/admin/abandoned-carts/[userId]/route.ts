import { NextResponse } from "next/server";
import { loadAbandonedCartDealerContext } from "@/lib/abandoned-cart";
import { requireAdminPermission } from "@/lib/api-auth";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("can_view_orders");

  if (auth.response) {
    return auth.response;
  }

  const { userId } = await context.params;
  const parsedUserId = Number.parseInt(userId, 10);

  if (!Number.isFinite(parsedUserId) || parsedUserId <= 0) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const cart = await loadAbandonedCartDealerContext(parsedUserId);

  if (!cart) {
    return NextResponse.json({ error: "Active abandoned cart not found" }, { status: 404 });
  }

  return NextResponse.json({ cart });
}
