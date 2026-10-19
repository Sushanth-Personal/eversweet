// Isolated visual-test proxy. All API writes stay in memory, never Supabase.
// Start the built app on :3012, then node tests/confirmation-preview.cjs.
const http=require("node:http");
const id="11111111-1111-4111-8111-111111111111";
const names=["Biscoff","Blueberry","Butterscotch","Coffee Nuts","Dark Chocolate","Green Apple","Hazelnut","Kiwi","Lemon Curd","Mango","Milk Choco Nuts","Nutella","Orange","Pear","Pistachio","Pomegranate","Red Cherry","Strawberry"];
const products=names.map((name,i)=>({id:String(i),name,is_available:true,is_premium:["Biscoff","Dark Chocolate"].includes(name),image_url:null}));
const boxes=[4,5,6,8].map(count=>({id:"box-"+count,label:"Box of "+count,count,is_active:true}));
let order={id,customer_name:"Preview Customer",phone:"0000000000",delivery_date:"2099-01-01",source:"kochi",delivery_slot:"",flavours:{},box_size_id:null,notes:"",status:"confirmed",customer_maps_url:""};
http.createServer((req,res)=>{
 if(req.url==="/api/order-confirmation/"+id){
  res.setHeader("Content-Type","application/json");
  if(req.method==="GET")return res.end(JSON.stringify({order,products,boxes,locked:""}));
  if(req.method==="PATCH"){let raw="";req.on("data",b=>raw+=b);req.on("end",()=>{const body=JSON.parse(raw);order={...order,...body,notes:"Box layout: "+encodeURIComponent(JSON.stringify(body.box_selections))};res.end(JSON.stringify({order}))});return}
 }
 if(req.url.startsWith("/api/")){res.writeHead(404);return res.end("Preview blocks all other API requests")}
 if(req.method!=="GET"){res.writeHead(405);return res.end()}
 const upstream=http.request({hostname:"127.0.0.1",port:3012,path:req.url,method:"GET"},response=>{res.writeHead(response.statusCode,response.headers);response.pipe(res)});
 upstream.on("error",()=>{res.writeHead(502);res.end("Start Eversweet on port 3012 first")});upstream.end();
}).listen(3013,"127.0.0.1",()=>console.log("Isolated preview: http://localhost:3013/confirm/"+id));
