import { NextResponse } from "next/server";
import { sendManualAbandonedCartEmail } from "@/lib/abandoned-cart-recovery";
import { requireAdminPermission } from "@/lib/api-auth";

export async function POST(request: Request) {
  const auth = await requireAdminPermission("can_manage_emails");

  if (auth.response) {
    return auth.response;
  }

  const body = (await request.json()) as { userId?: unknown; templateId?: unknown };
  const userId =
    typeof body.userId === "number"
      ? body.userId
      : Number.parseInt(String(body.userId ?? ""), 10);
  const templateId =
    typeof body.templateId === "number"
      ? body.templateId
      : Number.parseInt(String(body.templateId ?? ""), 10);

  if (!Number.isFinite(userId) || userId <= 0 || !Number.isFinite(templateId) || templateId <= 0) {
    return NextResponse.json({ error: "Invalid userId or templateId" }, { status: 400 });
  }

  try {
    const result = await sendManualAbandonedCartEmail({
      userId,
      templateId,
      sentByAdminId: auth.user!.id,
    });

    return NextResponse.json({
      ok: true,
      message: `"${result.template.name}" sent to ${result.context.email}.`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to send manual email",
      },
      { status: 400 }
    );
  }
}
