"use client";
import {useEffect,useState} from "react";
export default function DeliveryDatesSettings(){
 const[dates,setDates]=useState<string[]>([]),[date,setDate]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 async function load(){try{const r=await fetch("/api/delivery-dates"),d=await r.json();if(!r.ok)throw Error(d.error);setDates(d.dates)}catch(e){setError(String(e))}}
 useEffect(()=>{void load()},[]);
 async function change(value:string,remove=false){setBusy(true);setError("");try{const r=await fetch("/api/delivery-dates",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({date:value,remove})}),d=await r.json();if(!r.ok)throw Error(d.error);setDates(d.dates);setDate("")}catch(e){setError(String(e))}finally{setBusy(false)}}
 return <section><h2>Trivandrum delivery dates</h2><p>Customers can choose from these dates. Removing a date does not change existing orders.</p><div className="add-flavour-row"><input aria-label="New delivery date" type="date" value={date} onChange={e=>setDate(e.target.value)}/><button disabled={!date||busy} onClick={()=>change(date)}>Add date</button></div>{error&&<p role="alert">{error}</p>}<div className="settings-flavour-list">{dates.map(d=><div key={d}><strong>{new Date(d+"T12:00:00").toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"})}</strong><button disabled={busy} onClick={()=>change(d,true)}>Remove</button></div>)}</div></section>
}
