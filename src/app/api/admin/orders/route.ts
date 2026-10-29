import { NextRequest, NextResponse } from "next/server";
import { deliveryDateError } from "@/lib/delivery-date";
import { boxValues } from "@/lib/admin-boxes";
import { replaceNote } from "@/lib/order-draft";
import { supabaseAdmin } from "@/lib/supabase";
import { instagramUrl } from "@/lib/order-contacts";

function payload(body: Record<string, unknown>) {
  const mapUrl = String(body.customer_maps_url || "").trim();
  return {
    customer_name: String(body.customer_name || "").trim(),
    phone: String(body.phone || "").trim(),
    address: String(body.address || "").trim() || null,
    notes: mapUrl ? `Customer map: ${mapUrl}` : null,
    delivery_date: body.delivery_date || null,
    delivery_slot: body.location === "trivandrum" ? null : body.delivery_slot || null,
    box_size_id: body.box_size_id || null,
    flavours: body.flavours || {},
    source: body.location === "trivandrum" ? "trivandrum" : body.location === "kozhikode" ? "kozhikode" : "kochi",
    fulfillment_type:
      body.fulfillment_type === "pickup" ? "pickup" : "delivery",
    status: body.status || "confirmed",
    total_price: Number(body.total_price || 0),
    insta_id: instagramUrl(String(body.insta_id || "")),
    remarks: String(body.remarks || "").trim(),
  };
}

