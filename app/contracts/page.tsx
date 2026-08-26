'use client';
import {useEffect,useState} from 'react';
import {getSessionSafely,supabase} from '@/lib/supabase-browser';

type Lang='en'|'ar';
export default function ContractsPage(){
 const [lang,setLang]=useState<Lang>('en');
 const [profile,setProfile]=useState<any>(null);
 const [contractors,setContractors]=useState<any[]>([]);
 const [contracts,setContracts]=useState<any[]>([]);
 const [msg,setMsg]=useState('');
 const [contractor,setContractor]=useState<any>({contractor_code:'',company_name:'',service_category:'',contact_name:'',contact_email:'',contact_phone:'',notes:''});
 const [contract,setContract]=useState<any>({contract_no:'',contractor_id:'',title:'',module:'facilities',start_date:'',end_date:'',po_number:'',sla_summary:'',status:'active',notes:''});
 const t=(en:string,ar:string)=>lang==='ar'?ar:en;
 const n=(v:any)=>new Intl.NumberFormat(lang==='ar'?'ar-EG':'en-US').format(Number(v||0));
 const d=(v:any)=>v?new Intl.DateTimeFormat(lang==='ar'?'ar-QA':'en-GB').format(new Date(v)):'-';
 const canWrite=['admin','management'].includes(profile?.role);
 useEffect(()=>{document.documentElement.dir=lang==='ar'?'rtl':'ltr';document.documentElement.lang=lang;load()},[lang]);
 async function load(){
  const {data:{session}}=await getSessionSafely(); if(!session){location.href='/portal';return}
  const {data:p}=await supabase.from('profiles').select('*').eq('id',session.user.id).single(); setProfile(p);
  const [a,b]=await Promise.all([
   supabase.from('contractors').select('*').order('company_name'),
   supabase.from('contracts').select('*,contractors(company_name)').order('created_at',{ascending:false})
  ]);
  setContractors(a.data||[]);setContracts(b.data||[]);
 }
 async function uid(){return (await supabase.auth.getUser()).data.user?.id}
 async function addContractor(e:any){e.preventDefault();setMsg('');if(!canWrite)return;
  const {error}=await supabase.from('contractors').insert({...contractor,active:true});
  if(error){setMsg(error.message);return}setContractor({contractor_code:'',company_name:'',service_category:'',contact_name:'',contact_email:'',contact_phone:'',notes:''});setMsg(t('Contractor created successfully','تم إنشاء المقاول بنجاح'));await load();
 }
 async function addContract(e:any){e.preventDefault();setMsg('');if(!canWrite)return;const user=await uid();
  const row={...contract,contractor_id:contract.contractor_id||null,start_date:contract.start_date||null,end_date:contract.end_date||null,created_by:user};
  const {error}=await supabase.from('contracts').insert(row);
  if(error){setMsg(error.message);return}setContract({contract_no:'',contractor_id:'',title:'',module:'facilities',start_date:'',end_date:'',po_number:'',sla_summary:'',status:'active',notes:''});setMsg(t('Contract created successfully','تم إنشاء العقد بنجاح'));await load();
 }
 async function changeStatus(id:string,status:string){if(!canWrite)return;const {error}=await supabase.from('contracts').update({status,updated_at:new Date().toISOString()}).eq('id',id);if(error){setMsg(error.message);return}await load()}
 const active=contracts.filter(x=>x.status==='active').length;
 const expiring=contracts.filter(x=>x.status==='active'&&x.end_date&&new Date(x.end_date).getTime()>=Date.now()&&new Date(x.end_date).getTime()<=Date.now()+60*86400000).length;
 return <main className='content'>
  <div className='actions' style={{alignItems:'center',marginBottom:14}}><a className='btn' href='/portal'>{t('Portal','البوابة')}</a><a className='btn' href='/command-center'>{t('Command Center','مركز القيادة')}</a><a className='btn' href='/service-control'>{t('Service Control & Performance','إدارة الخدمات والأداء')}</a><h1 style={{flex:1,margin:0}}>{t('Contracts & Contractors','العقود والمقاولون')}</h1><div className='lang'><button onClick={()=>setLang('en')}>EN</button><button onClick={()=>setLang('ar')}>العربية</button></div></div>
  <div className='grid'><div className='card kpi'><div className='label'>{t('Total Contracts','إجمالي العقود')}</div><div className='value'>{n(contracts.length)}</div></div><div className='card kpi'><div className='label'>{t('Active Contracts','العقود النشطة')}</div><div className='value'>{n(active)}</div></div><div className='card kpi'><div className='label'>{t('Expiring within 60 days','تنتهي خلال ٦٠ يوماً')}</div><div className='value'>{n(expiring)}</div></div><div className='card kpi'><div className='label'>{t('Contractors','المقاولون')}</div><div className='value'>{n(contractors.length)}</div></div></div>
  {msg&&<div className='card' style={{marginTop:14}}>{msg}</div>}
  {canWrite&&<div className='grid2' style={{marginTop:14}}>
   <form className='card form' onSubmit={addContractor}><h2>{t('Add Contractor','إضافة مقاول')}</h2><div className='row'><input placeholder={t('Contractor Code','رمز المقاول')} value={contractor.contractor_code} onChange={e=>setContractor({...contractor,contractor_code:e.target.value})}/><input required placeholder={t('Company Name','اسم الشركة')} value={contractor.company_name} onChange={e=>setContractor({...contractor,company_name:e.target.value})}/></div><input placeholder={t('Service Category','فئة الخدمة')} value={contractor.service_category} onChange={e=>setContractor({...contractor,service_category:e.target.value})}/><div className='row'><input placeholder={t('Contact Name','اسم جهة الاتصال')} value={contractor.contact_name} onChange={e=>setContractor({...contractor,contact_name:e.target.value})}/><input placeholder={t('Phone','الهاتف')} value={contractor.contact_phone} onChange={e=>setContractor({...contractor,contact_phone:e.target.value})}/></div><input type='email' placeholder={t('Email','البريد الإلكتروني')} value={contractor.contact_email} onChange={e=>setContractor({...contractor,contact_email:e.target.value})}/><textarea placeholder={t('Notes','الملاحظات')} value={contractor.notes} onChange={e=>setContractor({...contractor,notes:e.target.value})}/><button className='primary'>{t('Create Contractor','إنشاء المقاول')}</button></form>
   <form className='card form' onSubmit={addContract}><h2>{t('Add Contract','إضافة عقد')}</h2><div className='row'><input required placeholder={t('Contract Number','رقم العقد')} value={contract.contract_no} onChange={e=>setContract({...contract,contract_no:e.target.value})}/><input required placeholder={t('Contract Title','عنوان العقد')} value={contract.title} onChange={e=>setContract({...contract,title:e.target.value})}/></div><div className='row'><select value={contract.contractor_id} onChange={e=>setContract({...contract,contractor_id:e.target.value})}><option value=''>{t('Select Contractor','اختر المقاول')}</option>{contractors.filter(x=>x.active).map(x=><option key={x.id} value={x.id}>{x.company_name}</option>)}</select><select value={contract.module} onChange={e=>setContract({...contract,module:e.target.value})}><option value='facilities'>{t('Facilities','المرافق')}</option><option value='health_safety'>{t('Health & Safety','الصحة والسلامة')}</option><option value='physical_security'>{t('Physical Security','الأمن المادي')}</option><option value='fire_life_safety'>{t('Fire & Life Safety','السلامة من الحريق')}</option><option value='agriculture'>{t('Agriculture & Landscaping','الزراعة وتنسيق الحدائق')}</option></select></div><div className='row'><div><label>{t('Start Date','تاريخ البدء')}</label><input type='date' value={contract.start_date} onChange={e=>setContract({...contract,start_date:e.target.value})}/></div><div><label>{t('End Date','تاريخ الانتهاء')}</label><input type='date' value={contract.end_date} onChange={e=>setContract({...contract,end_date:e.target.value})}/></div></div><input placeholder={t('Purchase Order Number','رقم أمر الشراء')} value={contract.po_number} onChange={e=>setContract({...contract,po_number:e.target.value})}/><textarea placeholder={t('SLA Summary','ملخص اتفاقية مستوى الخدمة')} value={contract.sla_summary} onChange={e=>setContract({...contract,sla_summary:e.target.value})}/><select value={contract.status} onChange={e=>setContract({...contract,status:e.target.value})}><option value='active'>{t('Active','نشط')}</option><option value='planned'>{t('Planned','مخطط')}</option><option value='expired'>{t('Expired','منتهي')}</option><option value='closed'>{t('Closed','مغلق')}</option></select><textarea placeholder={t('Notes','الملاحظات')} value={contract.notes} onChange={e=>setContract({...contract,notes:e.target.value})}/><button className='primary'>{t('Create Contract','إنشاء العقد')}</button></form>
  </div>}
  <div className='card' style={{marginTop:14,overflowX:'auto'}}><h2>{t('Contract Register','سجل العقود')}</h2><table><thead><tr><th>{t('Contract No.','رقم العقد')}</th><th>{t('Title','العنوان')}</th><th>{t('Contractor','المقاول')}</th><th>{t('Module','الوحدة')}</th><th>{t('PO No.','رقم أمر الشراء')}</th><th>{t('Start','البداية')}</th><th>{t('End','النهاية')}</th><th>{t('Status','الحالة')}</th>{canWrite&&<th>{t('Actions','الإجراءات')}</th>}</tr></thead><tbody>{contracts.map(c=><tr key={c.id}><td>{c.contract_no}</td><td>{c.title}</td><td>{c.contractors?.company_name||'-'}</td><td>{moduleLabel(c.module,t)}</td><td>{c.po_number||'-'}</td><td>{d(c.start_date)}</td><td>{d(c.end_date)}</td><td>{statusLabel(c.status,t)}</td>{canWrite&&<td><div className='actions'><button onClick={()=>changeStatus(c.id,'active')}>{t('Activate','تفعيل')}</button><button onClick={()=>changeStatus(c.id,'closed')}>{t('Close','إغلاق')}</button></div></td>}</tr>)}</tbody></table></div>
 </main>
}
function moduleLabel(v:string,t:(a:string,b:string)=>string){const m:any={facilities:['Facilities','المرافق'],health_safety:['Health & Safety','الصحة والسلامة'],physical_security:['Physical Security','الأمن المادي'],fire_life_safety:['Fire & Life Safety','السلامة من الحريق'],agriculture:['Agriculture & Landscaping','الزراعة وتنسيق الحدائق']};return m[v]?t(m[v][0],m[v][1]):v}
function statusLabel(v:string,t:(a:string,b:string)=>string){const m:any={active:['Active','نشط'],planned:['Planned','مخطط'],expired:['Expired','منتهي'],closed:['Closed','مغلق']};return m[v]?t(m[v][0],m[v][1]):v}
