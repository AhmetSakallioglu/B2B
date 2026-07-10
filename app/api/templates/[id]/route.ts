import { NextResponse } from "next/server";
import { requireCustomerSession } from "@/lib/api-auth";
import { databaseSetupHint } from "@/lib/db-setup-hints";
import { deleteRoomTemplateForUser, getRoomTemplateForUser } from "@/lib/room-templates";
import { enforceMutationSecurity } from "@/lib/request-security";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function isValidTemplateId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireCustomerSession();

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;

  if (!isValidTemplateId(id)) {
    return NextResponse.json({ error: "Invalid template id" }, { status: 400 });
  }

  try {
    const template = await getRoomTemplateForUser(id, auth.user!.id);

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error(`GET /api/templates/${id} failed:`, error);

    const hint = databaseSetupHint(error);

    return NextResponse.json(
      { error: `Failed to load room template.${hint}` },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const mutationBlocked = enforceMutationSecurity(request);

  if (mutationBlocked) {
    return mutationBlocked;
  }

  const auth = await requireCustomerSession(request);

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;

  if (!isValidTemplateId(id)) {
    return NextResponse.json({ error: "Invalid template id" }, { status: 400 });
  }

  try {
    const deleted = await deleteRoomTemplateForUser(id, auth.user!.id);

    if (!deleted) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(`DELETE /api/templates/${id} failed:`, error);

    const hint = databaseSetupHint(error);

    return NextResponse.json(
      { error: `Failed to delete room template.${hint}` },
      { status: 500 }
    );
  }
}
