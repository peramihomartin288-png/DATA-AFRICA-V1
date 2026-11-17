import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const ALLOWED=["SP.POP.TOTL","NY.GDP.MKTP.CD","NY.GDP.PCAP.CD","SL.UEM.TOTL.ZS"];

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return reply({error:"POST required"},405);
 const url=Deno.env.get("SUPABASE_URL"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!service)return reply({error:"Server configuration missing"},500);
 const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
 if(!token)return reply({error:"Authentication required"},401);
 const db=createClient(url,service);
 const {data:auth,error:authError}=await db.auth.getClaims(token);
 if(authError||auth?.claims?.app_metadata?.role!=="admin")return reply({error:"Admin role required"},403);
 let input:{indicator?:string;startYear?:number;endYear?:number};
 try{input=await req.json()}catch{return reply({error:"Invalid JSON"},400)}
 const indicator=input.indicator||"SP.POP.TOTL";
 const start=Math.max(1960,Math.min(2025,Number(input.startYear||2015)));
 const end=Math.max(start,Math.min(2025,Number(input.endYear||2024)));
 if(!ALLOWED.includes(indicator))return reply({error:"Indicator not allowlisted"},400);
 const {data:source,error:se}=await db.from("sources").select("id").eq("code","WORLDBANK").single();
 const {data:metric,error:me}=await db.from("indicators").select("id,unit").eq("code",indicator).single();
 if(se||me)return reply({error:"World Bank source or indicator is not seeded"},500);
 const {data:dataset,error:de}=await db.from("datasets").upsert({source_id:source.id,external_code:indicator,title:"World Bank: "+indicator,attribution_required:true},{onConflict:"source_id,external_code"}).select("id").single();
 if(de)return reply({error:de.message},500);
 const {data:countries,error:ce}=await db.from("countries").select("iso3").eq("is_active",true);
 if(ce||!countries?.length)return reply({error:"No active countries"},500);
 const {data:run,error:re}=await db.from("ingestion_runs").insert({source_id:source.id,dataset_id:dataset.id,status:"running"}).select("id").single();
 if(re)return reply({error:re.message},500);
 let received=0,saved=0,flagged=0;const errors:string[]=[];
 for(const c of countries){
  const endpoint=new URL("https://api.worldbank.org/v2/country/"+c.iso3+"/indicator/"+indicator);
  endpoint.searchParams.set("format","json");endpoint.searchParams.set("per_page","100");endpoint.searchParams.set("date",start+":"+end);
  try{
   const response=await fetch(endpoint,{headers:{"User-Agent":"DATA-AFRICA-V1/1.0"}});
   if(!response.ok){errors.push(c.iso3+" HTTP "+response.status);continue}
   const payload=await response.json();const rows=Array.isArray(payload?.[1])?payload[1]:[];received+=rows.length;
   for(const row of rows){
    if(row.value===null||row.value===undefined||!Number.isFinite(Number(row.value)))continue;
    const year=Number(row.date),valid=Number.isInteger(year)&&year>=1960&&year<=2025&&row.countryiso3code===c.iso3;
    const value=Number(row.value),hashInput=JSON.stringify(row);
    const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(hashInput));
    const hash=Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join("");
    const {data:raw,error:rawError}=await db.from("raw_records").upsert({ingestion_run_id:run.id,source_id:source.id,external_id:c.iso3+":"+indicator+":"+row.date,payload:row,payload_hash:hash},{onConflict:"payload_hash"}).select("id").single();
    if(rawError){errors.push(c.iso3+" "+row.date+" raw save failed");continue}
    const status=valid?"verified":"flagged";
    const {data:ob,error:obError}=await db.from("observations").upsert({dataset_id:dataset.id,indicator_id:metric.id,country_iso3:c.iso3,raw_record_id:raw.id,period_start:year+"-01-01",period_end:year+"-12-31",value,unit:metric.unit,observation_status:"final",verification_status:status,quality_score:valid?95:20,source_url:endpoint.toString(),published:valid},{onConflict:"dataset_id,indicator_id,country_iso3,period_start,period_end"}).select("id").single();
    if(obError){errors.push(c.iso3+" "+row.date+" observation save failed");continue}
    await db.from("verification_checks").insert({observation_id:ob.id,check_type:"source_country_year_numeric",status:valid?"pass":"fail",score:valid?95:20,details:{source:"World Bank API",country_match:row.countryiso3code===c.iso3,year_valid:Number.isInteger(year)&&year>=1960&&year<=2025,numeric_value:Number.isFinite(value)}});
    if(valid)saved++;else flagged++;
   }
  }catch(e){errors.push(c.iso3+" "+String(e))}
 }
 const finalStatus=errors.length?(saved?"partial":"failed"):"success";
 await db.from("ingestion_runs").update({status:finalStatus,records_received:received,records_saved:saved,error_message:errors.slice(0,20).join("\n")||null,completed_at:new Date().toISOString()}).eq("id",run.id);
 return reply({status:finalStatus,indicator,countries:countries.length,recordsReceived:received,verifiedSaved:saved,flagged,errors:errors.slice(0,10)});
});