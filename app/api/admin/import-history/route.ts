import {NextResponse} from 'next/server';
import {gunzipSync} from 'node:zlib';

const SUPABASE_URL='https://sdbdppcbvlalyjnxeqmy.supabase.co';
const SUPABASE_KEY='sb_publishable_YRnoxe5WTODYiA67nLfpNg_JqYHdaYM';
const BASE='https://raw.githubusercontent.com/alizreik-ui/hss-facilities-portal/main/data';

async function text(path:string){
  const r=await fetch(`${BASE}/${path}`,{cache:'no-store'});
  if(!r.ok) throw new Error(`Unable to load ${path}: ${r.status}`);
  return (await r.text()).trim();
}
async function loadSingle(name:string){
  const b64=await text(name);
  return JSON.parse(gunzipSync(Buffer.from(b64,'base64')).toString('utf8'));
}
async function loadPhysicalSecurity(){
  const parts=await Promise.all([0,1,2,3,4,5].map(i=>text(`ps_parts/${i}.txt`)));
  const b64=parts.join('');
  return JSON.parse(gunzipSync(Buffer.from(b64,'base64')).toString('utf8'));
}

export async function GET(req:Request){
  try{
    const url=new URL(req.url);
    const token=url.searchParams.get('token');
    if(!token) return NextResponse.json({error:'Import token required'},{status:401});
    const [ps,ag]=await Promise.all([
      loadPhysicalSecurity(),
      loadSingle('agriculture_feb2025.json.gz.b64')
    ]);
    const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/import_hss_historical_data`,{
      method:'POST',
      headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({p_secret:token,p_ps:ps,p_ag:ag}),
      cache:'no-store'
    });
    const body=await r.text();
    if(!r.ok) return NextResponse.json({error:'Supabase import failed',details:body},{status:500});
    return NextResponse.json({ok:true,result:JSON.parse(body),source:{physical_security:ps.length,agriculture:ag.length}});
  }catch(e:any){
    return NextResponse.json({error:e?.message||'Import failed'},{status:500});
  }
}
