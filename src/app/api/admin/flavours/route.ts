import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const POMEGRANATE_ID = "00000000-0000-4000-8000-000000000017";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const name = String(body.name || "").trim();
  if (!name || name.length>100 || /[%_]/.test(name)) return NextResponse.json({ error: "Enter a flavour name" }, { status: 400 });
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

export async function PATCH(req:NextRequest){
 const body=await req.json();
 if(typeof body.id!=="string"||!body.id)return NextResponse.json({error:"Flavour ID is required"},{status:400});
 const values:Record<string,unknown>={};
 if(typeof body.is_available==="boolean")values.is_available=body.is_available;
 if(typeof body.name==="string"){const name=body.name.trim();if(!name||name.length>100||/[%_]/.test(name))return NextResponse.json({error:"Enter a name of 1–100 characters without % or _"},{status:400});const {data:duplicate,error}=await supabaseAdmin().from("products").select("id").ilike("name",name).neq("id",body.id).limit(1);if(error)return NextResponse.json({error:"Could not check flavour name"},{status:500});if(duplicate?.length)return NextResponse.json({error:"Another flavour already uses that name"},{status:409});values.name=name;}
 if(body.image_url!==undefined){const url=String(body.image_url||"").trim();if(url){try{if(new URL(url).protocol!=="https:")throw Error()}catch{return NextResponse.json({error:"Use a complete HTTPS image URL"},{status:400})}}values.image_url=url||null;}
 if(!Object.keys(values).length)return NextResponse.json({error:"No changes supplied"},{status:400});
 const {data,error}=await supabaseAdmin().from("products").update(values).eq("id",body.id).select("*").single();
 if(error)return NextResponse.json({error:"Could not update flavour"},{status:500});return NextResponse.json({product:data});
}
