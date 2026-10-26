import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { POST } from "../workflow/route";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  const { data, error } = await supabaseAdmin()
    .from("preparation_progress")
    .select("city,flavour_id,finished")
    .eq("delivery_date", date);
  return error
    ? NextResponse.json(
        { error: "Could not load preparation progress" },
        { status: 503 },
      )
    : NextResponse.json({ progress: data || [] });
}
export async function PUT(req: NextRequest) {
  const body = await req.json();
  return POST({
    json: async () => ({
      action: "prepare",
      date: body.date,
      entries: body.entries || [
        {
          city: body.city,
          flavour_id: body.flavour_id,
          finished: body.finished,
        },
      ],
    }),
  } as NextRequest);
}
