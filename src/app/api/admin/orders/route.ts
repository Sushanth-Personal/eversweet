import { NextRequest, NextResponse } from "next/server";
import {boxValues} from "@/lib/admin-boxes";
import { replaceNote } from "@/lib/order-draft";
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

async function validatePlan(body:any){
 if(body.box_selections===undefined)return "";
 if(!Array.isArray(body.box_selections)||body.box_selections.length>100)return "Invalid boxes";
 const {data:boxes,error}=await supabaseAdmin().from("box_sizes").select("id");
 if(error)return "Could not verify box sizes";
 for(const b of body.box_selections){if(!b||typeof b.box_size_id!=="string"||(b.box_size_id&&!boxes?.some(x=>x.id===b.box_size_id))||!b.flavours||typeof b.flavours!=="object"||Array.isArray(b.flavours)||Object.values(b.flavours).some(n=>!Number.isSafeInteger(n)||Number(n)<0||Number(n)>100))return "Invalid box or flavour quantity"}
 return "";
}
export async function POST(req: NextRequest) {
  const body = await req.json();
  const planError=await validatePlan(body);if(planError)return NextResponse.json({error:planError},{status:400});
  const values = payload(body);
  if(body.box_selections)Object.assign(values,boxValues(body.box_selections,values.notes));
  if (!values.customer_name || !values.phone || !values.delivery_date || !values.delivery_slot) return NextResponse.json({ error: "Name, phone, date and time are required" }, { status: 400 });
  const { data, error } = await supabaseAdmin().from("orders").insert({ ...values, payment_method: "admin", payment_confirmed_at: new Date().toISOString() }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ order: data });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
  if (body.action === "dispatch") {
    const { error, count } = await supabaseAdmin()
      .from("orders")
      .update({ status: "dispatched" }, { count: "exact" })
      .eq("id", String(body.id));
    if (error) {
      console.error("Could not mark order as dispatched", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (count === 0) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    return NextResponse.json({ order: { id: String(body.id), status: "dispatched" } });
  }
  const {data:existing}=await supabaseAdmin().from("orders").select("notes").eq("id",body.id).single();
  const planError=await validatePlan(body);if(planError)return NextResponse.json({error:planError},{status:400});
  const values = payload(body);
  values.notes=replaceNote(existing?.notes,"Customer map",String(body.customer_maps_url||"").trim());
  if(["complete","incomplete","auto"].includes(body.details_status))values.notes=replaceNote(values.notes,"Details status",body.details_status==="auto"?"":body.details_status);
  if(body.box_selections)Object.assign(values,boxValues(body.box_selections,values.notes));
  if (!values.customer_name || !values.phone) return NextResponse.json({ error: "Name and phone are required" }, { status: 400 });
  const { data, error } = await supabaseAdmin().from("orders").update(values).eq("id", body.id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ order: data });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
  const { error, count } = await supabaseAdmin()
    .from("orders")
    .update({ status: "cancelled" }, { count: "exact" })
    .eq("id", String(body.id));
  if (error) {
    console.error("Could not delete order", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (count === 0) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
