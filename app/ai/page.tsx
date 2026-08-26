'use client';
import {useEffect,useState} from 'react';
import {getSessionSafely,supabase} from '@/lib/supabase-browser';

export default function AIPage(){
 const [lang,setLang]=useState<'en'|'ar'>('en');
 const [session,setSession]=useState<any>(null);
 const [q,setQ]=useState('');
 const [messages,setMessages]=useState<any[]>([]);
 const [loading,setLoading]=useState(true);
 const [sending,setSending]=useState(false);
 const t=(en:string,ar:string)=>lang==='ar'?ar:en;
 useEffect(()=>{getSessionSafely().then(({data})=>{setSession(data.session);setLoading(false)}).catch(()=>setLoading(false))},[]);
 useEffect(()=>{document.documentElement.dir=lang==='ar'?'rtl':'ltr';document.documentElement.lang=lang},[lang]);
 async function send(){
  if(!q.trim()||!session||sending)return;
  const question=q;setQ('');setMessages(m=>[...m,{role:'user',text:question}]);setSending(true);
  try{
   const r=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({message:question})});
   const d=await r.json();
   setMessages(m=>[...m,{role:'assistant',text:d.answer||d.error||t('AI request failed','تعذر طلب الذكاء الاصطناعي')}]);
  }finally{setSending(false)}
 }
 if(loading)return <main className='login'><section className='card'>Loading...</section></main>;
 if(!session)return <main className='login'><section className='card'><h1>{t('Login required','يلزم تسجيل الدخول')}</h1><a className='btn' href='/portal'>{t('Back to portal','العودة إلى البوابة')}</a></section></main>;
 return <main className='content'>
  <div className='actions' style={{alignItems:'center',marginBottom:12}}><a className='btn' href='/portal'>{t('Back to Portal','العودة إلى البوابة')}</a><h1 style={{flex:1}}>{t('Ask HSS AI','اسأل مساعد HSS الذكي')}</h1><div className='lang'><button onClick={()=>setLang('en')}>EN</button><button onClick={()=>setLang('ar')}>العربية</button></div></div>
  <section className='card'>
   <p className='muted'>{t('Ask about incidents, overdue work orders, PPM, physical security, or agriculture data you are authorized to access.','اسأل عن الحوادث أو أوامر العمل المتأخرة أو الصيانة الوقائية أو الأمن المادي أو بيانات الزراعة المصرح لك بالوصول إليها.')}</p>
   <div style={{minHeight:360,maxHeight:520,overflowY:'auto',background:'#f8f9fa',padding:12,borderRadius:10,marginBottom:12}}>
    {messages.length===0&&<p className='muted'>{t('Example: Which systems have the most overdue work orders?','مثال: ما هي الأنظمة التي لديها أكبر عدد من أوامر العمل المتأخرة؟')}</p>}
    {messages.map((m,i)=><div key={i} style={{margin:'10px 0',display:'flex',justifyContent:m.role==='user'?'flex-end':'flex-start'}}><div style={{maxWidth:'80%',padding:'10px 12px',borderRadius:10,background:m.role==='user'?'#111':'#fff',color:m.role==='user'?'#fff':'#17212b',border:m.role==='user'?'0':'1px solid #e4e8ec',whiteSpace:'pre-wrap'}}>{m.text}</div></div>)}
    {sending&&<p className='muted'>{t('Analyzing authorized portal data...','جارٍ تحليل بيانات البوابة المصرح بها...')}</p>}
   </div>
   <div className='row' style={{gridTemplateColumns:'1fr auto'}}><input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder={t('Ask HSS AI...','اسأل مساعد HSS الذكي...')}/><button className='primary' onClick={send} disabled={sending}>{t('Send','إرسال')}</button></div>
  </section>
 </main>
}
