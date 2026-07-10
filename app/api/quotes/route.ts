import { NextResponse } from "next/server";
import { requireCustomerSession } from "@/lib/api-auth";
import { listQuotesForUser } from "@/lib/quotes";

export async function GET() {
  const auth = await requireCustomerSession();

  if (auth.response) {
    return auth.response;
  }

  try {
    const quotes = await listQuotesForUser(auth.user!.id);
    return NextResponse.json({ quotes });
  } catch (error) {
    console.error("GET /api/quotes failed:", error);
    return NextResponse.json({ error: "Failed to load quotes" }, { status: 500 });
  }
}
