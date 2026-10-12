import {supabaseAdmin} from "@/lib/supabase";
export async function deliveryDateError(location:unknown,date:unknown,previous?:{source?:string;delivery_date?:string}) {
 if(!date)return "";
 if(typeof date!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date)))return "Choose a valid date";
 if(previous?.delivery_date===date&&previous?.source===location)return "";
 const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata"}).format(new Date());
 if(date<today)return "Choose today or a future date";
 if(location==="trivandrum"){
 const {data,error}=await supabaseAdmin().from("delivery_dates").select("date").eq("date",date).maybeSingle();
 if(error||!data)return "Please choose an available Trivandrum date";
 }
 return "";
}
