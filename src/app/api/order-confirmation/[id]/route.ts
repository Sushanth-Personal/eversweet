import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import {deliveryDateError} from "@/lib/delivery-date";
import { customerOrderLock, fixedOrderDetailsError } from "@/lib/customer-order";
import { layout, mapLink, replaceNote, type Selection } from "@/lib/order-draft";

const FIELDS="source,id,customer_name,phone,address,notes,box_size_id,flavours,delivery_date,delivery_slot,batch_label,total_price,status,created_at";
export async function GET(_:NextRequest,{params}:{params:{id:string}}) {
 const db=supabaseAdmin();
 const [{data:order,error},{data:products,error:productError},{data:boxes,error:boxError}]=await Promise.all([
 db.from("orders").select(FIELDS).eq("id",params.id).single(),
 db.from("products").select("id,name,is_available,is_premium,image_url").order("name"),
 db.from("box_sizes").select("id,label,count,is_active").order("count")]);
 if(error||!order||order.status==="cancelled")return NextResponse.json({error:"Order not found"},{status:404});
 if(productError||boxError)return NextResponse.json({error:"Could not load the flavour catalogue. Please try again."},{status:503});
 const catalogue=[...(products||[])];for(const id of Object.keys(order.flavours||{})){if(!catalogue.some(p=>p.id===id))catalogue.push({id,name:"Unavailable flavour — contact Eversweet",is_available:false,is_premium:false,image_url:null});}
 return NextResponse.json({locked:customerOrderLock(order),order:{...order,customer_maps_url:mapLink(order.notes),box_selections:layout(order.notes)},products:catalogue,boxes:boxes||[]});
}
export async function PATCH(req:NextRequest,{params}:{params:{id:string}}) {
 const body=await req.json(),db=supabaseAdmin();
 const {data:old}=await db.from("orders").select(FIELDS).eq("id",params.id).single();
 if(!old||old.status==="cancelled")return NextResponse.json({error:"Order not found"},{status:404});
 const dateError=customerOrderLock(old)||fixedOrderDetailsError(old,body)||(!old.delivery_date?await deliveryDateError(body.location,body.delivery_date):"");
 if(dateError)return NextResponse.json({error:dateError},{status:409});
 if(old.status==="dispatched")return NextResponse.json({error:"This order has already been dispatched. Please contact Eversweet."},{status:409});
 const name=String(body.customer_name||"").trim(),rawPhone=String(body.phone||"").trim();
 const phone=rawPhone.replace(/[\s()-]/g, "").replace(/^\+91/, "");
 if(!/^\d{10}$/.test(phone))return NextResponse.json({error:"Please enter a complete 10-digit phone number."},{status:400});
 if(!name||!phone)return NextResponse.json({error:"Name and phone number are required"},{status:400});
 const map=String(body.customer_maps_url||"").trim();
 if(map&&!/^https?:\/\//i.test(map))return NextResponse.json({error:"Please enter a complete map link"},{status:400});
 if(!Array.isArray(body.box_selections)||body.box_selections.length>100)return NextResponse.json({error:"Invalid boxes"},{status:400});
 const {data:boxes,error:boxError}=await db.from("box_sizes").select("id,count,price,is_active");
 if(boxError)return NextResponse.json({error:"Could not check box sizes"},{status:500});
 const {data:products,error:productError}=await db.from("products").select("id,is_available");
 if(productError)return NextResponse.json({error:"Could not check flavours"},{status:503});
 const plan:Selection[]=body.box_selections;
 const totals:Record<string,number>={};
 for(const box of plan){
 const size=boxes?.find(b=>b.id===box?.box_size_id);
 if(!size||!box.flavours||typeof box.flavours!=="object"||Array.isArray(box.flavours))return NextResponse.json({error:"Invalid box details"},{status:400});
 if(Object.values(box.flavours).reduce((sum,n)=>sum+Number(n),0)>size.count)return NextResponse.json({error:"Too many pieces in a box"},{status:400});
 if(!size.is_active&&!layout(old.notes).some(b=>b.box_size_id===size.id)&&old.box_size_id!==size.id)return NextResponse.json({error:"This box is no longer available"},{status:400});
 for(const [id,n] of Object.entries(box.flavours)){const product=products?.find(p=>p.id===id);if(n>0&&(!product||!product.is_available)&&((totals[id]||0)+n)>Number(old.flavours?.[id]||0))return NextResponse.json({error:"A selected flavour is no longer available. Please contact Eversweet."},{status:400});if(!Number.isSafeInteger(n)||n<0||n>100)return NextResponse.json({error:"Invalid flavour quantity"},{status:400});totals[id]=(totals[id]||0)+n;}

 }
 let notes=replaceNote(old.notes,"Customer map",map);
 notes=replaceNote(notes,"Box layout",encodeURIComponent(JSON.stringify(plan)));
 notes=replaceNote(notes,"Box quantity",String(plan.length));
 let query=db.from("orders").update({...(!old.delivery_date?{delivery_date:body.delivery_date||null,source:body.location==="trivandrum"?"trivandrum":"kochi"}:{}),customer_name:name,phone,address:String(body.address||"").trim()||null,delivery_slot:body.delivery_slot||null,notes,box_size_id:plan[0]?.box_size_id||null,flavours:totals,total_price:old.total_price}).eq("id",params.id).neq("status","cancelled").neq("status","dispatched").select(FIELDS);
 query=old.delivery_date?query.eq("delivery_date",old.delivery_date):query.is("delivery_date",null);
 query=old.source===null?query.is("source",null):query.eq("source",old.source);
 const {data,error}=await query.single();
 if(error)return NextResponse.json({error:"Could not save your changes. Please try again."},{status:500});
 return NextResponse.json({order:data});
}
