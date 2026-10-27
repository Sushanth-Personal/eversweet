import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isActiveOrder } from "@/lib/order-lifecycle";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  const db = supabaseAdmin();
  const [progress, packing] = await Promise.all([
    db
      .from("preparation_progress")
      .select("city,flavour_id,finished")
      .eq("delivery_date", date),
    db.from("order_packing").select("*").eq("delivery_date", date),
  ]);
  return NextResponse.json({
    progress: progress.data || [],
    packing: packing.data || [],
    available: !progress.error && !packing.error,
    preparationAvailable: !progress.error,
    error:
      progress.error || packing.error
        ? "Preparation and packing are awaiting setup."
        : null,
  });
}
export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    if (
      ![
        "pack",
        "unpack",
        "dispatch",
        "prepare",
        "prepare_order",
        "unprepare",
        "reset_order",
      ].includes(b.action)
    )
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    if (b.action === "prepare") {
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(b.date) ||
        !Array.isArray(b.entries) ||
        !b.entries.length ||
        b.entries.length > 2 ||
        new Set(b.entries.map((e: any) => e.city)).size !== b.entries.length ||
        b.entries.some(
          (e: any) =>
            !["kochi", "trivandrum"].includes(e.city) ||
            typeof e.flavour_id !== "string" ||
            !e.flavour_id ||
            e.flavour_id.length > 200 ||
            !Number.isSafeInteger(e.finished) ||
            e.finished < 0 ||
            e.finished > 100000,
        )
      )
        return NextResponse.json(
          { error: "Invalid preparation count" },
          { status: 400 },
        );
    } else if (typeof b.id !== "string" || !/^[\da-f-]{36}$/i.test(b.id))
      return NextResponse.json({ error: "Invalid order" }, { status: 400 });
    const db = supabaseAdmin();
    if (["prepare_order","pack","dispatch"].includes(b.action)) {
      const {data:order,error:readError}=await db.from("orders").select("status").eq("id",b.id).single();
      if(readError || !order || !isActiveOrder(order)) return NextResponse.json({error:"This order is not active production work."},{status:409});
    }
    const { data, error } = await db.rpc("production_action", {
      p_action: b.action,
      p_order_id: b.id || null,
      p_date: b.date || null,
      p_entries: b.entries || null,
    });
    if (error)
      return NextResponse.json(
        {
          error:
            error.code === "PGRST202"
              ? "Packing is awaiting setup."
              : error.message,
        },
        { status: 409 },
      );
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Could not update production" },
      { status: 400 },
    );
  }
}
