import {NextResponse} from 'next/server';

const SUPABASE_URL='https://sdbdppcbvlalyjnxeqmy.supabase.co';
const SUPABASE_KEY='sb_publishable_YRnoxe5WTODYiA67nLfpNg_JqYHdaYM';

async function timed(name:string,url:string,init?:RequestInit){
  const started=Date.now();
  try{
    const response=await fetch(url,{...init,cache:'no-store',signal:AbortSignal.timeout(5000)});
    return {name,ok:response.ok,status:response.status,ms:Date.now()-started};
  }catch(error:any){
    return {name,ok:false,status:0,ms:Date.now()-started,error:error?.name||'fetch_failed'};
  }
}

export async function GET(){
  const started=Date.now();
  const checks=await Promise.all([
    timed('supabase-auth',`${SUPABASE_URL}/auth/v1/health`,{headers:{apikey:SUPABASE_KEY}}),
    timed('supabase-rest',`${SUPABASE_URL}/rest/v1/`,{headers:{apikey:SUPABASE_KEY,Accept:'application/json'}})
  ]);
  return NextResponse.json({ok:checks.every(x=>x.ok),region:process.env.VERCEL_REGION||'unknown',total_ms:Date.now()-started,checks},{headers:{'Cache-Control':'no-store'}});
}
