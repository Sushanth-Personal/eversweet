import {NextRequest,NextResponse} from "next/server";
import {destinationCoordinates,encodePlusCode} from "@/lib/maps-plus-code";
function allowed(url:URL){return url.protocol==="https:"&&!url.username&&!url.password&&(!url.port||url.port==="443")&&["maps.apple.com","maps.app.goo.gl","goo.gl","maps.google.com","www.google.com","google.com","maps.google.co.in","www.google.co.in"].includes(url.hostname)}
function extract(url:URL){
 const raw=decodeURIComponent(url.searchParams.get("q")||url.searchParams.get("query")||url.pathname);
 // Shared Maps URLs sometimes encode the Plus Code separator as a space.
 const match=raw.match(/\b([23456789CFGHJMPQRVWX]{4,8})[+ ]([23456789CFGHJMPQRVWX]{2,3})\b/i);
 if(!match)return null;
 const code=(match[1]+"+"+match[2]).toUpperCase();
 return {code,context:match[1].length<8?raw.slice((match.index||0)+match[0].length).replace(/^[\s,+/]+/,"").trim():""};
}
export async function POST(req:NextRequest){try{
 const body=await req.json();let url=new URL(body.url);
 const signal=AbortSignal.timeout(10000);
 for(let i=0;i<6;i++){
 if(!allowed(url))return NextResponse.json({error:"Please use a Google Maps or Apple Maps HTTPS link."},{status:400});
 const coordinates=destinationCoordinates(url);
 if(coordinates)return NextResponse.json({code:encodePlusCode(...coordinates),context:""});
 const result=extract(url);if(result)return NextResponse.json(result);
 // GET is supported by shared links that do not return redirects to HEAD.
 // Disable fetch caching so a failed lookup cannot persist after a retry.
 const res=await fetch(url,{method:"GET",redirect:"manual",signal,cache:"no-store"});
 const location=res.headers.get("location");
 await res.body?.cancel();
 if(!location)break;
 url=new URL(location,url);
 }
 return NextResponse.json({error:"This link does not expose a Plus Code or an exact destination pin. Please share a dropped-pin link from Google Maps."},{status:422});
 }catch{return NextResponse.json({error:"Could not read this map link. Please try again."},{status:422})}}
