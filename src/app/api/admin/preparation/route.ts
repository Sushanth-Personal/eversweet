import {NextRequest,NextResponse} from "next/server";
import {supabaseAdmin} from "@/lib/supabase";
export const dynamic="force-dynamic";
function validDate(d:unknown){return typeof d==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d))}
export async function GET(req:NextRequest){
 const date=req.nextUrl.searchParams.get("date");if(!validDate(date))return NextResponse.json({error:"Invalid date"},{status:400});
 const {data,error}=await supabaseAdmin().from("preparation_progress").select("city,flavour_id,finished").eq("delivery_date",date);
 if(error)return NextResponse.json({error:"Could not load preparation progress. Apply the preparation_progress SQL migration."},{status:503});
 return NextResponse.json({progress:data||[]});
}
export async function PUT(req:NextRequest){
 const body=await req.json();
 if(Array.isArray(body.entries)){
 if(!validDate(body.date)||!body.entries.length||body.entries.length>2||new Set(body.entries.map((r:any)=>r.city)).size!==body.entries.length||body.entries.some((r:any)=>!["kochi","trivandrum"].includes(r.city)||typeof r.flavour_id!=="string"||!r.flavour_id||r.flavour_id.length>200||!Number.isSafeInteger(r.finished)||r.finished<0||r.finished>100000))return NextResponse.json({error:"Invalid preparation counts"},{status:400});
 const {error}=await supabaseAdmin().from("preparation_progress").upsert(body.entries.map((r:any)=>({delivery_date:body.date,city:r.city,flavour_id:r.flavour_id,finished:r.finished})),{onConflict:"delivery_date,city,flavour_id"});
 if(error)return NextResponse.json({error:"Could not save. Please try again."},{status:500});
 return NextResponse.json({entries:body.entries});
 }
 const b=body;if(!validDate(b.date)||!["kochi","trivandrum"].includes(b.city)||typeof b.flavour_id!=="string"||!b.flavour_id||b.flavour_id.length>200||!Number.isSafeInteger(b.finished)||b.finished<0||b.finished>100000)return NextResponse.json({error:"Invalid preparation count"},{status:400});
 const {error}=await supabaseAdmin().from("preparation_progress").upsert({delivery_date:b.date,city:b.city,flavour_id:b.flavour_id,finished:b.finished},{onConflict:"delivery_date,city,flavour_id"});
 if(error)return NextResponse.json({error:"Could not save preparation count. Please try again."},{status:500});
 return NextResponse.json({finished:b.finished});
}
