import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const POMEGRANATE_ID = "00000000-0000-4000-8000-000000000017";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Enter a flavour name" }, { status: 400 });
  const db = supabaseAdmin();
  const { data: existing } = await db.from("products").select("id").ilike("name", name).maybeSingle();
  if (existing) {
    const { data, error } = await db.from("products").update({ is_available: true }).eq("id", existing.id).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ product: data });
  }
  const { data: last } = await db.from("products").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const values = { name, description: "", price: 0, image_url: null, category: "mochi", is_available: true, is_premium: false, sort_order: Number(last?.sort_order || 0) + 1 };
  const { data, error } = await db.from("products").insert(values).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ product: data });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const id = String(body.id || "");
  const name = String(body.name || "").trim();
  if (!id) return NextResponse.json({ error: "Flavour ID is required" }, { status: 400 });
  const db = supabaseAdmin();
  let result = await db.from("products").update({ is_available: false }, { count: "exact" }).eq("id", id);
  if (!result.error && result.count === 0 && id === POMEGRANATE_ID) {
    result = await db.from("products").insert({ id: POMEGRANATE_ID, name: name || "Pomegranate", description: "", price: 0, image_url: null, category: "mochi", is_available: false, is_premium: false, sort_order: 17 });
  }
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  return NextResponse.json({ removed: true });
}
