'use client';
import {useEffect,useMemo,useState} from 'react';
import {getSessionSafely,supabase} from '@/lib/supabase-browser';

function Donut({value,total,label,color}:{value:number,total:number,label:string,color:string}){
 const pct=total?Math.round(value/total*100):0;
 const r=44,c=2*Math.PI*r,dash=c*pct/100;
 return <div className='viz-donut-wrap'>
  <svg viewBox='0 0 120 120' className='viz-donut' aria-label={`${label} ${pct}%`}>
   <circle cx='60' cy='60' r={r} className='viz-ring-bg'/>
   <circle cx='60' cy='60' r={r} fill='none' stroke={color} strokeWidth='12' strokeLinecap='round' strokeDasharray={`${dash} ${c-dash}`} transform='rotate(-90 60 60)'/>
   <text x='60' y='57' textAnchor='middle' className='viz-donut-number'>{pct}%</text>
   <text x='60' y='76' textAnchor='middle' className='viz-donut-small'>{value}/{total}</text>
  </svg>
  <div className='viz-donut-label'>{label}</div>
 </div>
}

function Bars({rows,max}:{rows:{label:string,value:number,color:string}[],max:number}){
 return <div className='viz-bars'>{rows.map((r,i)=><div className='viz-bar-row' key={i}>
  <div className='viz-bar-label'><span>{r.label}</span><strong>{r.value}</strong></div>
  <div className='viz-bar-track'><div className='viz-bar-fill' style={{width:`${max?Math.max(3,r.value/max*100):0}%`,background:r.color}}/></div>
 </div>)}</div>
}

