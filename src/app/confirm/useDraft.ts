"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { layout } from "@/lib/order-draft";
const CACHE="eversweet-draft-v1";
export function useDraft(draftId:string|undefined, snapshot:string, hydrate:(data:any)=>void) {
 const router=useRouter(),[id,setId]=useState(draftId||""),[ready,setReady]=useState(false),[status,setStatus]=useState(""),[error,setError]=useState("");
 const queue=useRef(Promise.resolve(true)),last=useRef(""),creationId=useRef("");
 function remember(id:string,date:string){try{const old=JSON.parse(localStorage.getItem(CACHE)||"null");localStorage.setItem(CACHE,JSON.stringify({id,date,created:old?.id===id?old.created:Date.now()}))}catch{}}
 useEffect(()=>{let cancelled=false;async function open(){try{
 if(!draftId){try{const c=JSON.parse(localStorage.getItem(CACHE)||"null"),today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata"}).format(new Date());if(c?.id&&((c.date&&c.date>=today)||(!c.date&&Date.now()-c.created<7*86400000))){router.replace("/confirm/"+c.id);return}localStorage.removeItem(CACHE)}catch{}}
 const response=await fetch(draftId?"/api/order-confirmation/"+draftId:"/api/order-confirmation",{cache:"no-store"}),data=await response.json();if(!response.ok){if(response.status===404){try{const c=JSON.parse(localStorage.getItem(CACHE)||"null");if(c?.id===draftId)localStorage.removeItem(CACHE)}catch{}}throw new Error(data.error)}if(cancelled)return;
 if(data.order){const o=data.order;let plan=layout(o.notes);if(!plan.length&&o.box_size_id){let remaining={...o.flavours};const quantity=Math.max(1,Number(o.notes?.match(/Box quantity:\s*(\d+)/)?.[1]||1)),count=data.boxes.find((b:any)=>b.id===o.box_size_id)?.count||0;plan=Array.from({length:quantity},()=>{let room=count;const flavours:Record<string,number>={};for(const [key,n]of Object.entries(remaining)){const take=Math.min(room,Number(n));if(take){flavours[key]=take;remaining[key]=Number(n)-take;room-=take}}return{box_size_id:o.box_size_id,flavours}})}data.plan=plan;remember(o.id,o.delivery_date||"");}
 if(draftId){try{const pending=localStorage.getItem("eversweet-unsaved-"+draftId);if(pending){const values=JSON.parse(pending);data.order={...data.order,...values};data.plan=values.box_selections}}catch{}}hydrate(data);setReady(true);
 }catch(e){setError(e instanceof Error?e.message:"Could not open order");setReady(true)}}open();return()=>{cancelled=true}},[draftId,router]);
 function save(value=snapshot){if(!id)return Promise.resolve(false);const task=queue.current.then(async()=>{if(last.current===value)return true;setStatus("Saving…");try{const response=await fetch("/api/order-confirmation/"+id,{method:"PATCH",headers:{"Content-Type":"application/json"},body:value}),data=await response.json();if(!response.ok)throw new Error(data.error);last.current=value;try{if(localStorage.getItem("eversweet-unsaved-"+id)===value)localStorage.removeItem("eversweet-unsaved-"+id)}catch{}remember(id,JSON.parse(value).delivery_date);setStatus("Saved ✓");setError("");return true}catch(e){setStatus("Not saved");setError(e instanceof Error?e.message:"Could not save");return false}});queue.current=task;return task}
 useEffect(()=>{if(!id||!ready||!JSON.parse(snapshot).customer_name)return;try{localStorage.setItem("eversweet-unsaved-"+id,snapshot)}catch{}const timer=setTimeout(()=>void save(snapshot),650);return()=>clearTimeout(timer)},[snapshot,id,ready]);
 async function create(name:string,phone:string){if(!name.trim()||!phone.trim()){setError("Please enter your name and phone number.");return false}if(id)return save();try{if(!creationId.current){try{creationId.current=localStorage.getItem("eversweet-pending-id")||""}catch{}if(!creationId.current)creationId.current=crypto.randomUUID();try{localStorage.setItem("eversweet-pending-id",creationId.current)}catch{}}
 const response=await fetch("/api/order-confirmation",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...JSON.parse(snapshot),id:creationId.current,customer_name:name,phone})}),data=await response.json();if(!response.ok)throw new Error(data.error);remember(data.id,"");try{localStorage.removeItem("eversweet-pending-id")}catch{}router.replace("/confirm/"+data.id);return false;
 }catch(e){setError(e instanceof Error?e.message:"Could not save");return false}}
 function startNew(){try{localStorage.removeItem(CACHE);localStorage.removeItem("eversweet-pending-id")}catch{}window.location.assign("/confirm")}
 return{id,ready,status,error,save,create,startNew};
}
