import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { DEFAULT_PICKUP_CODES, PICKUP_CITIES, validPickupCode } from "@/lib/pickup-codes";
export const dynamic = "force-dynamic";
export async function GET() {
  const { data, error } = await supabaseAdmin().from("pickup_codes").select("city,code");
  if (error) return NextResponse.json({ codes: DEFAULT_PICKUP_CODES, error: "Pickup settings are unavailable. Apply the pickup_codes migration before saving." }, { status: 503 });
  return NextResponse.json({ codes: { ...DEFAULT_PICKUP_CODES, ...Object.fromEntries((data || []).map(row => [row.city, row.code])) } });
}
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.codes || PICKUP_CITIES.some(c => !validPickupCode(body.codes[c.id]))) {
    return NextResponse.json({ error: "Enter a valid Plus Code (for example 7J2R28VM+3X), optionally followed by its city. Leave blank to unset." }, { status: 400 });
  }
  const { error } = await supabaseAdmin().from("pickup_codes").upsert(PICKUP_CITIES.map(c => ({ city: c.id, code: body.codes[c.id].trim() })), { onConflict: "city" });
  if (error) return NextResponse.json({ error: "Could not save pickup codes. Check that the pickup_codes migration has been applied." }, { status: 500 });
  return GET();
}
