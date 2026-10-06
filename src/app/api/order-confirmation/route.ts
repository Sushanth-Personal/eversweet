import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const db = supabaseAdmin();
  const [{ data: products }, { data: boxes }] = await Promise.all([
    db.from("products").select("id,name,is_available,sort_order").order("sort_order"),
    db.from("box_sizes").select("id,label,count,price,is_active,sort_order").eq("is_active", true).order("sort_order"),
  ]);
  const allProducts = [...(products || [])];
  const availableProducts = allProducts.filter((product) => product.is_available);
  if (!allProducts.some((product) => product.name.toLowerCase() === "pomegranate")) {
    availableProducts.push({ id: "00000000-0000-4000-8000-000000000017", name: "Pomegranate", is_available: true, sort_order: 17 });
  }
  return NextResponse.json({ products: availableProducts, boxes: boxes || [] });
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

  const db = supabaseAdmin();
  const selections: Array<{ box_size_id?: unknown; flavours?: Record<string, unknown> }> = Array.isArray(body.box_selections) ? body.box_selections : [];
  if (!selections.length) return NextResponse.json({ error: "Please add and complete at least one box" }, { status: 400 });
  const boxIds = selections.map((selection) => String(selection?.box_size_id || "")).filter(Boolean);
  const { data: selectedBoxes } = await db.from("box_sizes").select("id,count,price").in("id", boxIds);
  const boxMap = new Map((selectedBoxes || []).map((box) => [box.id, box]));
  const cleanSelections: Array<{ box_size_id: string; flavours: Record<string, number> }> = selections.map((selection) => ({
    box_size_id: String(selection?.box_size_id || ""),
    flavours: Object.fromEntries(Object.entries(selection?.flavours && typeof selection.flavours === "object" ? selection.flavours : {}).map(([key, value]) => [key, Math.max(0, Math.floor(Number(value) || 0))]).filter(([, value]) => Number(value) > 0)) as Record<string, number>,
  }));
  const invalid = cleanSelections.some((selection) => !boxMap.has(selection.box_size_id) || Object.values(selection.flavours).reduce((sum, quantity) => sum + Number(quantity), 0) !== Number(boxMap.get(selection.box_size_id)?.count || 0));
  if (invalid) return NextResponse.json({ error: "Please fill every box with the correct number of flavours" }, { status: 400 });
  const cleanFlavours = cleanSelections.reduce<Record<string, number>>((all, selection) => { Object.entries(selection.flavours).forEach(([id, quantity]) => { all[id] = (all[id] || 0) + Number(quantity); }); return all; }, {});
  const totalPrice = cleanSelections.reduce((sum, selection) => sum + Number(boxMap.get(selection.box_size_id)?.price || 0), 0);
  const boxLayout = encodeURIComponent(JSON.stringify(cleanSelections));

  const { data, error } = await db.from("orders").insert({
    customer_name: customerName,
    phone,
    address: String(body.address || "").trim() || null,
    notes: [`Box quantity: ${cleanSelections.length}`, `Box layout: ${boxLayout}`, mapsUrl ? `Customer map: ${mapsUrl}` : ""].filter(Boolean).join(" | "),
    box_size_id: cleanSelections[0]?.box_size_id || null,
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
