'use client';
import {useEffect,useState} from 'react';
import {createClient} from '@supabase/supabase-js';

const supabase=createClient('https://sdbdppcbvlalyjnxeqmy.supabase.co','sb_publishable_YRnoxe5WTODYiA67nLfpNg_JqYHdaYM');
const ar:Record<string,string>={
 'Task':'مهمة','Project':'مشروع','Corrective':'تصحيحي','Corrective Action':'إجراء تصحيحي','Inspection Finding':'ملاحظة تفتيش',
 'Low':'منخفض','Medium':'متوسط','High':'عالٍ','Critical':'حرج','Active':'نشط','Inactive':'غير نشط','Open':'مفتوح','Closed':'مغلق',
 'Physical Security':'الأمن المادي','Health & Safety':'الصحة والسلامة','Fire & Life Safety':'السلامة من الحريق وحماية الأرواح','Facilities':'المرافق','Facilities Management':'إدارة المرافق','Agriculture':'الزراعة','Agriculture & Landscaping':'الزراعة وتنسيق الحدائق',
 'Daily':'يومي','Weekly':'أسبوعي','Monthly':'شهري','Quarterly':'ربع سنوي','Semiannual':'نصف سنوي','Annual':'سنوي',
 'Planned':'مخطط','Completed':'مكتمل','Not Completed':'غير مكتمل','Partially Completed':'مكتمل جزئياً','Unassigned':'غير مسند',
 'Management':'الإدارة','Supervisor':'مشرف','Staff':'موظف','Contractor':'مقاول','Viewer':'مشاهدة فقط','Admin':'مدير النظام'
};

export default function PortalTools(){
 const [signed,setSigned]=useState(false);
 useEffect(()=>{
  supabase.auth.getSession().then(({data})=>setSigned(!!data.session));
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setSigned(!!s));
  const translate=()=>{
   const isAr=document.documentElement.lang==='ar'||document.documentElement.dir==='rtl';
   document.querySelectorAll('option,button,th,td,span').forEach((el:any)=>{
    const text=(el.textContent||'').trim();
    if(!el.dataset.enOriginal&&ar[text])el.dataset.enOriginal=text;
    if(isAr&&el.dataset.enOriginal&&ar[el.dataset.enOriginal])el.textContent=ar[el.dataset.enOriginal];
    if(!isAr&&el.dataset.enOriginal)el.textContent=el.dataset.enOriginal;
   });
  };
  const obs=new MutationObserver(()=>translate());obs.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['lang','dir']});translate();
  return()=>{subscription.unsubscribe();obs.disconnect()};
 },[]);
 if(!signed)return null;
 return <nav className='portal-tools' aria-label='Portal navigation'>
  <a href='/command-center'>Command Center / مركز القيادة</a>
  <a href='/operations'>Operations / العمليات</a>
  <a href='/contracts'>Contracts / العقود</a>
  <a href='/analytics'>Analytics / التحليلات</a>
  <a href='/ai'>Ask HSS AI / اسأل HSS</a>
 </nav>
}
