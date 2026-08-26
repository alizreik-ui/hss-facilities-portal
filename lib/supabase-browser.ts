import {createClient, type SupabaseClient} from '@supabase/supabase-js';

const SUPABASE_URL='https://sdbdppcbvlalyjnxeqmy.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_YRnoxe5WTODYiA67nLfpNg_JqYHdaYM';

const browserScope=globalThis as typeof globalThis&{__hssSupabaseClient?:SupabaseClient};

export const supabase=browserScope.__hssSupabaseClient??createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'sb-sdbdppcbvlalyjnxeqmy-auth-token'}}
);

browserScope.__hssSupabaseClient=supabase;

type SessionResult=Awaited<ReturnType<typeof supabase.auth.getSession>>;

export async function getSessionSafely(timeoutMs=5000):Promise<SessionResult>{
  let timer:ReturnType<typeof setTimeout>|undefined;
  const timeout=new Promise<SessionResult>((resolve)=>{
    timer=setTimeout(()=>resolve({data:{session:null},error:null}),timeoutMs);
  });
  try{return await Promise.race([supabase.auth.getSession(),timeout])}
  finally{if(timer)clearTimeout(timer)}
}
