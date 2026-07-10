import { NextResponse } from "next/server";
import { getCompanyProfile } from "@/lib/company-profile";

export async function GET() {
  return NextResponse.json({ profile: getCompanyProfile() });
}
