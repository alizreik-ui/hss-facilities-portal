'use client';
import {useEffect,useState} from 'react';
import {supabase} from '@/lib/supabase-browser';
export default function Login(){
  const [lang,setLang]=useState<'en'|'ar'>('en');
  const [user,setUser]=useState('');
  const [pass,setPass]=useState('');
  const [busy,setBusy]=useState(false);
  const [err,setErr]=useState('');
  const t=(en:string,ar:string)=>lang==='ar'?ar:en;
  useEffect(()=>{document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';},[lang]);
  async function signIn(e:any){e.preventDefault();if(busy)return;setBusy(true);setErr('');const id=user.trim();const email=id.includes('@')?id:`${id.toLowerCase()}@hss.local`;const {data,error}=await supabase.auth.signInWithPassword({email,password:pass});if(error||!data.session){setErr(t('Invalid username or password','اسم المستخدم أو كلمة المرور غير صحيحة'));setBusy(false);return;}window.location.assign('/portal');}
  return <main className='login'>
    <div className='lang'><button type='button' onClick={()=>setLang('en')}>English</button><button type='button' onClick={()=>setLang('ar')}>العربية</button></div>
    <section className='card'>
      <div className='brand'>HSS</div>
      <h1>{t('HSS & Facilities Digital Portal','البوابة الرقمية للمرافق والصحة والسلامة والأمن')}</h1>
      <p>{t('Secure access to operational services, reporting and analytics','دخول آمن للخدمات التشغيلية والتقارير والتحليلات')}</p>
      <form onSubmit={signIn}>
        <input autoFocus name='username' placeholder={t('Username','اسم المستخدم')} value={user} onChange={e=>setUser(e.target.value)} autoComplete='username'/>
        <input name='password' type='password' placeholder={t('Password','كلمة المرور')} value={pass} onChange={e=>setPass(e.target.value)} autoComplete='current-password'/>
        <button className='primary' type='submit' disabled={busy}>{busy?t('Signing in...','جارٍ تسجيل الدخول...'):t('Sign in','تسجيل الدخول')}</button>
      </form>
      {err&&<p className='error'>{err}</p>}
    </section>
  </main>
}
