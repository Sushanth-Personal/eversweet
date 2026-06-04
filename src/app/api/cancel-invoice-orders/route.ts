// src/app/api/cancel-invoice-orders/route.ts
// Call this via a cron job at midnight IST (18:30 UTC)
// Set up in Vercel: Settings → Cron Jobs → "0 18 * * *" → /api/cancel-invoice-orders

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const db = supabaseAdmin();

  // Get today's date in IST
  const now = new Date();
  const istMs = now.getTime() + 5.5 * 3600000;
  const istToday = new Date(istMs).toISOString().split("T")[0];

  // Cancel all pending invoice orders created today that are still unconfirmed
  const { data, error } = await db
    .from("orders")
    .update({ status: "cancelled" })
    .eq("status", "pending")
    .eq("order_date", istToday)
    .like("notes", "Auto-created invoice%")
    .select("id, customer_name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    cancelled: data?.length || 0,
    orders: data?.map((o) => o.customer_name),
  });
}
