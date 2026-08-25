'use client';
import {useEffect,useState} from 'react';
import {createClient} from '@supabase/supabase-js';

const supabase=createClient('https://sdbdppcbvlalyjnxeqmy.supabase.co','sb_publishable_YRnoxe5WTODYiA67nLfpNg_JqYHdaYM');

const defaultPerms={dashboard:true,physical_security:false,agriculture:false,health_safety:true,facilities:false,ai:true};
const modules=[
 ['physical_security','Physical Security','الأمن المادي'],
 ['agriculture','Agriculture & Landscaping','الزراعة وتنسيق الحدائق'],
 ['health_safety','Health & Safety','الصحة والسلامة'],
 ['facilities','Facilities Management','إدارة المرافق'],
 ['ai','Ask HSS AI','اسأل مساعد HSS الذكي']
];

export default function Page(){
 const [session,setSession]=useState<any>(null),[profile,setProfile]=useState<any>(null),[page,setPage]=useState('dashboard'),[lang,setLang]=useState<'en'|'ar'>('en'),[loading,setLoading]=useState(true);
 const [loginId,setLoginId]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState('');
 const [newPassword,setNewPassword]=useState(''),[confirmPassword,setConfirmPassword]=useState('');
 const [incidents,setIncidents]=useState<any[]>([]),[selected,setSelected]=useState<any>(null),[actions,setActions]=useState<any[]>([]),[users,setUsers]=useState<any[]>([]);
 const [form,setForm]=useState<any>({category:'Health & Safety',incident_type:'',department:'',building:'',location:'',description:'',severity:'medium',persons_involved:'',injury:false,immediate_action:''});
 const [investigation,setInvestigation]=useState(''),[rootCause,setRootCause]=useState(''),[investigator,setInvestigator]=useState('');
 const [ca,setCa]=useState(''),[caUser,setCaUser]=useState(''),[caDue,setCaDue]=useState('');
 const [userForm,setUserForm]=useState<any>({username:'',full_name:'',password:'',role:'staff',department:'HSS',module_permissions:{...defaultPerms}});
 const [adminMsg,setAdminMsg]=useState('');
 const t=(en:string,ar:string)=>lang==='ar'?ar:en;
 const manager=['admin','management','supervisor'].includes(profile?.role);
 const isAdmin=profile?.role==='admin';
 const roleName=(r:string)=>({admin:t('Admin','مدير النظام'),management:t('Management','الإدارة'),supervisor:t('Supervisor','مشرف'),staff:t('Staff','موظف'),contractor:t('Contractor','مقاول'),viewer:t('Viewer','مشاهدة فقط')} as any)[r]||r;

 useEffect(()=>{
   supabase.auth.getSession().then(async({data})=>{setSession(data.session);if(data.session)await loadProfile(data.session.user.id);setLoading(false)});
   const {data:{subscription}}=supabase.auth.onAuthStateChange(async(_e,s)=>{setSession(s);if(s)await loadProfile(s.user.id);else setProfile(null)});
   return()=>subscription.unsubscribe()
 },[]);
 useEffect(()=>{document.documentElement.dir=lang==='ar'?'rtl':'ltr';document.documentElement.lang=lang},[lang]);

 async function loadProfile(id:string){
   const {data}=await supabase.from('profiles').select('*').eq('id',id).single();
   setProfile(data);
   await Promise.all([loadIncidents(),loadUsers()]);
 }
 async function loadIncidents(){const {data}=await supabase.from('incidents').select('*').order('incident_date',{ascending:false});setIncidents(data||[])}
 async function loadUsers(){const {data}=await supabase.from('profiles').select('*').order('full_name');setUsers(data||[])}
 async function login(){
   setError('');
   const id=loginId.trim();
   const email=id.includes('@')?id:`${id.toLowerCase()}@hss.local`;
   const {error}=await supabase.auth.signInWithPassword({email,password});
   if(error)setError(t('Invalid username or password','اسم المستخدم أو كلمة المرور غير صحيحة'));
 }
 async function logout(){await supabase.auth.signOut();setSession(null);setProfile(null);setPage('dashboard')}
 async function changePassword(e:any){
   e.preventDefault();setError('');
   if(newPassword.length<10){setError(t('Password must be at least 10 characters','يجب ألا تقل كلمة المرور عن ١٠ أحرف'));return}
   if(newPassword!==confirmPassword){setError(t('Passwords do not match','كلمتا المرور غير متطابقتين'));return}
   const {error:uErr}=await supabase.auth.updateUser({password:newPassword});
   if(uErr){setError(uErr.message);return}
   const {error:fErr}=await supabase.functions.invoke('admin-users',{body:{action:'complete_password_change'}});
   if(fErr){setError(fErr.message);return}
   setNewPassword('');setConfirmPassword('');await loadProfile(session.user.id);
 }
 async function submitIncident(e:any){
   e.preventDefault();if(!session)return;
   const {error}=await supabase.from('incidents').insert({...form,status:'reported',approval_status:'pending',reported_by:session.user.id});
   if(error){alert(error.message);return}
   setForm({category:'Health & Safety',incident_type:'',department:'',building:'',location:'',description:'',severity:'medium',persons_involved:'',injury:false,immediate_action:''});
   await loadIncidents();setPage('incidents')
 }
 async function openIncident(i:any){
   setSelected(i);setInvestigation(i.investigation_summary||'');setRootCause(i.root_cause||'');setInvestigator(i.investigator_id||'');
   const {data}=await supabase.from('incident_corrective_actions').select('*').eq('incident_id',i.id).order('created_at');
   setActions(data||[]);setPage('detail')
 }
 async function saveInvestigation(status?:string){
   if(!selected)return;
   const update:any={investigation_summary:investigation,root_cause:rootCause,investigator_id:investigator||null,updated_at:new Date().toISOString()};
   if(status)update.status=status;if(status==='closed'){update.closed_at=new Date().toISOString();update.approval_status='approved'}
   const {data,error}=await supabase.from('incidents').update(update).eq('id',selected.id).select().single();
   if(error){alert(error.message);return}setSelected(data);await loadIncidents()
 }
 async function addCorrective(){
   if(!selected||!ca.trim())return;
   const {error}=await supabase.from('incident_corrective_actions').insert({incident_id:selected.id,action:ca,responsible_user_id:caUser||null,due_date:caDue||null,status:'open'});
   if(error){alert(error.message);return}
   setCa('');setCaUser('');setCaDue('');
   const {data}=await supabase.from('incident_corrective_actions').select('*').eq('incident_id',selected.id).order('created_at');setActions(data||[]);
   if(selected.status==='reported'||selected.status==='under_investigation')await saveInvestigation('pending_corrective_actions')
 }
 async function closeAction(a:any){
   const {error}=await supabase.from('incident_corrective_actions').update({status:'completed',verified_by:session.user.id,verified_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',a.id);
   if(error){alert(error.message);return}
   const {data}=await supabase.from('incident_corrective_actions').select('*').eq('incident_id',selected.id).order('created_at');setActions(data||[])
 }
 async function createUser(e:any){
   e.preventDefault();setAdminMsg('');
   const {data,error}=await supabase.functions.invoke('admin-users',{body:{action:'create',...userForm}});
   if(error||data?.error){setAdminMsg(data?.error||error?.message||'Error');return}
   setAdminMsg(t('User created successfully','تم إنشاء المستخدم بنجاح'));
   setUserForm({username:'',full_name:'',password:'',role:'staff',department:'HSS',module_permissions:{...defaultPerms}});
   await loadUsers()
 }
 async function updateUser(id:string,updates:any){
   setAdminMsg('');
   const {data,error}=await supabase.functions.invoke('admin-users',{body:{action:'update',id,...updates}});
   if(error||data?.error){setAdminMsg(data?.error||error?.message||'Error');return}
   await loadUsers()
 }
 async function resetPassword(u:any){
   const p=prompt(t(`Temporary password for ${u.username} (10+ characters)`,`كلمة المرور المؤقتة للمستخدم ${u.username} (١٠ أحرف على الأقل)`));
   if(!p)return;
   const {data,error}=await supabase.functions.invoke('admin-users',{body:{action:'reset_password',id:u.id,password:p}});
   if(error||data?.error){alert(data?.error||error?.message);return}
   alert(t('Temporary password updated. User must change it at next login.','تم تحديث كلمة المرور المؤقتة، ويجب على المستخدم تغييرها عند تسجيل الدخول التالي.'));
   await loadUsers()
 }

 if(loading)return <main className='login'><section className='card'><h2>{t('Loading...','جارٍ التحميل...')}</h2></section></main>;

 if(!session)return <main className='login'>
   <div className='lang'><button onClick={()=>setLang('en')}>English</button><button onClick={()=>setLang('ar')}>العربية</button></div>
   <section className='card'><div className='brand'>HSS</div>
    <h1>{t('HSS & Facilities Digital Portal','البوابة الرقمية للمرافق والصحة والسلامة والأمن')}</h1>
    <p className='muted'>{t('Health, Safety, Security, Facilities & Landscaping','الصحة والسلامة والأمن والمرافق والزراعة وتنسيق الحدائق')}</p>
    {error&&<div className='error'>{error}</div>}
    <div className='form'>
     <input placeholder={t('Username or Email','اسم المستخدم أو البريد الإلكتروني')} value={loginId} onChange={e=>setLoginId(e.target.value)}/>
     <input type='password' placeholder={t('Password','كلمة المرور')} value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&login()}/>
     <button className='primary' onClick={login}>{t('Login','دخول')}</button>
    </div>
   </section>
 </main>;

 if(profile?.must_change_password)return <main className='login'>
  <div className='lang'><button onClick={()=>setLang('en')}>English</button><button onClick={()=>setLang('ar')}>العربية</button></div>
  <section className='card'>
   <h1>{t('Change Temporary Password','تغيير كلمة المرور المؤقتة')}</h1>
   <p className='muted'>{t('You must create a new password before using the portal.','يجب إنشاء كلمة مرور جديدة قبل استخدام البوابة.')}</p>
   {error&&<div className='error'>{error}</div>}
   <form className='form' onSubmit={changePassword}>
    <input type='password' placeholder={t('New Password','كلمة المرور الجديدة')} value={newPassword} onChange={e=>setNewPassword(e.target.value)}/>
    <input type='password' placeholder={t('Confirm Password','تأكيد كلمة المرور')} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}/>
    <button className='primary'>{t('Change Password','تغيير كلمة المرور')}</button>
   </form>
  </section>
 </main>;

 const open=incidents.filter(x=>x.status!=='closed').length;
 const critical=incidents.filter(x=>['high','critical'].includes((x.severity||'').toLowerCase())).length;
 const activeUsers=users.filter(u=>u.active).length;

 return <div className='shell'>
  <aside className='sidebar'><h2>HSS</h2>
   <button onClick={()=>setPage('dashboard')}>{t('Dashboard','لوحة المعلومات')}</button>
   <button onClick={()=>setPage('incidents')}>{t('Incident Management','إدارة الحوادث')}</button>
   <button onClick={()=>setPage('new')}>{t('New Incident','حادث جديد')}</button>
   {isAdmin&&<button onClick={()=>setPage('users')}>{t('User Management','إدارة المستخدمين')}</button>}
   <button onClick={logout}>{t('Logout','تسجيل الخروج')}</button>
  </aside>
  <main className='main'>
   <div className='topbar'><span>{profile?.full_name||profile?.username||session.user.email} · {roleName(profile?.role)}</span><div className='lang'><button onClick={()=>setLang('en')}>EN</button><button onClick={()=>setLang('ar')}>العربية</button></div></div>
   <div className='content'>

   {page==='dashboard'&&<>
    <h1>{t('Management Dashboard','لوحة معلومات الإدارة')}</h1>
    <div className='grid'>
     <div className='card kpi'><div className='label'>{t('Total Incidents','إجمالي الحوادث')}</div><div className='value'>{incidents.length}</div></div>
     <div className='card kpi'><div className='label'>{t('Open Incidents','الحوادث المفتوحة')}</div><div className='value'>{open}</div></div>
     <div className='card kpi'><div className='label'>{t('High / Critical','عالية / حرجة')}</div><div className='value'>{critical}</div></div>
     {isAdmin&&<div className='card kpi'><div className='label'>{t('Active Users','المستخدمون النشطون')}</div><div className='value'>{activeUsers}</div></div>}
    </div>
   </>}

   {page==='incidents'&&<>
    <div className='actions'><h1 style={{flex:1}}>{t('Incident Management','إدارة الحوادث')}</h1><button className='primary' onClick={()=>setPage('new')}>{t('New Incident','حادث جديد')}</button></div>
    <div className='card' style={{overflowX:'auto'}}><table><thead><tr><th>{t('No.','الرقم')}</th><th>{t('Date','التاريخ')}</th><th>{t('Category','الفئة')}</th><th>{t('Type','النوع')}</th><th>{t('Location','الموقع')}</th><th>{t('Severity','الخطورة')}</th><th>{t('Status','الحالة')}</th><th></th></tr></thead>
    <tbody>{incidents.map(i=><tr key={i.id}><td>{i.incident_no}</td><td>{i.incident_date?.slice(0,10)}</td><td>{i.category}</td><td>{i.incident_type}</td><td>{i.building||i.location}</td><td>{i.severity}</td><td>{i.status}</td><td><button onClick={()=>openIncident(i)}>{t('Open','فتح')}</button></td></tr>)}</tbody></table></div>
   </>}

   {page==='new'&&<>
    <h1>{t('New Incident','تسجيل حادث جديد')}</h1>
    <form className='card form' onSubmit={submitIncident}>
     <div className='row'><div><label>{t('Category','الفئة')}</label><select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}><option>Health & Safety</option><option>Physical Security</option><option>Fire & Life Safety</option><option>Facilities</option></select></div><div><label>{t('Incident Type','نوع الحادث')}</label><input required value={form.incident_type} onChange={e=>setForm({...form,incident_type:e.target.value})}/></div></div>
     <div className='row'><div><label>{t('Department','الإدارة')}</label><input value={form.department} onChange={e=>setForm({...form,department:e.target.value})}/></div><div><label>{t('Building','المبنى')}</label><input value={form.building} onChange={e=>setForm({...form,building:e.target.value})}/></div></div>
     <div className='row'><div><label>{t('Location','الموقع')}</label><input value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></div><div><label>{t('Severity','الخطورة')}</label><select value={form.severity} onChange={e=>setForm({...form,severity:e.target.value})}><option value='low'>{t('Low','منخفضة')}</option><option value='medium'>{t('Medium','متوسطة')}</option><option value='high'>{t('High','عالية')}</option><option value='critical'>{t('Critical','حرجة')}</option></select></div></div>
     <div><label>{t('Description','وصف الحادث')}</label><textarea required value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></div>
     <div><label>{t('Persons Involved','الأشخاص المعنيون')}</label><textarea value={form.persons_involved} onChange={e=>setForm({...form,persons_involved:e.target.value})}/></div>
     <label><input style={{width:'auto'}} type='checkbox' checked={form.injury} onChange={e=>setForm({...form,injury:e.target.checked})}/> {t('Injury','إصابة')}</label>
     <div><label>{t('Immediate Action','الإجراء الفوري')}</label><textarea value={form.immediate_action} onChange={e=>setForm({...form,immediate_action:e.target.value})}/></div>
     <button className='primary'>{t('Submit Incident','تسجيل الحادث')}</button>
    </form>
   </>}

   {page==='detail'&&selected&&<>
    <div className='actions'><button onClick={()=>setPage('incidents')}>{t('Back','رجوع')}</button><h1 style={{flex:1}}>{selected.incident_no}</h1><span>{selected.status}</span></div>
    <div className='grid2'>
     <div className='card'><p><b>{t('Category','الفئة')}:</b> {selected.category}</p><p><b>{t('Type','النوع')}:</b> {selected.incident_type}</p><p><b>{t('Severity','الخطورة')}:</b> {selected.severity}</p><p><b>{t('Building','المبنى')}:</b> {selected.building||'-'}</p><p><b>{t('Location','الموقع')}:</b> {selected.location||'-'}</p><p><b>{t('Injury','إصابة')}:</b> {selected.injury?t('Yes','نعم'):t('No','لا')}</p></div>
     <div className='card'><h3>{t('Description','الوصف')}</h3><p>{selected.description}</p><h3>{t('Immediate Action','الإجراء الفوري')}</h3><p>{selected.immediate_action||'-'}</p></div>
    </div>
    {manager&&<div className='card form' style={{marginTop:14}}>
     <h3>{t('Investigation & Root Cause','التحقيق وتحليل السبب الجذري')}</h3>
     <label>{t('Investigator','المحقق')}</label><select value={investigator} onChange={e=>setInvestigator(e.target.value)}><option value=''>{t('Unassigned','غير مسند')}</option>{users.filter(u=>u.active).map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}</select>
     <label>{t('Investigation Summary','ملخص التحقيق')}</label><textarea value={investigation} onChange={e=>setInvestigation(e.target.value)}/>
     <label>{t('Root Cause Analysis','تحليل السبب الجذري')}</label><textarea value={rootCause} onChange={e=>setRootCause(e.target.value)}/>
     <div className='actions'><button onClick={()=>saveInvestigation('under_investigation')}>{t('Save Investigation','حفظ التحقيق')}</button><button onClick={()=>saveInvestigation('pending_corrective_actions')}>{t('Corrective Actions Stage','مرحلة الإجراءات التصحيحية')}</button><button className='primary' onClick={()=>saveInvestigation('closed')}>{t('Close Incident','إغلاق الحادث')}</button></div>
    </div>}
    <div className='card' style={{marginTop:14}}>
     <h3>{t('Corrective Actions','الإجراءات التصحيحية')}</h3>
     <table><thead><tr><th>{t('Action','الإجراء')}</th><th>{t('Responsible','المسؤول')}</th><th>{t('Due Date','تاريخ الاستحقاق')}</th><th>{t('Status','الحالة')}</th><th></th></tr></thead>
     <tbody>{actions.map(a=>{const u=users.find(x=>x.id===a.responsible_user_id);return <tr key={a.id}><td>{a.action}</td><td>{u?.full_name||'-'}</td><td>{a.due_date||'-'}</td><td>{a.status}</td><td>{a.status!=='completed'&&(manager||a.responsible_user_id===session.user.id)&&<button onClick={()=>closeAction(a)}>{t('Complete','إكمال')}</button>}</td></tr>})}</tbody></table>
     {manager&&<div className='form' style={{marginTop:12}}><textarea placeholder={t('New corrective action','إجراء تصحيحي جديد')} value={ca} onChange={e=>setCa(e.target.value)}/><div className='row'><select value={caUser} onChange={e=>setCaUser(e.target.value)}><option value=''>{t('Responsible person','الشخص المسؤول')}</option>{users.filter(u=>u.active).map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}</select><input type='date' value={caDue} onChange={e=>setCaDue(e.target.value)}/></div><button onClick={addCorrective}>{t('Add Corrective Action','إضافة إجراء تصحيحي')}</button></div>}
    </div>
   </>}

   {page==='users'&&isAdmin&&<>
    <h1>{t('User Management','إدارة المستخدمين')}</h1>
    <div className='grid2'>
     <form className='card form' onSubmit={createUser}>
      <h3>{t('Create User','إنشاء مستخدم')}</h3>
      <div className='row'><div><label>{t('Username','اسم المستخدم')}</label><input required value={userForm.username} onChange={e=>setUserForm({...userForm,username:e.target.value})}/></div><div><label>{t('Full Name','الاسم الكامل')}</label><input required value={userForm.full_name} onChange={e=>setUserForm({...userForm,full_name:e.target.value})}/></div></div>
      <div><label>{t('Temporary Password','كلمة المرور المؤقتة')}</label><input type='password' minLength={10} required value={userForm.password} onChange={e=>setUserForm({...userForm,password:e.target.value})}/></div>
      <div className='row'><div><label>{t('Role','الصلاحية')}</label><select value={userForm.role} onChange={e=>setUserForm({...userForm,role:e.target.value})}><option value='staff'>{t('Staff','موظف')}</option><option value='supervisor'>{t('Supervisor','مشرف')}</option><option value='management'>{t('Management','الإدارة')}</option><option value='contractor'>{t('Contractor','مقاول')}</option><option value='viewer'>{t('Viewer','مشاهدة فقط')}</option><option value='admin'>{t('Admin','مدير النظام')}</option></select></div><div><label>{t('Department','الإدارة')}</label><select value={userForm.department} onChange={e=>setUserForm({...userForm,department:e.target.value})}><option>HSS</option><option>Physical Security</option><option>Health & Safety</option><option>Facilities</option><option>Agriculture</option></select></div></div>
      <label>{t('Module Access','صلاحيات الوحدات')}</label>
      {modules.map(([key,en,ar])=><label key={key} style={{display:'flex',alignItems:'center',gap:8,color:'#222'}}><input style={{width:'auto'}} type='checkbox' checked={!!userForm.module_permissions[key]} onChange={e=>setUserForm({...userForm,module_permissions:{...userForm.module_permissions,[key]:e.target.checked}})}/>{t(en,ar)}</label>)}
      <button className='primary'>{t('Create User','إنشاء المستخدم')}</button>{adminMsg&&<p>{adminMsg}</p>}
     </form>
     <div className='card'><h3>{t('User Administration','إدارة الحسابات')}</h3><p className='muted'>{t('New users log in with the username you provide and must change their temporary password on first login.','يسجل المستخدمون الجدد الدخول باسم المستخدم الذي تحدده، ويجب عليهم تغيير كلمة المرور المؤقتة عند أول دخول.')}</p><p>{t('Active users','المستخدمون النشطون')}: {activeUsers}</p><p>{t('Total users','إجمالي المستخدمين')}: {users.length}</p></div>
    </div>
    <div className='card' style={{marginTop:14,overflowX:'auto'}}>
     <table><thead><tr><th>{t('Username','اسم المستخدم')}</th><th>{t('Name','الاسم')}</th><th>{t('Role','الصلاحية')}</th><th>{t('Department','الإدارة')}</th><th>{t('Status','الحالة')}</th><th>{t('Actions','الإجراءات')}</th></tr></thead>
     <tbody>{users.map(u=><tr key={u.id}>
      <td>{u.username}</td><td>{u.full_name}</td>
      <td><select value={u.role} onChange={e=>updateUser(u.id,{role:e.target.value})}><option value='staff'>{t('Staff','موظف')}</option><option value='supervisor'>{t('Supervisor','مشرف')}</option><option value='management'>{t('Management','الإدارة')}</option><option value='contractor'>{t('Contractor','مقاول')}</option><option value='viewer'>{t('Viewer','مشاهدة فقط')}</option><option value='admin'>{t('Admin','مدير النظام')}</option></select></td>
      <td><select value={u.department} onChange={e=>updateUser(u.id,{department:e.target.value})}><option>HSS</option><option>Physical Security</option><option>Health & Safety</option><option>Facilities</option><option>Agriculture</option></select></td>
      <td>{u.active?t('Active','نشط'):t('Disabled','معطل')}{u.must_change_password?` · ${t('Password change required','يتطلب تغيير كلمة المرور')}`:''}</td>
      <td><div className='actions'><button onClick={()=>updateUser(u.id,{active:!u.active})}>{u.active?t('Disable','تعطيل'):t('Enable','تفعيل')}</button><button onClick={()=>resetPassword(u)}>{t('Reset Password','إعادة تعيين كلمة المرور')}</button></div></td>
     </tr>)}</tbody></table>
    </div>
   </>}
   </div>
  </main>
 </div>
}