export default function Analytics(){
 const [lang,setLang]=useState<'en'|'ar'>('en');
 const [loading,setLoading]=useState(true);
 const [profile,setProfile]=useState<any>(null);
 const [incidents,setIncidents]=useState<any[]>([]);
 const [workOrders,setWorkOrders]=useState<any[]>([]);
 const [security,setSecurity]=useState<any[]>([]);
 const [agriculture,setAgriculture]=useState<any[]>([]);
 const [ppm,setPpm]=useState<any[]>([]);
 const t=(en:string,ar:string)=>lang==='ar'?ar:en;
 const n=(v:number)=>new Intl.NumberFormat(lang==='ar'?'ar-EG':'en-US').format(v||0);

 useEffect(()=>{(async()=>{
  const {data:{session}}=await getSessionSafely();
  if(!session){window.location.href='/portal';return}
  const {data:p}=await supabase.from('profiles').select('*').eq('id',session.user.id).single(); setProfile(p);
  const [a,b,c,d,e]=await Promise.all([
   supabase.from('incidents').select('id,severity,status,category,incident_date'),
   supabase.from('work_orders').select('id,workflow_status,priority,module,overdue,due_date,created_at'),
   supabase.from('physical_security_records').select('id,type,system,criticality,status,start_date'),
   supabase.from('agriculture_checklists').select('id,area_type,status,activity,check_date'),
   supabase.from('ppm_schedules').select('id,module,frequency,active,next_due_date')
  ]);
  setIncidents(a.data||[]); setWorkOrders(b.data||[]); setSecurity(c.data||[]); setAgriculture(d.data||[]); setPpm(e.data||[]); setLoading(false);
 })()},[]);
 useEffect(()=>{document.documentElement.dir=lang==='ar'?'rtl':'ltr'},[lang]);

 const stats=useMemo(()=>{
  const openInc=incidents.filter(x=>x.status!=='closed').length;
  const criticalInc=incidents.filter(x=>['high','critical'].includes((x.severity||'').toLowerCase())).length;
  const openWo=workOrders.filter(x=>!['completed','cancelled'].includes(x.workflow_status)).length;
  const overdueWo=workOrders.filter(x=>x.overdue).length;
  const completedWo=workOrders.filter(x=>x.workflow_status==='completed').length;
  const agDone=agriculture.filter(x=>x.status==='completed').length;
  const secHigh=security.filter(x=>['high','critical'].includes((x.criticality||'').toLowerCase())).length;
  return {openInc,criticalInc,openWo,overdueWo,completedWo,agDone,secHigh,ppmActive:ppm.filter(x=>x.active).length};
 },[incidents,workOrders,security,agriculture,ppm]);

 const severityRows=[
  {label:t('Critical','حرجة'),value:incidents.filter(x=>(x.severity||'').toLowerCase()==='critical').length,color:'#dc2626'},
  {label:t('High','عالية'),value:incidents.filter(x=>(x.severity||'').toLowerCase()==='high').length,color:'#f97316'},
  {label:t('Medium','متوسطة'),value:incidents.filter(x=>(x.severity||'').toLowerCase()==='medium').length,color:'#eab308'},
  {label:t('Low','منخفضة'),value:incidents.filter(x=>(x.severity||'').toLowerCase()==='low').length,color:'#22c55e'}
 ];
 const workRows=[
  {label:t('Open','مفتوح'),value:workOrders.filter(x=>x.workflow_status==='open').length,color:'#3b82f6'},
  {label:t('In progress','قيد التنفيذ'),value:workOrders.filter(x=>x.workflow_status==='in_progress').length,color:'#8b5cf6'},
  {label:t('Pending verification','بانتظار التحقق'),value:workOrders.filter(x=>x.workflow_status==='pending_verification').length,color:'#f59e0b'},
  {label:t('Completed','مكتمل'),value:stats.completedWo,color:'#10b981'},
  {label:t('Overdue','متأخر'),value:stats.overdueWo,color:'#ef4444'}
 ];
 const moduleRows=[
  {label:t('Physical security','الأمن المادي'),value:security.length,color:'#2563eb'},
  {label:t('Agriculture','الزراعة'),value:agriculture.length,color:'#16a34a'},
  {label:t('Incidents','الحوادث'),value:incidents.length,color:'#dc2626'},
  {label:t('Work orders','أوامر العمل'),value:workOrders.length,color:'#7c3aed'},
  {label:'PPM',value:ppm.length,color:'#0891b2'}
 ];

 if(loading)return <main className='analytics-page'><div className='analytics-loading'>{t('Loading dashboard...','جارٍ تحميل لوحة المعلومات...')}</div></main>;
 return <main className='analytics-page'>
  <div className='analytics-hero'>
   <div><div className='analytics-eyebrow'>HSS DIGITAL OPERATIONS</div><h1>{t('Management Analytics Dashboard','لوحة التحليلات الإدارية')}</h1><p>{t('Live operational overview from Supabase','نظرة تشغيلية مباشرة من قاعدة بيانات Supabase')}</p></div>
   <div className='analytics-actions'><a href='/portal'>{t('Back to portal','العودة للبوابة')}</a><button onClick={()=>setLang(lang==='en'?'ar':'en')}>{lang==='en'?'العربية':'English'}</button></div>
  </div>

  <section className='analytics-kpis'>
   <article className='akpi akpi-red'><span>{t('Open incidents','الحوادث المفتوحة')}</span><strong>{n(stats.openInc)}</strong><small>{n(stats.criticalInc)} {t('high / critical','عالية / حرجة')}</small></article>
   <article className='akpi akpi-purple'><span>{t('Open work orders','أوامر العمل المفتوحة')}</span><strong>{n(stats.openWo)}</strong><small>{n(stats.overdueWo)} {t('overdue','متأخرة')}</small></article>
   <article className='akpi akpi-blue'><span>{t('Security records','سجلات الأمن')}</span><strong>{n(security.length)}</strong><small>{n(stats.secHigh)} {t('high criticality','عالية الأهمية')}</small></article>
   <article className='akpi akpi-green'><span>{t('Agriculture tasks','مهام الزراعة')}</span><strong>{n(agriculture.length)}</strong><small>{n(stats.agDone)} {t('completed','مكتملة')}</small></article>
   <article className='akpi akpi-cyan'><span>{t('Active PPM','الصيانة الوقائية النشطة')}</span><strong>{n(stats.ppmActive)}</strong><small>{t('recurring schedules','جداول متكررة')}</small></article>
  </section>

  <section className='analytics-grid'>
   <article className='analytics-card analytics-card-wide'><div className='analytics-card-head'><div><h2>{t('Operational workload','حجم العمل التشغيلي')}</h2><p>{t('Records by operational module','السجلات حسب الوحدة التشغيلية')}</p></div></div><Bars rows={moduleRows} max={Math.max(1,...moduleRows.map(x=>x.value))}/></article>
   <article className='analytics-card'><div className='analytics-card-head'><div><h2>{t('Work order completion','إنجاز أوامر العمل')}</h2><p>{t('Completed versus total','المكتمل من الإجمالي')}</p></div></div><Donut value={stats.completedWo} total={workOrders.length} label={t('Completion','الإنجاز')} color='#7c3aed'/></article>
   <article className='analytics-card'><div className='analytics-card-head'><div><h2>{t('Agriculture compliance','التزام الزراعة')}</h2><p>{t('Completed checklist tasks','مهام قوائم الفحص المكتملة')}</p></div></div><Donut value={stats.agDone} total={agriculture.length} label={t('Completed','مكتمل')} color='#16a34a'/></article>
   <article className='analytics-card'><div className='analytics-card-head'><div><h2>{t('Incident severity','خطورة الحوادث')}</h2><p>{t('Distribution by severity','التوزيع حسب مستوى الخطورة')}</p></div></div><Bars rows={severityRows} max={Math.max(1,...severityRows.map(x=>x.value))}/></article>
   <article className='analytics-card'><div className='analytics-card-head'><div><h2>{t('Work order status','حالة أوامر العمل')}</h2><p>{t('Current workflow position','الوضع الحالي في سير العمل')}</p></div></div><Bars rows={workRows} max={Math.max(1,...workRows.map(x=>x.value))}/></article>
  </section>

  <section className='analytics-bottom'>
   <article className='analytics-card'><h2>{t('Attention required','يتطلب الانتباه')}</h2><div className='attention-list'>
    <div><span className='dot red'></span><span>{t('Critical / high incidents','الحوادث الحرجة / العالية')}</span><strong>{n(stats.criticalInc)}</strong></div>
    <div><span className='dot orange'></span><span>{t('Overdue work orders','أوامر العمل المتأخرة')}</span><strong>{n(stats.overdueWo)}</strong></div>
    <div><span className='dot blue'></span><span>{t('High-criticality security records','سجلات الأمن عالية الأهمية')}</span><strong>{n(stats.secHigh)}</strong></div>
   </div></article>
   <article className='analytics-card'><h2>{t('System overview','نظرة عامة على النظام')}</h2><div className='overview-list'><div><span>{t('Signed in as','المستخدم')}</span><strong>{profile?.full_name||profile?.username}</strong></div><div><span>{t('Role','الصلاحية')}</span><strong>{profile?.role||'-'}</strong></div><div><span>{t('Data source','مصدر البيانات')}</span><strong>Supabase Live</strong></div></div></article>
  </section>
 </main>;
}
