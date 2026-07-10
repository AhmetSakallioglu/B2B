import { NextResponse } from "next/server";
import { requireCustomerSession } from "@/lib/api-auth";
import { databaseSetupHint } from "@/lib/db-setup-hints";
import { parseSaveRoomTemplateBody } from "@/lib/room-template-validation";
import { createRoomTemplate, listRoomTemplatesForUser } from "@/lib/room-templates";
import { enforceMutationSecurity } from "@/lib/request-security";

export async function GET() {
  const auth = await requireCustomerSession();

  if (auth.response) {
    return auth.response;
  }

  try {
    const templates = await listRoomTemplatesForUser(auth.user!.id);

    return NextResponse.json({ templates });
  } catch (error) {
    console.error("GET /api/templates failed:", error);

    const hint = databaseSetupHint(error);

    return NextResponse.json(
      { error: `Failed to load room templates.${hint}` },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const mutationBlocked = enforceMutationSecurity(request);

  if (mutationBlocked) {
    return mutationBlocked;
  }

  const auth = await requireCustomerSession(request);

  if (auth.response) {
    return auth.response;
  }

  try {
    const body = parseSaveRoomTemplateBody(await request.json());

    if (!body) {
      return NextResponse.json({ error: "Invalid room template payload" }, { status: 400 });
    }

    const template = await createRoomTemplate({
      userId: auth.user!.id,
      templateName: body.templateName,
      items: body.items,
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error("POST /api/templates failed:", error);

    const hint = databaseSetupHint(error);
    const message =
      error instanceof Error && error.message
        ? `${error.message}${hint}`
        : `Failed to save room template.${hint}`;

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
