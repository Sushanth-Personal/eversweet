import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const items = Array.isArray(body) ? body : body.orders;
    if (!Array.isArray(items)) {
      return NextResponse.json(
        { error: "Expected array of orders" },
        { status: 400 },
      );
    }

    const db = supabaseAdmin();

    // Look up box_size_id from label
    const { data: boxes } = await db
      .from("box_sizes")
      .select("id, label, count, price");
    const boxMap: Record<string, { id: string; count: number; price: number }> =
      {};
    boxes?.forEach((b) => {
      boxMap[b.label.toLowerCase().trim()] = {
        id: b.id,
        count: b.count,
        price: b.price,
      };
    });

    const valid = [];
    const skipped = [];

    for (const item of items) {
      if (!item.customer_name) {
        skipped.push("missing customer_name");
        continue;
      }

      const boxLabel = (item.box_size_label || "").toLowerCase().trim();
      const box = boxMap[boxLabel];

      valid.push({
        customer_name: String(item.customer_name).trim(),
        phone: String(item.phone || "").trim(),
        insta_id: String(item.insta_id || "").trim(),
        address: String(item.address || "").trim() || null,
        dob: String(item.dob || "").trim() || null,
        remarks: String(item.remarks || "").trim(),
        box_size_id: box?.id || null,
        flavours: item.flavours || {},
        delivery_date: item.order_date || item.delivery_date || null,
        delivery_batch: item.delivery_batch || null,
        payment_method: item.payment_method || "upi",
        total_price: Number(item.total_price) || box?.price || 0,
        status: item.status || "dispatched",
        source: item.source || "dm",
        notes: String(item.notes || "").trim() || null,
        order_date: item.order_date || new Date().toISOString().split("T")[0],
      });
    }

    if (valid.length === 0) {
      return NextResponse.json(
        { error: "No valid orders to import", skipped },
        { status: 400 },
      );
    }

    const { data, error } = await db.from("orders").insert(valid).select("id");
    if (error) throw error;

    return NextResponse.json({
      success: true,
      imported: data?.length || valid.length,
      skipped: skipped.length,
    });
  } catch (err) {
    console.error("Import orders error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
