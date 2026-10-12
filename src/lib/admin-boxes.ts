import {layout,replaceNote,type Selection} from "./order-draft";
export function initialBoxes(order:{notes?:string|null;box_size_id?:string;flavours?:Record<string,number>}|null,boxes:{id:string;count:number}[]):Selection[]{
 if(!order)return [];
 const saved=layout(order.notes);if(saved.length)return saved;
 if(!order.box_size_id&&!Object.values(order.flavours||{}).some(n=>n>0))return [];
 const remaining={...order.flavours},quantity=Math.min(100,Math.max(1,Number(order.notes?.match(/Box quantity:\s*(\d+)/)?.[1]||1))),capacity=boxes.find(b=>b.id===order.box_size_id)?.count||0;
 return Array.from({length:quantity},(_,i)=>{let room=capacity;const flavours:Record<string,number>={};for(const[id,n]of Object.entries(remaining)){const take=i===quantity-1?n:Math.min(room,n);if(take>0){flavours[id]=take;remaining[id]-=take;room-=take}}return {box_size_id:order.box_size_id||"",flavours}});
}
export function boxValues(plan:Selection[],notes?:string|null){
 const flavours:Record<string,number>={};for(const box of plan)for(const[id,n]of Object.entries(box.flavours))if(n>0)flavours[id]=(flavours[id]||0)+n;
 return {box_size_id:plan[0]?.box_size_id||null,flavours,notes:replaceNote(replaceNote(notes,"Box layout",encodeURIComponent(JSON.stringify(plan))),"Box quantity",String(plan.length))};
}