async function validatePlan(body: any) {
  if (body.box_selections === undefined) return "";
  if (!Array.isArray(body.box_selections) || body.box_selections.length > 100)
    return "Invalid boxes";
  const { data: boxes, error } = await supabaseAdmin()
    .from("box_sizes")
    .select("id");
  if (error) return "Could not verify box sizes";
  for (const b of body.box_selections) {
    if (
      !b ||
      typeof b.box_size_id !== "string" ||
      (b.box_size_id && !boxes?.some((x) => x.id === b.box_size_id)) ||
      !b.flavours ||
      typeof b.flavours !== "object" ||
      Array.isArray(b.flavours) ||
      Object.values(b.flavours).some(
        (n) => !Number.isSafeInteger(n) || Number(n) < 0 || Number(n) > 100,
      )
    )
      return "Invalid box or flavour quantity";
  }
  return "";
}
export async function POST(req: NextRequest) {
  const body = await req.json();
  const planError = await validatePlan(body);
  if (planError)
    return NextResponse.json({ error: planError }, { status: 400 });
  const values = payload(body);
  values.status = body.link_draft === true ? "draft" : "confirmed";
  if (body.box_selections)
    Object.assign(values, boxValues(body.box_selections, values.notes));
  const linkCreatedAt = new Date();
  const dateError = await deliveryDateError(
    values.source,
    values.delivery_date,
  );
  if (dateError)
    return NextResponse.json({ error: dateError }, { status: 400 });
  const id = String(body.id || "");
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    )
  )
    return NextResponse.json(
      { error: "Invalid creation ID. Reopen Add order." },
      { status: 400 },
    );
  const db = supabaseAdmin();
  const { error } = await db
    .from("orders")
    .upsert(
      {
        ...values,
        ...(body.link_draft === true ? {created_at:linkCreatedAt.toISOString()} : {}),
        id,
        customer_name: values.customer_name || "Customer details pending",
        payment_method: "admin",
      },
      { onConflict: "id", ignoreDuplicates: true },
    );
  const { data, error: readError } = await db
    .from("orders")
    .select("*")
    .eq("id", id)
    .single();
  if (readError)
    return NextResponse.json(
      { error: "Could not retrieve order. Retry with the same form." },
      { status: 500 },
    );
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ order: data });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  if (body.insta_id && !instagramUrl(String(body.insta_id))) return NextResponse.json({error:"Enter a valid Instagram username or profile link."},{status:400});
  if (!body.id)
    return NextResponse.json(
      { error: "Order ID is required" },
      { status: 400 },
    );
  if (body.action === "dispatch") {
    const { error } = await supabaseAdmin().rpc("production_action", {
      p_action: "dispatch",
      p_order_id: String(body.id),
    });
    if (error) {
      console.error("Could not mark order as dispatched", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({
      order: { id: String(body.id), status: "dispatched" },
    });
  }
  const { data: existing } = await supabaseAdmin()
    .from("orders")
    .select("*")
    .eq("id", body.id)
    .single();
  const planError = await validatePlan(body);
  if (planError)
    return NextResponse.json({ error: planError }, { status: 400 });
  const values = payload({ ...existing, location: existing?.source, customer_maps_url: existing?.notes?.match(/Customer map: ([^|]*)/)?.[1]?.trim(), ...body });
  const { data: current } = await supabaseAdmin()
    .from("orders")
    .select("status")
    .eq("id", body.id)
    .single();
  if (!current)
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  values.status = current.status;
  values.notes = replaceNote(
    existing?.notes,
    "Customer map",
    String(body.customer_maps_url === undefined ? existing?.notes?.match(/Customer map: ([^|]*)/)?.[1] || "" : body.customer_maps_url).trim(),
  );
  if (["complete", "incomplete", "auto"].includes(body.details_status))
    values.notes = replaceNote(
      values.notes,
      "Details status",
      body.details_status === "auto" ? "" : body.details_status,
    );
  if (body.box_selections)
    Object.assign(values, boxValues(body.box_selections, values.notes));
  if (!values.customer_name) values.customer_name = "Customer details pending";
  // Never write fields copied from an earlier read. Two overlapping autosaves
  // (or another browser) must not erase a newly saved Instagram link.
  const changedColumns: Record<string, unknown> = {};
  const fields: Record<string, string> = {
    customer_name: "customer_name", phone: "phone", address: "address",
    delivery_date: "delivery_date", delivery_slot: "delivery_slot",
    box_size_id: "box_size_id", flavours: "flavours", location: "source",
    fulfillment_type: "fulfillment_type", total_price: "total_price",
    insta_id: "insta_id", remarks: "remarks",
  };
  for (const [input, column] of Object.entries(fields)) {
    if (Object.prototype.hasOwnProperty.call(body, input)) changedColumns[column] = values[column as keyof typeof values];
  }
  if (body.customer_maps_url !== undefined || body.details_status !== undefined || body.box_selections !== undefined) changedColumns.notes = values.notes;
  if (body.box_selections !== undefined) {
    changedColumns.box_size_id = values.box_size_id;
    changedColumns.flavours = values.flavours;
  }
  if (body.location === "trivandrum") changedColumns.delivery_slot = null;
  if (!Object.keys(changedColumns).length) return NextResponse.json({ order: existing });
  const { data, error } = await supabaseAdmin()
    .from("orders")
    .update(changedColumns)
    .eq("id", body.id)
    .select("*")
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  if (body.insta_id !== undefined && instagramUrl(data?.insta_id) !== values.insta_id)
    return NextResponse.json({error:"Instagram could not be verified after saving. Please retry."},{status:409});
  return NextResponse.json({ order: data });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json();
  if (!body.id)
    return NextResponse.json(
      { error: "Order ID is required" },
      { status: 400 },
    );
  const db = supabaseAdmin();
  const { error: cancelError } = await db.rpc("production_action", {
    p_action: "cancel_order", p_order_id: String(body.id),
  });
  if (!cancelError) return NextResponse.json({ deleted: true });
  // Compatibility for projects that have not applied the latest workflow SQL.
  if (cancelError.code !== "PGRST202" && !/Unknown production action/i.test(cancelError.message))
    return NextResponse.json({ error: cancelError.message }, { status: 409 });
  const { error, count } = await db
    .from("orders")
    .update({ status: "cancelled" }, { count: "exact" })
    .eq("id", String(body.id));
  if (error) {
    console.error("Could not delete order", error);
    return NextResponse.json({ error: /Unpack/i.test(error.message) ? "This order has reserved pieces. Apply the latest workflow SQL to delete it directly, or undo preparation/unpack it first." : error.message }, { status: 409 });
  }
  if (count === 0)
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
