import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { deliveryDateError } from "@/lib/delivery-date";

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
  const dateError=await deliveryDateError(body.location,body.delivery_date);
  if(dateError)return NextResponse.json({error:dateError},{status:400});
  const customer_name = String(body.customer_name || "").trim();
  const phone = String(body.phone || "").trim();
  if (!customer_name || !phone) return NextResponse.json({error:"Please enter your name and phone number"}, {status:400});
  // A client-generated UUID makes retrying the first save idempotent.
  const id = String(body.id || "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return NextResponse.json({error:"Invalid draft ID"}, {status:400});
  const db = supabaseAdmin();
  const {error} = await db.from("orders").upsert({id, customer_name, phone, status:"confirmed", source:body.location==="trivandrum"?"trivandrum":"kochi", delivery_date:body.delivery_date||null, fulfillment_type:"delivery", flavours:{}, total_price:0}, {onConflict:"id",ignoreDuplicates:true});
  if(error) return NextResponse.json({error:"Could not save your details. Please try again."},{status:500});
  return NextResponse.json({id});
}
