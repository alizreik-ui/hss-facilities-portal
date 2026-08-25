import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { gunzipSync } from 'zlib';
const SB='https://sdbdppcbvlalyjnxeqmy.supabase.co'; const KEY='sb_publishable_YRnoxe5WTODYiA67nLfpNg_JqYHdaYM'; const TOKEN='gukCpa5Tszs2va3neY9CF9GwQWDPFrfslOcJpZxLeA8';
function load(path:string){return readFileSync(join(process.cwd(),path),'utf8').trim();}
function jsonGzip(b64:string){return JSON.parse(gunzipSync(Buffer.from(b64,'base64')).toString('utf8').replace(/^\uFEFF/,''));}
async function send(dataset:string,rows:any[]){let total=0;for(let i=0;i<rows.length;i+=100){const part=rows.slice(i,i+100);const res=await fetch(`${SB}/rest/v1/rpc/import_historical_data`,{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({p_token:TOKEN,p_dataset:dataset,p_rows:part})});if(!res.ok)throw new Error(`${dataset} ${res.status}: ${await res.text()}`);total+=Number(await res.json());}return total;}
export async function GET(){try{const ps=jsonGzip(load('data/ps_parts/0.txt')+load('data/ps_parts/1.txt'));const ag=jsonGzip(load('data/agriculture_feb2025.json.gz.b64'));const psn=await send('physical_security',ps);const agn=await send('agriculture',ag);return NextResponse.json({ok:true,physical_security:psn,agriculture:agn,source_counts:{physical_security:ps.length,agriculture:ag.length}});}catch(e:any){return NextResponse.json({ok:false,error:e.message},{status:500});}}
