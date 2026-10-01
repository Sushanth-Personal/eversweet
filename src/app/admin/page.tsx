"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Product, BoxSize } from "@/lib/types";
import type { ExtOrder } from "./_lib/constants";
import { OrderCalendar } from "./_components/OrderCalendar";
import { OrderManagerModal } from "./_components/OrderManagerModal";

type LocationFilter="all"|"kochi"|"trivandrum";
export default function AdminPage(){
  const [authed,setAuthed]=useState(false),[password,setPassword]=useState(""),[loginPassword,setLoginPassword]=useState(""),[loginError,setLoginError]=useState(false);
  const [orders,setOrders]=useState<ExtOrder[]>([]),[products,setProducts]=useState<Product[]>([]),[boxes,setBoxes]=useState<BoxSize[]>([]),[loading,setLoading]=useState(false),[filter,setFilter]=useState<LocationFilter>("all"),[editing,setEditing]=useState<ExtOrder|null|undefined>(undefined),[message,setMessage]=useState("");
  useEffect(()=>{const saved=sessionStorage.getItem("es_admin_password");if(saved){setPassword(saved);setAuthed(true)}},[]);
  const load=useCallback(async()=>{setLoading(true);const [{data:o},{data:p},{data:b}]=await Promise.all([supabase.from("orders").select("*").order("created_at",{ascending:false}).limit(1000),supabase.from("products").select("*").eq("is_available",true).order("sort_order"),supabase.from("box_sizes").select("*").order("sort_order")]);setOrders((o||[]) as ExtOrder[]);setProducts((p||[]) as Product[]);setBoxes((b||[]) as BoxSize[]);setLoading(false)},[]);
  useEffect(()=>{if(authed)load()},[authed,load]);
  const shown=useMemo(()=>orders.filter(o=>filter==="all"||(filter==="trivandrum"?o.source==="trivandrum":o.source!=="trivandrum")),[orders,filter]);
  async function dispatch(id:string){const r=await fetch("/api/admin/orders",{method:"PATCH",headers:{"Content-Type":"application/json","x-admin-password":password},body:JSON.stringify({id,action:"dispatch"})});if(r.ok){setMessage("Order dispatched ✓");await load()}else setMessage("Could not update order")}
  if(!authed)return <main className="admin-login"><form onSubmit={e=>{e.preventDefault();if(loginPassword===process.env.NEXT_PUBLIC_ADMIN_PASSWORD){sessionStorage.setItem("es_admin_password",loginPassword);setPassword(loginPassword);setAuthed(true)}else setLoginError(true)}}><span>🍡</span><h1>Eversweet Orders</h1><p>Your simple order workspace</p><input type="password" placeholder="Admin password" value={loginPassword} onChange={e=>setLoginPassword(e.target.value)}/>{loginError&&<small>Incorrect password</small>}<button>Open orders</button></form></main>;
  return <main className="simple-admin"><nav><div><span>🍡</span><strong>Eversweet Orders</strong></div><div><a className="admin-delivery-link" href="/delivery">🚚 Delivery</a><button onClick={load}>{loading?"Loading…":"↻ Refresh"}</button><button onClick={()=>{sessionStorage.removeItem("es_admin_password");setAuthed(false)}}>Sign out</button></div></nav><div className="admin-location-filter"><span>Show orders</span>{(["all","kochi","trivandrum"] as LocationFilter[]).map(v=><button className={filter===v?"active":""} key={v} onClick={()=>setFilter(v)}>{v==="all"?"All":v==="kochi"?"🍡 Kochi":"🚂 TVM"}</button>)}</div>{message&&<div className="admin-toast">{message}</div>}<OrderCalendar orders={shown} products={products} boxes={boxes} onEdit={o=>setEditing(o)} onAdd={()=>setEditing(null)} onDispatch={dispatch}/>{editing!==undefined&&<OrderManagerModal order={editing} products={products} boxes={boxes} password={password} onClose={()=>setEditing(undefined)} onSaved={async()=>{setEditing(undefined);setMessage(editing?"Order updated ✓":"Order added ✓");await load()}}/>}</main>
}
