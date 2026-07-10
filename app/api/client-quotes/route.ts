import { NextResponse } from "next/server";
import { requireCustomerSession } from "@/lib/api-auth";
import { listClientQuotesForUser } from "@/lib/client-quotes";
import { databaseSetupHint } from "@/lib/db-setup-hints";

export async function GET(request: Request) {
  const auth = await requireCustomerSession(request);

  if (auth.response) {
    return auth.response;
  }

  try {
    const quotes = await listClientQuotesForUser(auth.user!.id);
    return NextResponse.json({ quotes });
  } catch (error) {
    console.error("GET /api/client-quotes failed:", error);

    const hint = databaseSetupHint(error);
    const message =
      error instanceof Error && error.message
        ? `${error.message}${hint}`
        : `Failed to load client quotes.${hint}`;

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
