import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
export const dynamic = "force-dynamic";
export async function GET() {
  const db = supabaseAdmin();
  const [orders, products, boxes, packing] = await Promise.all([
    db
      .from("orders")
      .select("*")
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
  return NextResponse.json({
    orders: (orders.data || []).map((o) => ({
      ...o,
      production_packed:
        packing.data?.some((p) => p.order_id === o.id && p.packed_at) || false,
      production_prepared:
        packing.data?.some((p) => p.order_id === o.id) || false,
    })),
    products: products.data,
    boxes: boxes.data,
  });
}
