import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const db = supabaseAdmin();
  const [{ data: products }, { data: boxes }] = await Promise.all([
    db.from("products").select("id,name,is_available,sort_order").eq("is_available", true).order("sort_order"),
    db.from("box_sizes").select("id,label,count,price,is_active,sort_order").eq("is_active", true).order("sort_order"),
  ]);
  return NextResponse.json({ products: products || [], boxes: boxes || [] });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const customerName = String(body.customer_name || "").trim();
  const deliveryDate = String(body.delivery_date || "").trim();
  const deliverySlot = String(body.delivery_slot || "").trim();

  const phone = String(body.phone || "").trim();
  if (!customerName || !phone || !deliveryDate || !deliverySlot) {
    return NextResponse.json({ error: "Name, phone number, date and time are required" }, { status: 400 });
  }

  const mapsUrl = String(body.customer_maps_url || "").trim();
  if (mapsUrl && !/^https?:\/\//i.test(mapsUrl)) {
    return NextResponse.json({ error: "Please paste a complete map link" }, { status: 400 });
  }

  const flavours = body.flavours && typeof body.flavours === "object" ? body.flavours : {};
  const cleanFlavours = Object.fromEntries(
    Object.entries(flavours)
      .map(([key, value]) => [key, Math.max(0, Math.floor(Number(value) || 0))])
      .filter(([, value]) => Number(value) > 0),
  );

  const db = supabaseAdmin();
  let totalPrice = 0;
  if (body.box_size_id) {
    const { data: box } = await db.from("box_sizes").select("price").eq("id", body.box_size_id).single();
    totalPrice = Number(box?.price || 0);
  }

  const { data, error } = await db.from("orders").insert({
    customer_name: customerName,
    phone,
    address: String(body.address || "").trim() || null,
    notes: mapsUrl ? `Customer map: ${mapsUrl}` : null,
    box_size_id: null,
    flavours: cleanFlavours,
    delivery_date: deliveryDate,
    delivery_slot: deliverySlot,
    total_price: totalPrice,
    status: "confirmed",
    payment_method: "paid_before_form",
    source: "customer_confirmation",
    fulfillment_type: "delivery",
    payment_confirmed_at: new Date().toISOString(),
  }).select("id").single();

  if (error || !data) {
    console.error("Order confirmation insert failed", error);
    return NextResponse.json({ error: "Could not save your order details" }, { status: 500 });
  }
  return NextResponse.json({ id: data.id });
}
