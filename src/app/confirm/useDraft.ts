"use client";
import {useEffect,useRef,useState} from "react";
import {initialBoxes} from "@/lib/admin-boxes";
import {customerPhone} from "@/lib/customer-phone";

export function useDraft(draftId:string|undefined,snapshot:string,hydrate:(data:any)=>void,autosave=true){
 const[ready,setReady]=useState(false),[status,setStatus]=useState(""),[error,setError]=useState(""),[locked,setLocked]=useState("");
 const loadedId=useRef("");
 const queue=useRef(Promise.resolve(true)),last=useRef(""),hydrated=useRef(false);
 useEffect(()=>{let cancelled=false;loadedId.current="";hydrated.current=false;last.current="";setReady(false);setError("");setStatus("");setLocked("");
  // Retire old automatic-resume data. It must never override the server's order.
  try{localStorage.removeItem("eversweet-draft-v1");localStorage.removeItem("eversweet-pending-id");if(draftId)localStorage.removeItem("eversweet-unsaved-"+draftId)}catch{}
  if(!draftId){setLocked("Please open the personal order link sent by Eversweet. For a new order, ask us for a new link.");setReady(true);return}
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  fetch("/api/order-confirmation/"+draftId,{cache:"no-store",signal:controller.signal}).then(async response=>{
   const data=await response.json();if(!response.ok)throw Error(data.error||"Could not open order");if(cancelled)return;
   loadedId.current=draftId;
   data.plan=initialBoxes(data.order,data.boxes||[]);hydrate(data);setLocked(data.locked||"");setReady(true);
  }).catch(e=>{if(!cancelled){setError(e.name==="AbortError"?"Could not reach Eversweet. Please reload to try again.":e.message);setLocked("Your order could not be opened. No changes have been made.");setReady(true)}}).finally(()=>clearTimeout(timer));
  return()=>{cancelled=true;controller.abort();clearTimeout(timer)};
 },[draftId]);
 function save(value=snapshot){if(!draftId||loadedId.current!==draftId||locked)return Promise.resolve(false);
  const task=queue.current.then(async()=>{if(last.current===value)return true;setStatus("Saving…");const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);try{
   const response=await fetch("/api/order-confirmation/"+draftId,{method:"PATCH",signal:controller.signal,headers:{"Content-Type":"application/json"},body:value}),data=await response.json();
   if(!response.ok)throw Error(data.error||"Could not save");
   last.current=value;setStatus("Saved ✓");setError("");return true;
  }catch(e){setStatus("Not saved");setError(e instanceof Error?e.message:"Could not save");return false}finally{clearTimeout(timer)}});
  queue.current=task;return task;
 }
 useEffect(()=>{if(!autosave||!ready||locked||loadedId.current!==draftId)return;if(!hydrated.current){last.current=snapshot;hydrated.current=true;return}
  const values=JSON.parse(snapshot);if(!values.customer_name.trim()||!customerPhone(values.phone))return;
  const timer=setTimeout(()=>void save(snapshot),650);return()=>clearTimeout(timer);
 },[snapshot,ready,locked,draftId,autosave]);
 async function create(name:string,phone:string){if(!name.trim()||!customerPhone(phone)){setError("Please enter your name and a complete 10-digit phone number.");return false}return save()}
 return{id:draftId||"",ready,status,error,locked,save,create};
}
