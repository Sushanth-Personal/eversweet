import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

function payload(body: Record<string, unknown>) {
  const mapUrl = String(body.customer_maps_url || "").trim();
  return {
    customer_name: String(body.customer_name || "").trim(),
    phone: String(body.phone || "").trim(),
    address: String(body.address || "").trim() || null,
    notes: mapUrl ? `Customer map: ${mapUrl}` : null,
    delivery_date: body.delivery_date || null,
    delivery_slot: body.delivery_slot || null,
    box_size_id: body.box_size_id || null,
    flavours: body.flavours || {},
    source: body.location === "trivandrum" ? "trivandrum" : "kochi",
    fulfillment_type: body.fulfillment_type === "pickup" ? "pickup" : "delivery",
    status: body.status || "confirmed",
    total_price: Number(body.total_price || 0),
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const values = payload(body);
  if (!values.customer_name || !values.phone || !values.delivery_date || !values.delivery_slot) return NextResponse.json({ error: "Name, phone, date and time are required" }, { status: 400 });
  const { data, error } = await supabaseAdmin().from("orders").insert({ ...values, payment_method: "admin", payment_confirmed_at: new Date().toISOString() }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ order: data });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
  if (body.action === "dispatch") {
    const { data, error } = await supabaseAdmin().from("orders").update({ status: "dispatched" }).eq("id", body.id).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ order: data });
  }
  const values = payload(body);
  if (!values.customer_name || !values.phone || !values.delivery_date || !values.delivery_slot) return NextResponse.json({ error: "Name, phone, date and time are required" }, { status: 400 });
  const { data, error } = await supabaseAdmin().from("orders").update(values).eq("id", body.id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ order: data });
}
