import {NextResponse} from 'next/server';
import {gunzipSync} from 'node:zlib';

const SUPABASE_URL='https://sdbdppcbvlalyjnxeqmy.supabase.co';
const SUPABASE_KEY='sb_publishable_YRnoxe5WTODYiA67nLfpNg_JqYHdaYM';
const BASE='https://raw.githubusercontent.com/alizreik-ui/hss-facilities-portal/main/data/import';

async function text(path:string){const r=await fetch(`${BASE}/${path}`,{cache:'no-store'});if(!r.ok)throw new Error(`Unable to load ${path}: ${r.status}`);return (await r.text()).trim()}
function parseCSV(s:string){const rows:string[][]=[];let row:string[]=[],v='',q=false;for(let i=0;i<s.length;i++){const c=s[i];if(q){if(c==='"'&&s[i+1]==='"'){v+='"';i++}else if(c==='"')q=false;else v+=c}else{if(c==='"')q=true;else if(c===','){row.push(v);v=''}else if(c==='\n'){row.push(v.replace(/\r$/,''));rows.push(row);row=[];v=''}else v+=c}}if(v||row.length){row.push(v);rows.push(row)}const h=rows.shift()||[];return rows.filter(r=>r.some(Boolean)).map(r=>Object.fromEntries(h.map((k,i)=>[k.replace(/^\uFEFF/,''),r[i]??''])))}
async function loadPS(){const b64=await text('physical_security_2026.csv.gz.b64');const csv=gunzipSync(Buffer.from(b64,'base64')).toString('utf8');return parseCSV(csv)}

export async function GET(req:Request){try{const token=new URL(req.url).searchParams.get('token');if(!token)return NextResponse.json({error:'Import token required'},{status:401});const ps=await loadPS();const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/import_hss_historical_data`,{method:'POST',headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify({p_secret:token,p_ps:ps,p_ag:[]}),cache:'no-store'});const body=await r.text();if(!r.ok)return NextResponse.json({error:'Supabase import failed',details:body},{status:500});return NextResponse.json({ok:true,result:JSON.parse(body),source:{physical_security:ps.length}})}catch(e:any){return NextResponse.json({error:e?.message||'Import failed'},{status:500})}}
