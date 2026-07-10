import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/api-auth";
import { reviewTaxExemption } from "@/lib/tax-exemption";
import { enforceMutationSecurity } from "@/lib/request-security";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const mutationBlocked = enforceMutationSecurity(request);

  if (mutationBlocked) {
    return mutationBlocked;
  }

  const auth = await requireAdminPermission("can_approve_tax_exemption", request);

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const userId = Number.parseInt(id, 10);

  if (!Number.isFinite(userId) || userId <= 0) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const decision =
    body && typeof body === "object" && "decision" in body
      ? String((body as Record<string, unknown>).decision)
      : "";

  if (decision !== "approve" && decision !== "reject") {
    return NextResponse.json({ error: "Decision must be approve or reject" }, { status: 400 });
  }

  const reason =
    body && typeof body === "object" && typeof (body as Record<string, unknown>).reason === "string"
      ? (body as Record<string, unknown>).reason
      : null;

  try {
    const result = await reviewTaxExemption({
      adminUserId: auth.user!.id,
      userId,
      decision,
      reason: typeof reason === "string" ? reason : null,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      ok: true,
      review: result.item,
    });
  } catch (error) {
    console.error(`POST /api/admin/users/${userId}/approve-tax failed:`, error);
    return NextResponse.json({ error: "Failed to review tax exemption" }, { status: 500 });
  }
}
