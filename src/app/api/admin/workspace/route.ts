import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { historicalProductionOrders, activeOrdersForDate } from "@/lib/production";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const db = supabaseAdmin();
  const [orders, products, boxes, packing] = await Promise.all([
    db
      .from("orders")
      .select("*")
      .not("status","in","(cancelled,deleted,archived)")
      .order("created_at", { ascending: false })
      .limit(1000),
    db.from("products").select("*").order("sort_order"),
    db.from("box_sizes").select("*").order("sort_order"),
    db.from("order_packing").select("order_id,packed_at,dispatched_at"),
  ]);
  if (orders.error || products.error || boxes.error)
    return NextResponse.json(
      { error: "Could not refresh orders. Please try again." },
      { status: 503 },
    );
  const history = historicalProductionOrders(orders.data || [],boxes.data || []);
  const url = req ? new URL(req.url) : null;
  return NextResponse.json({
    orders: history.map((o) => ({
      ...o,
      production_packed:
        packing.data?.some((p) => p.order_id === o.id && p.packed_at) || false,
      production_prepared:
        packing.data?.some((p) => p.order_id === o.id) || false,
    })),
    ...(url?.searchParams.get("date") ? {activeOrders:activeOrdersForDate(history,boxes.data || [],url.searchParams.get("date")!,url.searchParams.get("city") || "all")} : {}),
    products: products.data,
    boxes: boxes.data,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
