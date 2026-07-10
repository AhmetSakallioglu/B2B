import { NextResponse } from "next/server";
import { requireCustomerSession } from "@/lib/api-auth";
import { databaseSetupHint } from "@/lib/db-setup-hints";
import { parseAddTemplateToCartBody } from "@/lib/room-template-validation";
import { addRoomTemplateToCart } from "@/lib/room-templates";
import { enforceMutationSecurity } from "@/lib/request-security";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function isValidTemplateId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export async function POST(request: Request, context: RouteContext) {
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

  const body = parseAddTemplateToCartBody(await request.json());

  if (!body) {
    return NextResponse.json({ error: "Invalid multiplier" }, { status: 400 });
  }

  try {
    const result = await addRoomTemplateToCart({
      userId: auth.user!.id,
      userRole: auth.user!.role,
      templateId: id,
      multiplier: body.multiplier,
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error(`POST /api/templates/${id}/add-to-cart failed:`, error);

    const hint = databaseSetupHint(error);
    const message =
      error instanceof Error && error.message
        ? `${error.message}${hint}`
        : `Failed to add template to cart.${hint}`;

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
