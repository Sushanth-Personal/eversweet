import {NextResponse} from "next/server";
import {supabaseAdmin} from "@/lib/supabase";
export async function GET(){
 const db=supabaseAdmin();
 const [{data:products,error:productError},{data:boxes,error:boxError}]=await Promise.all([
  db.from("products").select("id,name,is_available,is_premium,image_url").eq("is_available",true).order("name"),
  db.from("box_sizes").select("id,label,count,price,is_active").eq("is_active",true).order("count")
 ]);
 if(productError||boxError)return NextResponse.json({error:"Could not load catalogue"},{status:503});
 return NextResponse.json({products:products||[],boxes:boxes||[]});
}
export async function POST(){
 return NextResponse.json({error:"Please ask Eversweet for your personal order link. New orders are created by Eversweet."},{status:410});
}
