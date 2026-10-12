import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { deliveryDateError } from "@/lib/delivery-date";
import { layout, mapLink, replaceNote, type Selection } from "@/lib/order-draft";

const FIELDS="source,id,customer_name,phone,address,notes,box_size_id,flavours,delivery_date,delivery_slot,batch_label,total_price,status,created_at";
export async function GET(_:NextRequest,{params}:{params:{id:string}}) {
 const db=supabaseAdmin();
 const [{data:order,error},{data:products},{data:boxes}]=await Promise.all([
 db.from("orders").select(FIELDS).eq("id",params.id).single(),
 db.from("products").select("id,name,is_available").order("name"),
 db.from("box_sizes").select("id,label,count,is_active").order("count")]);
 if(error||!order||order.status==="cancelled")return NextResponse.json({error:"Order not found"},{status:404});
 return NextResponse.json({order:{...order,customer_maps_url:mapLink(order.notes),box_selections:layout(order.notes)},products:products||[],boxes:boxes||[]});
}
export async function PATCH(req:NextRequest,{params}:{params:{id:string}}) {
 const body=await req.json(),db=supabaseAdmin();
 const {data:old}=await db.from("orders").select(FIELDS).eq("id",params.id).single();
 if(!old||old.status==="cancelled")return NextResponse.json({error:"Order not found"},{status:404});
 const dateError=await deliveryDateError(body.location,body.delivery_date,old);
 if(dateError)return NextResponse.json({error:dateError},{status:400});
 if(old.status==="dispatched")return NextResponse.json({error:"This order has already been dispatched. Please contact Eversweet."},{status:409});
 const name=String(body.customer_name||"").trim(),phone=String(body.phone||"").trim();
 if(!name||!phone)return NextResponse.json({error:"Name and phone number are required"},{status:400});
 const map=String(body.customer_maps_url||"").trim();
 if(map&&!/^https?:\/\//i.test(map))return NextResponse.json({error:"Please enter a complete map link"},{status:400});
 if(!Array.isArray(body.box_selections)||body.box_selections.length>100)return NextResponse.json({error:"Invalid boxes"},{status:400});
 const {data:boxes,error:boxError}=await db.from("box_sizes").select("id,count,price");
 if(boxError)return NextResponse.json({error:"Could not check box sizes"},{status:500});
 const plan:Selection[]=body.box_selections;
 const totals:Record<string,number>={};let price=0;
 for(const box of plan){
 const size=boxes?.find(b=>b.id===box?.box_size_id);
 if(!size||!box.flavours||typeof box.flavours!=="object"||Array.isArray(box.flavours))return NextResponse.json({error:"Invalid box details"},{status:400});
 for(const [id,n] of Object.entries(box.flavours)){if(!Number.isSafeInteger(n)||n<0||n>100)return NextResponse.json({error:"Invalid flavour quantity"},{status:400});totals[id]=(totals[id]||0)+n;}
 price+=Number(size.price||0);
 }
 let notes=replaceNote(old.notes,"Customer map",map);
 notes=replaceNote(notes,"Box layout",encodeURIComponent(JSON.stringify(plan)));
 notes=replaceNote(notes,"Box quantity",String(plan.length));
 const {data,error}=await db.from("orders").update({source:body.location==="trivandrum"?"trivandrum":"kochi",customer_name:name,phone,address:String(body.address||"").trim()||null,delivery_date:body.delivery_date||null,delivery_slot:body.delivery_slot||null,notes,box_size_id:plan[0]?.box_size_id||null,flavours:totals,total_price:price}).eq("id",params.id).neq("status","cancelled").neq("status","dispatched").select(FIELDS).single();
 if(error)return NextResponse.json({error:"Could not save your changes. Please try again."},{status:500});
 return NextResponse.json({order:data});
}
