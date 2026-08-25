import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { gunzipSync } from 'zlib';

const SB='https://sdbdppcbvlalyjnxeqmy.supabase.co';
const KEY='sb_publishable_YRnoxe5WTODYiA67nLfpNg_JqYHdaYM';
const TOKEN='gukCpa5Tszs2va3neY9CF9GwQWDPFrfslOcJpZxLeA8';

function csv(text:string){
 const rows:string[][]=[]; let row:string[]=[]; let field=''; let quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i]; if(quoted){if(c==='"'&&text[i+1]==='"'){field+='"';i++;}else if(c==='"')quoted=false;else field+=c;}else{if(c==='"')quoted=true;else if(c===','){row.push(field);field='';}else if(c==='\n'){row.push(field.replace(/\r$/,''));rows.push(row);row=[];field='';}else field+=c;}}
 if(field||row.length){row.push(field.replace(/\r$/,''));rows.push(row);} const h=rows.shift()||[];
 return rows.filter(r=>r.some(Boolean)).map(r=>Object.fromEntries(h.map((k,i)=>[k,r[i]||null])));
}
function load(name:string){const b64=readFileSync(join(process.cwd(),'data/import',name),'utf8');return csv(gunzipSync(Buffer.from(b64,'base64')).toString('utf8').replace(/^\uFEFF/,''));}
async function send(dataset:string,rows:any[]){let total=0; for(let i=0;i<rows.length;i+=100){const part=rows.slice(i,i+100).map((r:any)=>{if(dataset==='physical_security'){r.source_no=Number(r.source_no);r.source_year=Number(r.source_year);} if(dataset==='agriculture'&&r.plant_units)r.plant_units=Number(r.plant_units); return r;}); const res=await fetch(`${SB}/rest/v1/rpc/import_historical_data`,{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({p_token:TOKEN,p_dataset:dataset,p_rows:part})}); if(!res.ok)throw new Error(`${dataset} ${res.status}: ${await res.text()}`); total+=Number(await res.json());} return total;}
export async function GET(){try{const ps=load('physical_security_2026.csv.gz.b64');const ag=load('agriculture_feb2025.csv.gz.b64');const psn=await send('physical_security',ps);const agn=await send('agriculture',ag);return NextResponse.json({ok:true,physical_security:psn,agriculture:agn,source_counts:{physical_security:ps.length,agriculture:ag.length}});}catch(e:any){return NextResponse.json({ok:false,error:e.message},{status:500});}}
// one-time import runner; remove after verified import
