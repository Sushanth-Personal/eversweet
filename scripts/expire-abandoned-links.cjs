// Conservative one-time classification for links created before draft status existed.
// Dry-run by default. Never matches a named customer, a phone, flavours or a reservation.
require('@next/env').loadEnvConfig(process.cwd());
const {createClient}=require('@supabase/supabase-js');
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
(async()=>{
 const [{data:orders,error},{data:packing,error:packingError}]=await Promise.all([db.from('orders').select('*').eq('status','confirmed').eq('payment_method','admin'),db.from('order_packing').select('order_id')]);
 if(error||packingError)throw error||packingError;
 const cutoff=Date.now()-300000;
 const candidates=orders.filter(o=>o.customer_name==='Customer details pending'&&!String(o.phone||'').trim()&&Object.values(o.flavours||{}).every(n=>Number(n)===0)&&!packing.some(p=>p.order_id===o.id)&&Date.parse(o.created_at.endsWith('Z')?o.created_at:o.created_at+'Z')<=cutoff);
 console.log(JSON.stringify({mode:process.argv.includes('--apply')?'apply':'dry-run',candidates:candidates.map(o=>({id:o.id,date:o.delivery_date,created_at:o.created_at,status:o.status}))},null,2));
 if(!process.argv.includes('--apply'))return;
 for(const o of candidates){
   // Optimistic predicates prevent racing a customer beginning to fill the order.
   let q=db.from('orders').update({status:'expired'}).eq('id',o.id).eq('status','confirmed').eq('customer_name',o.customer_name).eq('flavours',JSON.stringify(o.flavours||{}));
   q=o.phone===null?q.is('phone',null):q.eq('phone',o.phone);
   q=o.notes===null?q.is('notes',null):q.eq('notes',o.notes);
   const r=await q.select('id,status');if(r.error)throw r.error;
   console.log('expired',r.data);
 }
})().catch(e=>{console.error(e.message);process.exitCode=1});
