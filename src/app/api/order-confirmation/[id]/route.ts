import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const SAFE_FIELDS =
  "id,customer_name,phone,address,notes,box_size_id,flavours,delivery_date,delivery_slot,batch_label,total_price,status";

function mapFromNotes(notes: string | null) {
  return notes?.match(/Customer map:\s*(https?:\/\/\S+)/i)?.[1] || "";
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const db = supabaseAdmin();
  const [{ data: order, error }, { data: products }, { data: boxes }] = await Promise.all([
    db.from("orders").select(SAFE_FIELDS).eq("id", params.id).single(),
    db.from("products").select("id,name,is_available,sort_order").eq("is_available", true).order("sort_order"),
    db.from("box_sizes").select("id,label,count,is_active,sort_order").eq("is_active", true).order("sort_order"),
  ]);

  if (error || !order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  return NextResponse.json({ order: { ...order, customer_maps_url: mapFromNotes(order.notes) }, products: products || [], boxes: boxes || [] });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const customerName = String(body.customer_name || "").trim();
  const deliveryDate = String(body.delivery_date || "").trim();
  const deliverySlot = String(body.delivery_slot || "").trim();

  if (!customerName || !deliveryDate || !deliverySlot) {
    return NextResponse.json({ error: "Name, date and time are required" }, { status: 400 });
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
  const { data, error } = await db
    .from("orders")
    .update({
      customer_name: customerName,
      phone: String(body.phone || "").trim(),
      address: String(body.address || "").trim() || null,
      notes: mapsUrl ? `Customer map: ${mapsUrl}` : null,
      box_size_id: body.box_size_id || null,
      flavours: cleanFlavours,
      delivery_date: deliveryDate,
      delivery_slot: deliverySlot,
    })
    .eq("id", params.id)
    .select(SAFE_FIELDS)
    .single();

  if (error || !data) {
    console.error("Order confirmation update failed", error);
    return NextResponse.json({ error: "Could not save your details" }, { status: 500 });
  }
  return NextResponse.json({ order: { ...data, customer_maps_url: mapFromNotes(data.notes) } });
}
