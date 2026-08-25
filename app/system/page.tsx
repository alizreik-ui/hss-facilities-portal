'use client';
import {useEffect,useState} from 'react';
import {createClient} from '@supabase/supabase-js';

const supabase=createClient('https://sdbdppcbvlalyjnxeqmy.supabase.co','sb_publishable_YRnoxe5WTODYiA67nLfpNg_JqYHdaYM');

export default function SystemPage(){
 const [rows,setRows]=useState<any[]>([]),[summary,setSummary]=useState<any>({}),[loading,setLoading]=useState(true),[err,setErr]=useState('');
 useEffect(()=>{(async()=>{
  const {data:{session}}=await supabase.auth.getSession();
  if(!session){location.href='/';return}
  const {data:profile}=await supabase.from('profiles').select('role').eq('id',session.user.id).single();
  if(profile?.role!=='admin'){location.href='/';return}
  const [{data:audit,error:aErr},{data:sum,error:sErr}]=await Promise.all([
    supabase.from('audit_log').select('id,action,entity,entity_id,created_at').order('created_at',{ascending:false}).limit(100),
    supabase.rpc('hss_dashboard_summary')
  ]);
  if(aErr||sErr)setErr(aErr?.message||sErr?.message||'Error');
  setRows(audit||[]); setSummary(sum||{}); setLoading(false);
 })()},[]);
 if(loading)return <main style={{padding:24}}>Loading...</main>;
 return <main style={{padding:24,fontFamily:'Arial,Tahoma,sans-serif'}}>
  <h1>System / النظام</h1>
  {err&&<p>{err}</p>}
  <section style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(160px,1fr))',gap:12,marginBottom:20}}>
   <div><small>Supabase</small><h3>Connected</h3></div>
   <div><small>Users</small><h3>{summary.users_total??'-'}</h3></div>
   <div><small>Incidents</small><h3>{summary.incidents_total??0}</h3></div>
   <div><small>Work Orders</small><h3>{summary.work_orders_total??0}</h3></div>
  </section>
  <h2>Audit Log / سجل التدقيق</h2>
  <table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr><th style={{textAlign:'left'}}>Time</th><th>Action</th><th>Entity</th><th>ID</th></tr></thead><tbody>
   {rows.map(r=><tr key={r.id}><td>{r.created_at}</td><td>{r.action}</td><td>{r.entity}</td><td>{r.entity_id}</td></tr>)}
  </tbody></table>
 </main>
}
