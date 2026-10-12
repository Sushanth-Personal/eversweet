// Eleven-digit Open Location Code encoding per Google's public specification:
// https://github.com/google/open-location-code/blob/main/Documentation/Specification/specification.md
export function encodePlusCode(lat:number,lng:number){
 if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat < -90||lat > 90||lng < -180||lng > 180)throw Error("Invalid coordinates");
 const alphabet="23456789CFGHJMPQRVWX";
 // The extra character subdivides the pair cell into five rows and four columns.
 const fineLat=Math.floor((Math.min(lat,90-0.000025)+90)*40000);
 const fineLng=Math.floor((((lng+180)%360+360)%360)*32000);
 const extra=alphabet[(fineLat%5)*4+(fineLng%4)];
 let latitude=Math.floor(fineLat/5),longitude=Math.floor(fineLng/4),code="";
 for(let i=0;i<5;i++){code=alphabet[latitude%20]+alphabet[longitude%20]+code;latitude=Math.floor(latitude/20);longitude=Math.floor(longitude/20)}
 return code.slice(0,8)+"+"+code.slice(8)+extra;
}
export function destinationCoordinates(url:URL):[number,number]|null{
 const path=decodeURIComponent(url.pathname)+(url.searchParams.get("data")||"");
 // !3d/!4d identify the destination. @lat,lng is only the map camera and
 // must never be treated as the delivery pin.
 const pin=path.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
 const query=(url.hostname==="maps.apple.com"?url.searchParams.get("coordinate"):null)||url.searchParams.get("query")||url.searchParams.get("q")||"";
 const pair=pin||query.match(/^\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\s*$/)||path.match(/\/place\/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)(?:\/|$)/);
 if(!pair)return null;
 const lat=Number(pair[1]),lng=Number(pair[2]);
 return Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180?[lat,lng]:null;
}
export function googleMapsLink(value:string):string{
 try{
 const url=new URL(value);
 if(url.protocol!=="https:")return "";
 const coords=destinationCoordinates(url);
 if(coords)return "https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(coords.join(","));
 if(["maps.app.goo.gl","goo.gl","maps.google.com","www.google.com","google.com","maps.google.co.in","www.google.co.in"].includes(url.hostname))return url.href;
 return "";
 }catch{return ""}
}
