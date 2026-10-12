import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
export const dynamic = "force-dynamic";
export async function GET() {
  const {data,error}=await supabaseAdmin().from("delivery_dates").select("date").order("date");
  if(error)return NextResponse.json({error:"Delivery dates are not configured. Run the delivery_dates database migration."},{status:503});
  return NextResponse.json({dates:(data||[]).map(row=>row.date)});
}
export async function POST(req:NextRequest) {
  const {date,remove}=await req.json();
  if(typeof date!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date)))return NextResponse.json({error:"Choose a valid date"},{status:400});
  const db=supabaseAdmin();
  const {error}=remove?await db.from("delivery_dates").delete().eq("date",date):await db.from("delivery_dates").upsert({date},{onConflict:"date"});
  if(error)return NextResponse.json({error:"Could not save delivery dates. Check the database migration."},{status:500});
  return GET();
}
