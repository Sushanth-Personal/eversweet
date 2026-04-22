import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      customer_name,
      phone,
      address,
      dob,
      notes,
      box_size_id,
      flavours,
      delivery_date,
      delivery_batch,
      batch_id,
      payment_method,
      total_price,
    } = body;

    if (!customer_name || !phone || !box_size_id) {
      return NextResponse.json(
        { error: "Missing required fields: name, phone, box size" },
        { status: 400 },
      );
    }

    const db = supabaseAdmin();

    // Check batch capacity if batch_id provided
    let batchLabel = delivery_batch || "";
    if (batch_id) {
      const { data: batch, error: batchErr } = await db
        .from("batches")
        .select(
          "max_orders, current_orders, label, delivery_date, is_active, batch_key",
        )
        .eq("id", batch_id)
        .single();

      if (batchErr || !batch) {
        return NextResponse.json({ error: "Invalid batch" }, { status: 400 });
      }
      if (!batch.is_active || batch.current_orders >= batch.max_orders) {
        return NextResponse.json(
          { error: "This batch is full. Please choose another." },
          { status: 409 },
        );
      }
      batchLabel = `${batch.label} · ${new Date(batch.delivery_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;

      // Increment batch count
      await db
        .from("batches")
        .update({ current_orders: batch.current_orders + 1 })
        .eq("id", batch_id);
    }

    // Get box details
    const { data: box } = await db
      .from("box_sizes")
      .select("label, count, price")
      .eq("id", box_size_id)
      .single();

    // Save order
    const { data: order, error: orderErr } = await db
      .from("orders")
      .insert({
        customer_name,
        phone,
        address: address || null,
        dob: dob || null,
        notes: notes || null,
        box_size_id,
        flavours,
        delivery_date: delivery_date || null,
        delivery_batch: delivery_batch || null,
        payment_method,
        total_price,
        status: "pending",
        source: "website",
      })
      .select()
      .single();

    if (orderErr || !order) {
      console.error("Order insert error:", orderErr);
      return NextResponse.json(
        { error: "Failed to save order" },
        { status: 500 },
      );
    }

    // Build flavour list for email
    const flavourLines = Object.entries(flavours as Record<string, number>)
      .map(([id, qty]) => `  • ${id}: ${qty}`)
      .join("\n");

    // Send email notification
    try {
      await resend.emails.send({
        from: "Eversweet <onboarding@resend.dev>",
        to: process.env.ADMIN_EMAIL!,
        subject: `🍡 New Order — ${customer_name} (₹${total_price})`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; color: #222;">
            <h2 style="color: #c9a84c;">🍡 New Eversweet Order</h2>
            <hr style="border-color: #eee;" />
            <p><strong>Name:</strong> ${customer_name}</p>
            <p><strong>Phone:</strong> ${phone}</p>
            <p><strong>Address:</strong> ${address || "—"}</p>
            <p><strong>DOB:</strong> ${dob || "—"}</p>
            <p><strong>Box:</strong> ${box?.label || box_size_id} (${box?.count} pieces)</p>
            <p><strong>Delivery:</strong> ${delivery_date || "—"} · ${batchLabel || delivery_batch || "—"}</p>
            <p><strong>Total:</strong> ₹${total_price}</p>
            <p><strong>Payment:</strong> ${payment_method}</p>
            <pre style="background:#f5f5f5;padding:10px;border-radius:4px;">${flavourLines}</pre>
            ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ""}
            <hr style="border-color: #eee;" />
            <p style="font-size:12px;color:#999;">Order ID: ${order.id}</p>
          </div>
        `,
      });
    } catch (emailErr) {
      console.error("Email send failed:", emailErr);
    }

    return NextResponse.json({ success: true, order_id: order.id });
  } catch (err) {
    console.error("Order API error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
