"use client";
import {useState} from "react";
const ingredients=["biscoff","blueberry","butterscotch","coffee nuts","dark chocolate","green apple","hazelnut","kiwi","lemon curd","mango","milk choco nuts","nutella","orange","pear","pistachio","pomegranate","red cherry","strawberry","chocolate swirl cake","kitkat"];
export function FlavourImage({name,imageUrl}:{name:string;imageUrl?:string|null}){
 const[failed,setFailed]=useState("");
 const index=ingredients.indexOf(name.toLowerCase().replace(/ mochi$/,""));
 if(imageUrl&&failed!==imageUrl)return <img className="ingredient-photo" src={imageUrl} alt="" loading="lazy" onError={()=>setFailed(imageUrl)}/>;
 if(index<0)return <div className="ingredient-placeholder" aria-hidden="true">{name.slice(0,1)}</div>;
 return <div className="ingredient-photo ingredient-atlas" aria-hidden="true" style={{backgroundPosition:`${(index%4)*100/3}% ${Math.floor(index/4)*25}%`}}/>;
}
