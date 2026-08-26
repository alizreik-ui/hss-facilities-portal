'use client';

import {useEffect, useMemo, useRef, useState} from 'react';
import {getSessionSafely,supabase} from '@/lib/supabase-browser';
import {
  Activity, AlertTriangle, BarChart3, CalendarDays, CheckCircle2,
  ClipboardCheck, Download, FileSpreadsheet, Filter, Mail, Paperclip,
  Plus, RefreshCw, Search, ShieldCheck, Upload, XCircle
} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Badge} from '@/components/ui/badge';
import {Progress} from '@/components/ui/progress';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';

type Lang = 'en' | 'ar';
type Service = {
  id:string; service_code:string; name_en:string; name_ar:string; module:string;
  contract_id?:string|null; frequency:string; planned_volume:number; unit:string; active:boolean;
};
type Contract = {id:string; contract_no:string; title:string; status:string; end_date?:string|null; contractors?:{company_name?:string}|null};
type RecordRow = {
  id:string; record_no:string; service_id:string; contract_id?:string|null; record_type:string;
  title:string; description?:string|null; building?:string|null; location?:string|null;
  planned_at?:string|null; due_at?:string|null; completed_at?:string|null; status:string;
  priority:string; planned_quantity:number; actual_quantity:number; assigned_to?:string|null;
  source_reference?:string|null; evidence_required:boolean; created_at:string;
};
type DraftRow = {
  title:string; description:string; building:string; location:string; planned_at:string;
  due_at:string; status:string; priority:string; planned_quantity:number; actual_quantity:number;
  source_reference:string;
};

const RECORD_TYPES = [
  ['planned_activity','Planned activity','نشاط مخطط'],
  ['task','Task','مهمة'],
  ['corrective_action','Corrective action','إجراء تصحيحي'],
  ['inspection_finding','Inspection finding','ملاحظة تفتيش'],
  ['fault','Fault / breakdown','عطل'],
  ['ppm','Preventive maintenance','صيانة وقائية'],
  ['violation','Violation','مخالفة'],
  ['incident','Incident','حادث'],
  ['asset','Asset / equipment','أصل / معدة'],
] as const;

const STATUS_OPTIONS = [
  ['planned','Planned','مخطط'], ['in_progress','In progress','قيد التنفيذ'],
  ['completed','Completed on time','مكتمل في الوقت'], ['completed_late','Completed late','مكتمل متأخراً'],
  ['partially_completed','Partially completed','مكتمل جزئياً'], ['missed','Missed','فائت'],
  ['overdue','Overdue','متأخر'], ['rescheduled','Rescheduled','أعيدت جدولته'],
  ['cancelled','Cancelled','ملغي'], ['verified','Verified','تم التحقق'],
] as const;

const emptyDraft = ():DraftRow => ({
  title:'', description:'', building:'', location:'', planned_at:'', due_at:'',
  status:'planned', priority:'medium', planned_quantity:1, actual_quantity:0, source_reference:''
});

function csvCell(value:unknown){
  const text=String(value??'');
  return /[",\n]/.test(text)?`"${text.replaceAll('"','""')}"`:text;
}

function parseCsv(text:string):Record<string,string>[] {
  const rows:string[][]=[]; let row:string[]=[]; let cell=''; let quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i], next=text[i+1];
    if(c==='"'&&quoted&&next==='"'){cell+='"';i++;continue}
    if(c==='"'){quoted=!quoted;continue}
    if(c===','&&!quoted){row.push(cell.trim());cell='';continue}
    if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&next==='\n')i++;row.push(cell.trim());if(row.some(Boolean))rows.push(row);row=[];cell='';continue}
    cell+=c;
  }
  if(cell||row.length){row.push(cell.trim());if(row.some(Boolean))rows.push(row)}
  if(rows.length<2)return [];
  const headers=rows[0].map(x=>x.trim().toLowerCase().replaceAll(' ','_'));
  return rows.slice(1).map(values=>Object.fromEntries(headers.map((h,i)=>[h,values[i]??''])));
}

function downloadBlob(name:string, content:string, type:string){
  const url=URL.createObjectURL(new Blob([content],{type}));
  const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);
}

function statusTone(status:string){
  if(['completed','verified','closed'].includes(status))return 'good';
  if(['missed','overdue','critical'].includes(status))return 'bad';
  if(['completed_late','partially_completed','rescheduled'].includes(status))return 'warn';
  return 'info';
}

export default function ServiceControlPage(){
  const [lang,setLang]=useState<Lang>('en');
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState('');
  const [session,setSession]=useState<any>(null);
  const [profile,setProfile]=useState<any>(null);
  const [services,setServices]=useState<Service[]>([]);
  const [contracts,setContracts]=useState<Contract[]>([]);
  const [records,setRecords]=useState<RecordRow[]>([]);
  const [evaluations,setEvaluations]=useState<any[]>([]);
  const [schedules,setSchedules]=useState<any[]>([]);
  const [selectedService,setSelectedService]=useState('all');
  const [selectedContract,setSelectedContract]=useState('all');
  const [selectedType,setSelectedType]=useState('all');
  const [selectedStatus,setSelectedStatus]=useState('all');
  const [fromDate,setFromDate]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().slice(0,10));
  const [toDate,setToDate]=useState(()=>new Date().toISOString().slice(0,10));
  const [query,setQuery]=useState('');
  const [drillFilter,setDrillFilter]=useState<'all'|'planned'|'completed'|'missed'|'corrective'>('all');
  const [selectedRecord,setSelectedRecord]=useState<RecordRow|null>(null);
  const [attachments,setAttachments]=useState<any[]>([]);
  const [uploadOpen,setUploadOpen]=useState(false);
  const [uploadType,setUploadType]=useState('task');
  const [uploadService,setUploadService]=useState('');
  const [draftRows,setDraftRows]=useState<DraftRow[]>([emptyDraft()]);
  const [fileNames,setFileNames]=useState<string[]>([]);
  const [serviceOpen,setServiceOpen]=useState(false);
  const [newService,setNewService]=useState({service_code:'',name_en:'',name_ar:'',module:'health_safety',contract_id:'',frequency:'monthly',planned_volume:1,unit:'activity'});
  const [evaluationOpen,setEvaluationOpen]=useState(false);
  const [evaluation,setEvaluation]=useState({contract_id:'',service_id:'',period_start:fromDate,period_end:toDate,notes:'',contractor_response:'',improvement_plan:''});
  const [criteria,setCriteria]=useState([
    {criterion:'Planned vs actual completion',weight:30,score:100,target_value:'100%',actual_value:''},
    {criterion:'SLA compliance',weight:20,score:100,target_value:'100%',actual_value:''},
    {criterion:'Service quality',weight:15,score:100,target_value:'Excellent',actual_value:''},
    {criterion:'Response and resolution time',weight:15,score:100,target_value:'Within SLA',actual_value:''},
    {criterion:'HSS compliance',weight:10,score:100,target_value:'100%',actual_value:''},
    {criterion:'Reporting and documentation',weight:10,score:100,target_value:'Complete',actual_value:''},
  ]);
  const [scheduleOpen,setScheduleOpen]=useState(false);
  const [schedule,setSchedule]=useState({name:'Monthly Service Summary',report_type:'service_performance',service_id:'',contract_id:'',frequency:'monthly',recipients:'',output_format:'pdf',send_time:'08:00'});
  const fileInput=useRef<HTMLInputElement>(null);
  const t=(en:string,ar:string)=>lang==='ar'?ar:en;
  const number=(v:any)=>new Intl.NumberFormat(lang==='ar'?'ar-QA':'en-US',{maximumFractionDigits:1}).format(Number(v||0));
  const date=(v:any)=>v?new Intl.DateTimeFormat(lang==='ar'?'ar-QA':'en-GB',{dateStyle:'medium',timeStyle:v.includes?.('T')?'short':undefined}).format(new Date(v)):'—';
  const canManage=['admin','management','supervisor'].includes(profile?.role);

  useEffect(()=>{
    document.documentElement.lang=lang;
    document.documentElement.dir=lang==='ar'?'rtl':'ltr';
  },[lang]);

  async function bootstrap(){
    setLoading(true);setMessage('');
    const {data:{session:s}}=await getSessionSafely();
    if(!s){location.replace('/');return}
    setSession(s);
    const [p,sv,ct,rc,ev,sc]=await Promise.all([
      supabase.from('profiles').select('*').eq('id',s.user.id).single(),
      supabase.from('services').select('*').eq('active',true).order('name_en'),
      supabase.from('contracts').select('id,contract_no,title,status,end_date,contractors(company_name)').order('created_at',{ascending:false}),
      supabase.from('service_records').select('*').order('planned_at',{ascending:false,nullsFirst:false}).limit(1000),
      supabase.from('contract_performance_evaluations').select('*,contracts(contract_no,title),services(name_en,name_ar)').order('period_start',{ascending:false}).limit(100),
      supabase.from('report_schedules').select('*,services(name_en,name_ar),contracts(contract_no)').order('created_at',{ascending:false}).limit(100),
    ]);
    setProfile(p.data);setServices((sv.data||[]) as Service[]);setContracts((ct.data||[]) as any);
    setRecords((rc.data||[]) as RecordRow[]);setEvaluations(ev.data||[]);setSchedules(sc.data||[]);
    if(!uploadService&&sv.data?.[0])setUploadService(sv.data[0].id);
    setLoading(false);
  }

  // Initial data load is intentionally run once; later mutations refresh explicitly.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(()=>{void bootstrap()},[]);

  const filtered=useMemo(()=>records.filter(r=>{
    const planned=(r.planned_at||r.created_at||'').slice(0,10);
    const text=`${r.record_no} ${r.title} ${r.description||''} ${r.building||''} ${r.location||''} ${r.source_reference||''}`.toLowerCase();
    if(selectedService!=='all'&&r.service_id!==selectedService)return false;
    if(selectedContract!=='all'&&r.contract_id!==selectedContract)return false;
    if(selectedType!=='all'&&r.record_type!==selectedType)return false;
    if(selectedStatus!=='all'&&r.status!==selectedStatus)return false;
    if(fromDate&&planned<fromDate)return false;
    if(toDate&&planned>toDate)return false;
    if(query&&!text.includes(query.toLowerCase()))return false;
    if(drillFilter==='planned'&&!['planned','in_progress','rescheduled'].includes(r.status))return false;
    if(drillFilter==='completed'&&!['completed','verified','closed','completed_late'].includes(r.status))return false;
    if(drillFilter==='missed'&&!['missed','overdue'].includes(r.status))return false;
    if(drillFilter==='corrective'&&r.record_type!=='corrective_action')return false;
    return true;
  }),[records,selectedService,selectedContract,selectedType,selectedStatus,fromDate,toDate,query,drillFilter]);

  const summary=useMemo(()=>{
    const base=records.filter(r=>{
      const d=(r.planned_at||r.created_at||'').slice(0,10);
      return (selectedService==='all'||r.service_id===selectedService)&&(selectedContract==='all'||r.contract_id===selectedContract)&&(!fromDate||d>=fromDate)&&(!toDate||d<=toDate);
    });
    const planned=base.filter(r=>r.status!=='cancelled').length;
    const completed=base.filter(r=>['completed','verified','closed','completed_late'].includes(r.status)).length;
    const missed=base.filter(r=>['missed','overdue'].includes(r.status)).length;
    const corrective=base.filter(r=>r.record_type==='corrective_action').length;
    const plannedQty=base.reduce((a,r)=>a+Number(r.planned_quantity||0),0);
    const actualQty=base.reduce((a,r)=>a+Number(r.actual_quantity||0),0);
    const pct=plannedQty?Math.min(100,Math.round(actualQty/plannedQty*1000)/10):(planned?Math.round(completed/planned*1000)/10:0);
    return {base,planned,completed,missed,corrective,plannedQty,actualQty,pct};
  },[records,selectedService,selectedContract,fromDate,toDate]);

  const monthly=useMemo(()=>{
    const map=new Map<string,{key:string,label:string,planned:number,actual:number,records:number}>();
    records.forEach(r=>{
      if(selectedService!=='all'&&r.service_id!==selectedService)return;
      if(selectedContract!=='all'&&r.contract_id!==selectedContract)return;
      const raw=r.planned_at||r.created_at;if(!raw)return;const key=raw.slice(0,7);
      const item=map.get(key)||{key,label:new Intl.DateTimeFormat(lang==='ar'?'ar-QA':'en-GB',{month:'short',year:'numeric'}).format(new Date(`${key}-01T12:00:00`)),planned:0,actual:0,records:0};
      item.planned+=Number(r.planned_quantity||0);item.actual+=Number(r.actual_quantity||0);item.records++;map.set(key,item);
    });
    return [...map.values()].sort((a,b)=>a.key.localeCompare(b.key)).slice(-12);
  },[records,selectedService,selectedContract,lang]);

  function serviceName(id:string){const s=services.find(x=>x.id===id);return s?(lang==='ar'?s.name_ar:s.name_en):'—'}
  function recordType(v:string){const x=RECORD_TYPES.find(r=>r[0]===v);return x?t(x[1],x[2]):v}
  function statusName(v:string){const x=STATUS_OPTIONS.find(r=>r[0]===v);return x?t(x[1],x[2]):v}

  function chooseDrill(next:typeof drillFilter){setDrillFilter(next);setTimeout(()=>document.getElementById('service-records')?.scrollIntoView({behavior:'smooth'}),50)}
  function resetFilters(){setSelectedService('all');setSelectedContract('all');setSelectedType('all');setSelectedStatus('all');setQuery('');setDrillFilter('all');setFromDate(new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().slice(0,10));setToDate(new Date().toISOString().slice(0,10))}

  async function readImportFiles(files:FileList|null){
    if(!files?.length)return;
    setFileNames([...files].map(f=>f.name));
    const imported:DraftRow[]=[];
    for(const file of [...files]){
      const lower=file.name.toLowerCase();
      try{
        let rows:Record<string,any>[]=[];
        if(lower.endsWith('.json')){
          const value=JSON.parse(await file.text());rows=Array.isArray(value)?value:value.records||[];
        }else if(lower.endsWith('.csv')) rows=parseCsv(await file.text());
        else {
          setMessage(t(`${file.name}: use CSV or JSON in this live version.`,`${file.name}: استخدم CSV أو JSON في هذه النسخة المباشرة.`));
          continue;
        }
        rows.forEach(x=>imported.push({
          title:String(x.title||x.task||x.action||x.finding||x.description||''),
          description:String(x.description||x.details||x.remarks||''),
          building:String(x.building||''),location:String(x.location||x.area||''),
          planned_at:String(x.planned_at||x.planned_date||x.date||''),due_at:String(x.due_at||x.due_date||''),
          status:String(x.status||'planned').toLowerCase().replaceAll(' ','_'),priority:String(x.priority||x.severity||'medium').toLowerCase(),
          planned_quantity:Number(x.planned_quantity||x.planned||1),actual_quantity:Number(x.actual_quantity||x.actual||0),
          source_reference:String(x.source_reference||x.reference||x.ref||'')
        }));
      }catch(error:any){setMessage(`${file.name}: ${error.message}`)}
    }
    if(imported.length)setDraftRows(imported);
  }

  async function saveBulk(){
    if(!session||!uploadService)return;
    const valid=draftRows.filter(r=>r.title.trim());if(!valid.length){setMessage(t('Add at least one titled row.','أضف صفاً واحداً على الأقل مع عنوان.'));return}
    setSaving(true);setMessage('');
    const service=services.find(s=>s.id===uploadService);
    const payload=valid.map(r=>({
      service_id:uploadService,contract_id:service?.contract_id||null,record_type:uploadType,title:r.title.trim(),description:r.description||null,
      building:r.building||null,location:r.location||null,planned_at:r.planned_at?new Date(r.planned_at).toISOString():null,
      due_at:r.due_at?new Date(r.due_at).toISOString():null,status:r.status||'planned',priority:r.priority||'medium',
      planned_quantity:Number(r.planned_quantity||0),actual_quantity:Number(r.actual_quantity||0),source_reference:r.source_reference||null,
      evidence_required:['corrective_action','inspection_finding','incident','fault'].includes(uploadType),created_by:session.user.id,
    }));
    const {error}=await supabase.from('service_records').insert(payload);
    if(error){setMessage(error.message);setSaving(false);return}
    setMessage(t(`${payload.length} records uploaded successfully.`,`تم تحميل ${payload.length} سجلاً بنجاح.`));
    setDraftRows([emptyDraft()]);setFileNames([]);setUploadOpen(false);setSaving(false);await bootstrap();
  }

  async function addService(){
    if(!session||!canManage)return;setSaving(true);
    const {error}=await supabase.from('services').insert({...newService,contract_id:newService.contract_id||null,planned_volume:Number(newService.planned_volume||0),created_by:session.user.id});
    if(error)setMessage(error.message);else{setMessage(t('Service created.','تم إنشاء الخدمة.'));setServiceOpen(false);setNewService({service_code:'',name_en:'',name_ar:'',module:'health_safety',contract_id:'',frequency:'monthly',planned_volume:1,unit:'activity'});await bootstrap()}
    setSaving(false);
  }

  async function openRecord(r:RecordRow){
    setSelectedRecord(r);const {data}=await supabase.from('record_attachments').select('*').eq('service_record_id',r.id).order('created_at',{ascending:false});setAttachments(data||[]);
  }

  async function updateRecord(status:string,actual?:number){
    if(!selectedRecord)return;setSaving(true);
    const update:any={status,updated_at:new Date().toISOString()};
    if(actual!==undefined)update.actual_quantity=actual;
    if(['completed','completed_late','verified','closed'].includes(status))update.completed_at=new Date().toISOString();
    const {data,error}=await supabase.from('service_records').update(update).eq('id',selectedRecord.id).select().single();
    if(error)setMessage(error.message);else{setSelectedRecord(data);setMessage(t('Record updated.','تم تحديث السجل.'));await bootstrap()}
    setSaving(false);
  }

  async function uploadAttachments(files:FileList|null){
    if(!files?.length||!session||!selectedRecord)return;setSaving(true);
    for(const file of [...files]){
      const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');const path=`${session.user.id}/${selectedRecord.id}/${Date.now()}-${safe}`;
      const {error}=await supabase.storage.from('hss-attachments').upload(path,file,{upsert:false,contentType:file.type});
      if(error){setMessage(error.message);continue}
      await supabase.from('record_attachments').insert({service_record_id:selectedRecord.id,file_name:file.name,storage_path:path,content_type:file.type,file_size:file.size,uploaded_by:session.user.id});
    }
    const {data}=await supabase.from('record_attachments').select('*').eq('service_record_id',selectedRecord.id).order('created_at',{ascending:false});setAttachments(data||[]);setSaving(false);
  }

  async function openAttachment(a:any){const {data,error}=await supabase.storage.from('hss-attachments').createSignedUrl(a.storage_path,300);if(error)setMessage(error.message);else window.open(data.signedUrl,'_blank','noopener,noreferrer')}

  const weightedScore=useMemo(()=>Math.round(criteria.reduce((sum,c)=>sum+(Number(c.weight)||0)*(Number(c.score)||0)/100,0)*10)/10,[criteria]);
  function rating(score:number){return score>=90?'Excellent':score>=80?'Good':score>=70?'Satisfactory':score>=60?'Needs Improvement':'Unsatisfactory'}

  async function saveEvaluation(){
    if(!session||!evaluation.contract_id)return;setSaving(true);
    const relevant=records.filter(r=>r.contract_id===evaluation.contract_id&&(!evaluation.service_id||r.service_id===evaluation.service_id)&&((r.planned_at||r.created_at).slice(0,10)>=evaluation.period_start)&&((r.planned_at||r.created_at).slice(0,10)<=evaluation.period_end));
    const planned=relevant.reduce((a,r)=>a+Number(r.planned_quantity||0),0),actual=relevant.reduce((a,r)=>a+Number(r.actual_quantity||0),0),completion=planned?Math.min(100,actual/planned*100):0;
    const {data,error}=await supabase.from('contract_performance_evaluations').insert({...evaluation,service_id:evaluation.service_id||null,planned_count:planned,actual_count:actual,completion_percentage:completion,overall_score:weightedScore,rating:rating(weightedScore),status:'submitted',evaluator_id:session.user.id}).select().single();
    if(error){setMessage(error.message);setSaving(false);return}
    const {error:itemError}=await supabase.from('contract_performance_items').insert(criteria.map((c,i)=>({...c,evaluation_id:data.id,sort_order:i+1})));
    if(itemError)setMessage(itemError.message);else{setMessage(t('Performance evaluation saved.','تم حفظ تقييم الأداء.'));setEvaluationOpen(false);await bootstrap()}
    setSaving(false);
  }

  async function saveSchedule(){
    if(!session||!schedule.recipients.trim())return;setSaving(true);
    const recipients=schedule.recipients.split(/[;,]/).map(x=>x.trim()).filter(Boolean);
    const next=new Date(),[hours,minutes]=schedule.send_time.split(':').map(Number);next.setHours(hours||0,minutes||0,0,0);if(schedule.frequency==='daily')next.setDate(next.getDate()+1);if(schedule.frequency==='weekly')next.setDate(next.getDate()+7);if(schedule.frequency==='monthly'){next.setDate(1);next.setMonth(next.getMonth()+1)}
    const {error}=await supabase.from('report_schedules').insert({...schedule,service_id:schedule.service_id||null,contract_id:schedule.contract_id||null,recipients,next_run_at:next.toISOString(),created_by:session.user.id,filters:{from:fromDate,to:toDate,type:selectedType,status:selectedStatus}});
    if(error)setMessage(error.message);else{setMessage(t('Automatic email schedule saved.','تم حفظ جدول البريد الإلكتروني التلقائي.'));setScheduleOpen(false);await bootstrap()}
    setSaving(false);
  }

  function exportCsv(){
    const headers=['Reference','Service','Type','Title','Building','Location','Planned','Due','Status','Priority','Planned Qty','Actual Qty'];
    const rows=filtered.map(r=>[r.record_no,serviceName(r.service_id),recordType(r.record_type),r.title,r.building,r.location,r.planned_at,r.due_at,statusName(r.status),r.priority,r.planned_quantity,r.actual_quantity]);
    downloadBlob(`hss-report-${fromDate}-${toDate}.csv`,[headers,...rows].map(row=>row.map(csvCell).join(',')).join('\n'),'text/csv;charset=utf-8');
  }

  function exportExcel(){
    const rows=filtered.map(r=>`<tr><td>${r.record_no}</td><td>${serviceName(r.service_id)}</td><td>${recordType(r.record_type)}</td><td>${r.title}</td><td>${date(r.planned_at)}</td><td>${statusName(r.status)}</td><td>${r.planned_quantity}</td><td>${r.actual_quantity}</td></tr>`).join('');
    const html=`<html><head><meta charset="utf-8"></head><body><h2>HSS Service Report</h2><p>${fromDate} — ${toDate}</p><table border="1"><tr><th>Reference</th><th>Service</th><th>Type</th><th>Title</th><th>Planned</th><th>Status</th><th>Planned Qty</th><th>Actual Qty</th></tr>${rows}</table></body></html>`;
    downloadBlob(`hss-report-${fromDate}-${toDate}.xls`,html,'application/vnd.ms-excel');
  }

  function exportPdf(){
    const w=window.open('','_blank','width=1100,height=800');if(!w)return;
    const rows=filtered.map(r=>`<tr><td>${r.record_no}</td><td>${serviceName(r.service_id)}</td><td>${recordType(r.record_type)}</td><td>${r.title}</td><td>${date(r.planned_at)}</td><td>${statusName(r.status)}</td><td>${r.planned_quantity}</td><td>${r.actual_quantity}</td></tr>`).join('');
    w.document.write(`<html dir="${lang==='ar'?'rtl':'ltr'}"><head><title>HSS Report</title><style>body{font-family:Arial;padding:28px;color:#13233a}h1{color:#005b8c}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #ccd7e2;padding:7px;text-align:start}th{background:#eaf4f8}@page{size:A4 landscape;margin:12mm}</style></head><body><h1>${t('HSS Service Performance Report','تقرير أداء خدمات الصحة والسلامة والأمن')}</h1><p>${fromDate} — ${toDate} | ${t('Generated','تم الإنشاء')}: ${new Date().toLocaleString()}</p><p>${t('Planned','المخطط')}: ${summary.plannedQty} | ${t('Actual','الفعلي')}: ${summary.actualQty} | ${t('Completion','الإنجاز')}: ${summary.pct}%</p><table><tr><th>${t('Reference','المرجع')}</th><th>${t('Service','الخدمة')}</th><th>${t('Type','النوع')}</th><th>${t('Title','العنوان')}</th><th>${t('Planned','المخطط')}</th><th>${t('Status','الحالة')}</th><th>${t('Planned Qty','الكمية المخططة')}</th><th>${t('Actual Qty','الكمية الفعلية')}</th></tr>${rows}</table><script>window.onload=()=>window.print()</script></body></html>`);w.document.close();
  }

  function downloadTemplate(){
    downloadBlob('hss-bulk-upload-template.csv','title,description,building,location,planned_date,due_date,status,priority,planned_quantity,actual_quantity,source_reference\nExample task,Monthly inspection,English Building,Level 1,2026-08-01,2026-08-03,planned,medium,1,0,REF-001','text/csv');
  }

  if(loading)return <main className="svc-loading"><RefreshCw className="animate-spin"/><span>{t('Loading centralized service control…','جارٍ تحميل مركز إدارة الخدمات…')}</span></main>;

  return <main className="svc-shell">
    <header className="svc-topbar">
      <div className="svc-brand"><div className="svc-mark">HSS</div><div><span>{t('Centralized Portal','البوابة المركزية')}</span><small>{t('Services • Contracts • Performance','الخدمات • العقود • الأداء')}</small></div></div>
      <div className="svc-top-actions"><a href="/command-center">{t('Command Center','مركز القيادة')}</a><a href="/portal">{t('All Modules','جميع الوحدات')}</a><Button variant="outline" onClick={()=>setLang(lang==='en'?'ar':'en')}>{lang==='en'?'العربية':'English'}</Button></div>
    </header>

    <section className="svc-hero">
      <div><p>{t('HSS SERVICE CONTROL','مركز التحكم بخدمات الإدارة')}</p><h1>{t('One view from plan to verified completion','رؤية موحدة من التخطيط حتى التحقق من الإنجاز')}</h1><span>{t('Every number, chart, task and status opens its underlying records.','كل رقم ورسم ومهمة وحالة تفتح السجلات المرتبطة بها.')}</span></div>
      <div className="svc-hero-actions">
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}><DialogTrigger asChild><Button><Upload/>{t('Bulk upload','تحميل جماعي')}</Button></DialogTrigger>{bulkDialog()}</Dialog>
        {canManage&&<Dialog open={serviceOpen} onOpenChange={setServiceOpen}><DialogTrigger asChild><Button variant="outline"><Plus/>{t('Add service','إضافة خدمة')}</Button></DialogTrigger>{serviceDialog()}</Dialog>}
      </div>
    </section>

    {message&&<div className="svc-message"><span>{message}</span><button onClick={()=>setMessage('')} aria-label="Close"><XCircle/></button></div>}

    <section className="svc-filterbar">
      <div className="svc-search"><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={t('Search reference, task, location…','ابحث بالمرجع أو المهمة أو الموقع…')}/></div>
      <select value={selectedService} onChange={e=>{setSelectedService(e.target.value);setDrillFilter('all')}}><option value="all">{t('All services','جميع الخدمات')}</option>{services.map(s=><option key={s.id} value={s.id}>{lang==='ar'?s.name_ar:s.name_en}</option>)}</select>
      <select value={selectedContract} onChange={e=>setSelectedContract(e.target.value)}><option value="all">{t('All contracts','جميع العقود')}</option>{contracts.map(c=><option key={c.id} value={c.id}>{c.contract_no} — {c.title}</option>)}</select>
      <label><span>{t('From','من')}</span><input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)}/></label>
      <label><span>{t('To','إلى')}</span><input type="date" value={toDate} onChange={e=>setToDate(e.target.value)}/></label>
      <Button variant="ghost" onClick={resetFilters}><Filter/>{t('Reset','إعادة ضبط')}</Button>
    </section>

    <section className="svc-kpis">
      {kpi('planned',CalendarDays,t('Planned records','السجلات المخططة'),summary.planned,`${number(summary.plannedQty)} ${t('planned units','وحدة مخططة')}`,'blue')}
      {kpi('completed',CheckCircle2,t('Completed','المكتمل'),summary.completed,`${number(summary.actualQty)} ${t('actual units','وحدة فعلية')}`,'green')}
      {kpi('missed',AlertTriangle,t('Missed / overdue','الفائت / المتأخر'),summary.missed,t('Requires action','يتطلب إجراء'),'red')}
      {kpi('corrective',ClipboardCheck,t('Corrective actions','الإجراءات التصحيحية'),summary.corrective,t('Open the action register','فتح سجل الإجراءات'),'orange')}
      {kpi('all',Activity,t('Completion','نسبة الإنجاز'),`${number(summary.pct)}%`,`${number(summary.actualQty)} / ${number(summary.plannedQty)}`,'teal',summary.pct)}
    </section>

    <Tabs defaultValue="records" className="svc-tabs">
      <TabsList className="svc-tabs-list">
        <TabsTrigger value="records"><ClipboardCheck/>{t('Service records','سجلات الخدمات')}</TabsTrigger>
        <TabsTrigger value="monthly"><BarChart3/>{t('Monthly planned vs actual','التقرير الشهري: مخطط مقابل فعلي')}</TabsTrigger>
        <TabsTrigger value="performance"><ShieldCheck/>{t('Contract performance','تقييم أداء العقود')}</TabsTrigger>
        <TabsTrigger value="email"><Mail/>{t('Automatic reports','التقارير التلقائية')}</TabsTrigger>
      </TabsList>

      <TabsContent value="records" id="service-records">
        <section className="svc-panel">
          <div className="svc-panel-head"><div><h2>{t('Service record register','سجل الخدمات والمهام')}</h2><p>{t(`${filtered.length} filtered records`,`${filtered.length} سجلاً حسب عوامل التصفية`)}</p></div><div className="svc-actions">
            <select value={selectedType} onChange={e=>setSelectedType(e.target.value)}><option value="all">{t('All types','جميع الأنواع')}</option>{RECORD_TYPES.map(x=><option key={x[0]} value={x[0]}>{t(x[1],x[2])}</option>)}</select>
            <select value={selectedStatus} onChange={e=>setSelectedStatus(e.target.value)}><option value="all">{t('All statuses','جميع الحالات')}</option>{STATUS_OPTIONS.map(x=><option key={x[0]} value={x[0]}>{t(x[1],x[2])}</option>)}</select>
            <Button variant="outline" onClick={exportCsv}><Download/>CSV</Button><Button variant="outline" onClick={exportExcel}><FileSpreadsheet/>Excel</Button><Button variant="outline" onClick={exportPdf}><Download/>PDF</Button>
          </div></div>
          <Table><TableHeader><TableRow><TableHead>{t('Reference','المرجع')}</TableHead><TableHead>{t('Service','الخدمة')}</TableHead><TableHead>{t('Type','النوع')}</TableHead><TableHead>{t('Task / action','المهمة / الإجراء')}</TableHead><TableHead>{t('Planned','المخطط')}</TableHead><TableHead>{t('Actual','الفعلي')}</TableHead><TableHead>{t('Due','الاستحقاق')}</TableHead><TableHead>{t('Status','الحالة')}</TableHead></TableRow></TableHeader><TableBody>
            {filtered.map(r=><TableRow key={r.id} className="svc-click-row" onClick={()=>openRecord(r)}><TableCell className="svc-ref">{r.record_no}</TableCell><TableCell>{serviceName(r.service_id)}</TableCell><TableCell>{recordType(r.record_type)}</TableCell><TableCell><strong>{r.title}</strong><small>{r.building||r.location||'—'}</small></TableCell><TableCell>{number(r.planned_quantity)}</TableCell><TableCell>{number(r.actual_quantity)}</TableCell><TableCell>{date(r.due_at||r.planned_at)}</TableCell><TableCell><span className={`svc-status ${statusTone(r.status)}`}>{statusName(r.status)}</span></TableCell></TableRow>)}
            {!filtered.length&&<TableRow><TableCell colSpan={8}><div className="svc-empty">{t('No records match these filters. Upload records or change the filters.','لا توجد سجلات مطابقة. حمّل السجلات أو غيّر عوامل التصفية.')}</div></TableCell></TableRow>}
          </TableBody></Table>
        </section>
      </TabsContent>

      <TabsContent value="monthly">
        <section className="svc-panel"><div className="svc-panel-head"><div><h2>{t('Monthly service performance','أداء الخدمات الشهري')}</h2><p>{t('Click a month to open its individual activities.','اضغط على الشهر لفتح الأنشطة الفردية.')}</p></div><div className="svc-actions"><Button variant="outline" onClick={exportExcel}><FileSpreadsheet/>{t('Export report','تصدير التقرير')}</Button></div></div>
          <div className="svc-month-grid">{monthly.map(m=>{const pct=m.planned?Math.min(100,Math.round(m.actual/m.planned*100)):0;return <button key={m.key} className="svc-month" onClick={()=>{setFromDate(`${m.key}-01`);setToDate(new Date(Number(m.key.slice(0,4)),Number(m.key.slice(5,7)),0).toISOString().slice(0,10));setDrillFilter('all');document.querySelector<HTMLElement>('[data-slot=tabs-trigger][value=records]')?.click()}}><div><strong>{m.label}</strong><span>{m.records} {t('records','سجل')}</span></div><div className="svc-month-values"><span>{t('Planned','المخطط')} <b>{number(m.planned)}</b></span><span>{t('Actual','الفعلي')} <b>{number(m.actual)}</b></span></div><Progress value={pct}/><small>{pct}% {t('completed','إنجاز')}</small></button>})}{!monthly.length&&<div className="svc-empty">{t('Monthly performance will appear after service records are added.','سيظهر الأداء الشهري بعد إضافة سجلات الخدمات.')}</div>}</div>
        </section>
      </TabsContent>

      <TabsContent value="performance">
        <section className="svc-panel"><div className="svc-panel-head"><div><h2>{t('Contract performance evaluations','تقييمات أداء العقود')}</h2><p>{t('Weighted evaluation with planned-versus-actual completion and supporting evidence.','تقييم موزون يشمل الإنجاز المخطط مقابل الفعلي والأدلة الداعمة.')}</p></div>{canManage&&<Dialog open={evaluationOpen} onOpenChange={setEvaluationOpen}><DialogTrigger asChild><Button><Plus/>{t('New evaluation','تقييم جديد')}</Button></DialogTrigger>{evaluationDialog()}</Dialog>}</div>
          <div className="svc-eval-grid">{evaluations.map(e=><article key={e.id} className="svc-eval-card"><div><Badge variant="outline">{e.evaluation_no}</Badge><span className={`svc-rating ${statusTone(e.overall_score>=80?'completed':e.overall_score>=60?'completed_late':'overdue')}`}>{t(e.rating||'Draft',ratingArabic(e.rating))}</span></div><h3>{e.contracts?.contract_no} — {e.contracts?.title}</h3><p>{e.services?(lang==='ar'?e.services.name_ar:e.services.name_en):t('All contract services','جميع خدمات العقد')}</p><strong>{number(e.overall_score)}%</strong><Progress value={e.overall_score}/><footer><span>{date(e.period_start)} — {date(e.period_end)}</span><span>{number(e.completion_percentage)}% {t('completion','إنجاز')}</span></footer></article>)}{!evaluations.length&&<div className="svc-empty">{t('No performance evaluations yet.','لا توجد تقييمات أداء حتى الآن.')}</div>}</div>
        </section>
      </TabsContent>

      <TabsContent value="email">
        <section className="svc-panel"><div className="svc-panel-head"><div><h2>{t('Scheduled automatic reports','التقارير التلقائية المجدولة')}</h2><p>{t('Daily, weekly or monthly summaries with the selected service filters.','ملخصات يومية أو أسبوعية أو شهرية وفق عوامل تصفية الخدمة المحددة.')}</p></div>{canManage&&<Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}><DialogTrigger asChild><Button><Mail/>{t('Schedule email','جدولة بريد')}</Button></DialogTrigger>{scheduleDialog()}</Dialog>}</div>
          <Table><TableHeader><TableRow><TableHead>{t('Schedule','الجدول')}</TableHead><TableHead>{t('Service / contract','الخدمة / العقد')}</TableHead><TableHead>{t('Frequency','التكرار')}</TableHead><TableHead>{t('Recipients','المستلمون')}</TableHead><TableHead>{t('Format','التنسيق')}</TableHead><TableHead>{t('Next run','التشغيل القادم')}</TableHead><TableHead>{t('Status','الحالة')}</TableHead></TableRow></TableHeader><TableBody>{schedules.map(s=><TableRow key={s.id}><TableCell><strong>{s.name}</strong></TableCell><TableCell>{s.services?(lang==='ar'?s.services.name_ar:s.services.name_en):s.contracts?.contract_no||t('All services','جميع الخدمات')}</TableCell><TableCell>{s.frequency}</TableCell><TableCell>{(s.recipients||[]).join(', ')}</TableCell><TableCell>{s.output_format?.toUpperCase()}</TableCell><TableCell>{date(s.next_run_at)}</TableCell><TableCell><span className={`svc-status ${s.enabled?'good':'warn'}`}>{s.enabled?t('Active','نشط'):t('Paused','متوقف')}</span></TableCell></TableRow>)}</TableBody></Table>
        </section>
      </TabsContent>
    </Tabs>

    {recordDialog()}
  </main>;

  function kpi(filter:typeof drillFilter,Icon:any,label:string,value:any,sub:string,color:string,progress?:number){return <button className={`svc-kpi ${color} ${drillFilter===filter?'active':''}`} onClick={()=>chooseDrill(filter)}><div className="svc-kpi-icon"><Icon/></div><div><span>{label}</span><strong>{value}</strong><small>{sub}</small>{progress!==undefined&&<Progress value={progress}/>}</div><span className="svc-open">↗</span></button>}

  function bulkDialog(){return <DialogContent className="svc-dialog svc-dialog-wide"><DialogHeader><DialogTitle>{t('Bulk upload records for a service','تحميل سجلات متعددة لخدمة')}</DialogTitle><DialogDescription>{t('Upload multiple tasks, corrective actions, findings, activities, faults, incidents or assets in one operation.','حمّل عدة مهام أو إجراءات تصحيحية أو ملاحظات أو أنشطة أو أعطال أو حوادث أو أصول دفعة واحدة.')}</DialogDescription></DialogHeader>
    <div className="svc-form-grid"><label>{t('Service','الخدمة')}<select value={uploadService} onChange={e=>setUploadService(e.target.value)}>{services.map(s=><option key={s.id} value={s.id}>{lang==='ar'?s.name_ar:s.name_en}</option>)}</select></label><label>{t('Record type','نوع السجل')}<select value={uploadType} onChange={e=>setUploadType(e.target.value)}>{RECORD_TYPES.map(x=><option key={x[0]} value={x[0]}>{t(x[1],x[2])}</option>)}</select></label></div>
    <div className="svc-drop" onClick={()=>fileInput.current?.click()}><Upload/><strong>{t('Choose multiple CSV or JSON files','اختر عدة ملفات CSV أو JSON')}</strong><span>{t('Or add several rows manually below','أو أضف عدة صفوف يدوياً أدناه')}</span><input ref={fileInput} hidden type="file" multiple accept=".csv,.json" onChange={e=>readImportFiles(e.target.files)}/></div>
    {fileNames.length>0&&<div className="svc-file-list">{fileNames.map(x=><Badge key={x} variant="secondary">{x}</Badge>)}</div>}
    <div className="svc-bulk-actions"><Button variant="outline" onClick={downloadTemplate}><Download/>{t('Download template','تنزيل القالب')}</Button><Button variant="outline" onClick={()=>setDraftRows([...draftRows,emptyDraft()])}><Plus/>{t('Add row','إضافة صف')}</Button></div>
    <div className="svc-draft-table"><Table><TableHeader><TableRow><TableHead>{t('Title','العنوان')}*</TableHead><TableHead>{t('Location','الموقع')}</TableHead><TableHead>{t('Planned date','تاريخ التخطيط')}</TableHead><TableHead>{t('Due date','الاستحقاق')}</TableHead><TableHead>{t('Status','الحالة')}</TableHead><TableHead>{t('Planned','المخطط')}</TableHead><TableHead>{t('Actual','الفعلي')}</TableHead><TableHead></TableHead></TableRow></TableHeader><TableBody>{draftRows.map((r,i)=><TableRow key={i}><TableCell><input value={r.title} onChange={e=>patchDraft(i,{title:e.target.value})}/></TableCell><TableCell><input value={r.location} onChange={e=>patchDraft(i,{location:e.target.value})}/></TableCell><TableCell><input type="datetime-local" value={r.planned_at} onChange={e=>patchDraft(i,{planned_at:e.target.value})}/></TableCell><TableCell><input type="datetime-local" value={r.due_at} onChange={e=>patchDraft(i,{due_at:e.target.value})}/></TableCell><TableCell><select value={r.status} onChange={e=>patchDraft(i,{status:e.target.value})}>{STATUS_OPTIONS.map(x=><option key={x[0]} value={x[0]}>{t(x[1],x[2])}</option>)}</select></TableCell><TableCell><input type="number" min="0" value={r.planned_quantity} onChange={e=>patchDraft(i,{planned_quantity:Number(e.target.value)})}/></TableCell><TableCell><input type="number" min="0" value={r.actual_quantity} onChange={e=>patchDraft(i,{actual_quantity:Number(e.target.value)})}/></TableCell><TableCell><Button size="icon-sm" variant="ghost" onClick={()=>setDraftRows(draftRows.filter((_,j)=>j!==i))}><XCircle/></Button></TableCell></TableRow>)}</TableBody></Table></div>
    <DialogFooter><Button variant="outline" onClick={()=>setUploadOpen(false)}>{t('Cancel','إلغاء')}</Button><Button disabled={saving} onClick={saveBulk}>{saving?t('Uploading…','جارٍ التحميل…'):t(`Upload ${draftRows.filter(x=>x.title).length} records`,`تحميل ${draftRows.filter(x=>x.title).length} سجلاً`)}</Button></DialogFooter>
  </DialogContent>}

  function patchDraft(i:number,patch:Partial<DraftRow>){setDraftRows(draftRows.map((r,j)=>j===i?{...r,...patch}:r))}

  function serviceDialog(){return <DialogContent className="svc-dialog"><DialogHeader><DialogTitle>{t('Create a managed service','إنشاء خدمة مدارة')}</DialogTitle><DialogDescription>{t('Connect planning, tasks, contract, reporting and performance in one service record.','اربط التخطيط والمهام والعقد والتقارير والأداء في سجل خدمة واحد.')}</DialogDescription></DialogHeader><div className="svc-form-stack"><label>{t('Service code','رمز الخدمة')}<input value={newService.service_code} onChange={e=>setNewService({...newService,service_code:e.target.value})}/></label><label>{t('English name','الاسم بالإنجليزية')}<input value={newService.name_en} onChange={e=>setNewService({...newService,name_en:e.target.value})}/></label><label>{t('Arabic name','الاسم بالعربية')}<input dir="rtl" value={newService.name_ar} onChange={e=>setNewService({...newService,name_ar:e.target.value})}/></label><div className="svc-form-grid"><label>{t('Module','الوحدة')}<select value={newService.module} onChange={e=>setNewService({...newService,module:e.target.value})}><option value="physical_security">{t('Physical Security','الأمن المادي')}</option><option value="health_safety">{t('Health & Safety','الصحة والسلامة')}</option><option value="fire_life_safety">{t('Fire & Life Safety','السلامة من الحريق')}</option><option value="facilities">{t('Facilities','المرافق')}</option></select></label><label>{t('Contract','العقد')}<select value={newService.contract_id} onChange={e=>setNewService({...newService,contract_id:e.target.value})}><option value="">{t('No contract','بدون عقد')}</option>{contracts.map(c=><option key={c.id} value={c.id}>{c.contract_no} — {c.title}</option>)}</select></label></div><div className="svc-form-grid"><label>{t('Frequency','التكرار')}<select value={newService.frequency} onChange={e=>setNewService({...newService,frequency:e.target.value})}><option value="daily">{t('Daily','يومي')}</option><option value="weekly">{t('Weekly','أسبوعي')}</option><option value="monthly">{t('Monthly','شهري')}</option><option value="quarterly">{t('Quarterly','ربع سنوي')}</option><option value="annual">{t('Annual','سنوي')}</option><option value="continuous">{t('Continuous','مستمر')}</option></select></label><label>{t('Planned volume','الحجم المخطط')}<input type="number" min="0" value={newService.planned_volume} onChange={e=>setNewService({...newService,planned_volume:Number(e.target.value)})}/></label></div></div><DialogFooter><Button variant="outline" onClick={()=>setServiceOpen(false)}>{t('Cancel','إلغاء')}</Button><Button disabled={saving||!newService.service_code||!newService.name_en||!newService.name_ar} onClick={addService}>{t('Create service','إنشاء الخدمة')}</Button></DialogFooter></DialogContent>}

  function recordDialog(){return <Dialog open={!!selectedRecord} onOpenChange={v=>!v&&setSelectedRecord(null)}><DialogContent className="svc-dialog svc-dialog-record">{selectedRecord&&<><DialogHeader><div className="svc-record-title"><div><Badge variant="outline">{selectedRecord.record_no}</Badge><DialogTitle>{selectedRecord.title}</DialogTitle><DialogDescription>{serviceName(selectedRecord.service_id)} • {recordType(selectedRecord.record_type)}</DialogDescription></div><span className={`svc-status ${statusTone(selectedRecord.status)}`}>{statusName(selectedRecord.status)}</span></div></DialogHeader><div className="svc-detail-grid"><Info label={t('Description','الوصف')} value={selectedRecord.description||'—'}/><Info label={t('Building / location','المبنى / الموقع')} value={[selectedRecord.building,selectedRecord.location].filter(Boolean).join(' • ')||'—'}/><Info label={t('Planned date','تاريخ التخطيط')} value={date(selectedRecord.planned_at)}/><Info label={t('Due date','تاريخ الاستحقاق')} value={date(selectedRecord.due_at)}/><Info label={t('Planned quantity','الكمية المخططة')} value={number(selectedRecord.planned_quantity)}/><Info label={t('Actual quantity','الكمية الفعلية')} value={number(selectedRecord.actual_quantity)}/><Info label={t('Priority','الأولوية')} value={selectedRecord.priority}/><Info label={t('Source reference','مرجع المصدر')} value={selectedRecord.source_reference||'—'}/></div><section className="svc-attachments"><div><h3><Paperclip/>{t('Photos and attachments','الصور والمرفقات')}</h3><label className="svc-attach-button"><Upload/>{t('Upload multiple files','تحميل عدة ملفات')}<input hidden type="file" multiple accept="image/*,video/mp4,.pdf,.docx,.xlsx,.csv" onChange={e=>uploadAttachments(e.target.files)}/></label></div>{attachments.length?<div className="svc-file-list">{attachments.map(a=><button key={a.id} onClick={()=>openAttachment(a)}><Paperclip/><span>{a.file_name}</span><small>{Math.round((a.file_size||0)/1024)} KB</small></button>)}</div>:<p>{t('No attachments uploaded.','لم يتم تحميل مرفقات.')}</p>}</section><DialogFooter><Button variant="outline" onClick={()=>updateRecord('in_progress')}>{t('Start','بدء')}</Button><Button variant="outline" onClick={()=>updateRecord('completed_late',Number(selectedRecord.actual_quantity||selectedRecord.planned_quantity))}>{t('Complete late','إكمال متأخر')}</Button><Button onClick={()=>updateRecord('completed',Number(selectedRecord.actual_quantity||selectedRecord.planned_quantity))}>{t('Complete','إكمال')}</Button></DialogFooter></>}</DialogContent></Dialog>}

  function evaluationDialog(){return <DialogContent className="svc-dialog svc-dialog-wide"><DialogHeader><DialogTitle>{t('Contract performance evaluation','تقييم أداء العقد')}</DialogTitle><DialogDescription>{t('The weighted score is calculated automatically and linked to planned-versus-actual records.','تُحسب النتيجة الموزونة تلقائياً وتُربط بسجلات المخطط مقابل الفعلي.')}</DialogDescription></DialogHeader><div className="svc-form-grid"><label>{t('Contract','العقد')}<select value={evaluation.contract_id} onChange={e=>setEvaluation({...evaluation,contract_id:e.target.value})}><option value="">{t('Select contract','اختر العقد')}</option>{contracts.map(c=><option key={c.id} value={c.id}>{c.contract_no} — {c.title}</option>)}</select></label><label>{t('Service','الخدمة')}<select value={evaluation.service_id} onChange={e=>setEvaluation({...evaluation,service_id:e.target.value})}><option value="">{t('All contract services','جميع خدمات العقد')}</option>{services.filter(s=>!evaluation.contract_id||s.contract_id===evaluation.contract_id).map(s=><option key={s.id} value={s.id}>{lang==='ar'?s.name_ar:s.name_en}</option>)}</select></label><label>{t('Period start','بداية الفترة')}<input type="date" value={evaluation.period_start} onChange={e=>setEvaluation({...evaluation,period_start:e.target.value})}/></label><label>{t('Period end','نهاية الفترة')}<input type="date" value={evaluation.period_end} onChange={e=>setEvaluation({...evaluation,period_end:e.target.value})}/></label></div><div className="svc-score"><div><span>{t('Weighted score','النتيجة الموزونة')}</span><strong>{number(weightedScore)}%</strong><small>{t(rating(weightedScore),ratingArabic(rating(weightedScore)))}</small></div><Progress value={weightedScore}/></div><Table><TableHeader><TableRow><TableHead>{t('Criterion','المعيار')}</TableHead><TableHead>{t('Weight','الوزن')} %</TableHead><TableHead>{t('Target','المستهدف')}</TableHead><TableHead>{t('Actual','الفعلي')}</TableHead><TableHead>{t('Score','النتيجة')} %</TableHead></TableRow></TableHeader><TableBody>{criteria.map((c,i)=><TableRow key={c.criterion}><TableCell><strong>{t(c.criterion,criterionArabic(c.criterion))}</strong></TableCell><TableCell><input type="number" min="0" max="100" value={c.weight} onChange={e=>setCriteria(criteria.map((x,j)=>j===i?{...x,weight:Number(e.target.value)}:x))}/></TableCell><TableCell><input value={c.target_value} onChange={e=>setCriteria(criteria.map((x,j)=>j===i?{...x,target_value:e.target.value}:x))}/></TableCell><TableCell><input value={c.actual_value} onChange={e=>setCriteria(criteria.map((x,j)=>j===i?{...x,actual_value:e.target.value}:x))}/></TableCell><TableCell><input type="number" min="0" max="100" value={c.score} onChange={e=>setCriteria(criteria.map((x,j)=>j===i?{...x,score:Number(e.target.value)}:x))}/></TableCell></TableRow>)}</TableBody></Table><div className="svc-form-grid"><label>{t('Evaluation notes','ملاحظات التقييم')}<textarea value={evaluation.notes} onChange={e=>setEvaluation({...evaluation,notes:e.target.value})}/></label><label>{t('Improvement plan','خطة التحسين')}<textarea value={evaluation.improvement_plan} onChange={e=>setEvaluation({...evaluation,improvement_plan:e.target.value})}/></label></div><DialogFooter><Button variant="outline" onClick={()=>setEvaluationOpen(false)}>{t('Cancel','إلغاء')}</Button><Button disabled={saving||!evaluation.contract_id} onClick={saveEvaluation}>{t('Save evaluation','حفظ التقييم')}</Button></DialogFooter></DialogContent>}

  function scheduleDialog(){return <DialogContent className="svc-dialog"><DialogHeader><DialogTitle>{t('Schedule an automatic report','جدولة تقرير تلقائي')}</DialogTitle><DialogDescription>{t('Save the report filters and distribution list for automatic daily, weekly or monthly delivery.','احفظ عوامل تصفية التقرير وقائمة التوزيع للإرسال اليومي أو الأسبوعي أو الشهري تلقائياً.')}</DialogDescription></DialogHeader><div className="svc-form-stack"><label>{t('Schedule name','اسم الجدول')}<input value={schedule.name} onChange={e=>setSchedule({...schedule,name:e.target.value})}/></label><label>{t('Service','الخدمة')}<select value={schedule.service_id} onChange={e=>setSchedule({...schedule,service_id:e.target.value})}><option value="">{t('All services','جميع الخدمات')}</option>{services.map(s=><option key={s.id} value={s.id}>{lang==='ar'?s.name_ar:s.name_en}</option>)}</select></label><label>{t('Contract','العقد')}<select value={schedule.contract_id} onChange={e=>setSchedule({...schedule,contract_id:e.target.value})}><option value="">{t('All contracts','جميع العقود')}</option>{contracts.map(c=><option key={c.id} value={c.id}>{c.contract_no} — {c.title}</option>)}</select></label><div className="svc-form-grid"><label>{t('Frequency','التكرار')}<select value={schedule.frequency} onChange={e=>setSchedule({...schedule,frequency:e.target.value})}><option value="daily">{t('Daily','يومي')}</option><option value="weekly">{t('Weekly','أسبوعي')}</option><option value="monthly">{t('Monthly','شهري')}</option></select></label><label>{t('Format','التنسيق')}<select value={schedule.output_format} onChange={e=>setSchedule({...schedule,output_format:e.target.value})}><option value="pdf">PDF</option><option value="xlsx">Excel</option><option value="csv">CSV</option></select></label></div><label>{t('Recipient emails','البريد الإلكتروني للمستلمين')}<textarea placeholder="hss@company.com; manager@company.com" value={schedule.recipients} onChange={e=>setSchedule({...schedule,recipients:e.target.value})}/></label><label>{t('Send time','وقت الإرسال')}<input type="time" value={schedule.send_time} onChange={e=>setSchedule({...schedule,send_time:e.target.value})}/></label></div><DialogFooter><Button variant="outline" onClick={()=>setScheduleOpen(false)}>{t('Cancel','إلغاء')}</Button><Button disabled={saving||!schedule.recipients.trim()} onClick={saveSchedule}>{t('Activate schedule','تفعيل الجدول')}</Button></DialogFooter></DialogContent>}
}

function Info({label,value}:{label:string,value:any}){return <div><small>{label}</small><span>{value}</span></div>}
function ratingArabic(v:string){return ({Excellent:'ممتاز',Good:'جيد',Satisfactory:'مرضي','Needs Improvement':'يحتاج إلى تحسين',Unsatisfactory:'غير مرضي',Draft:'مسودة'} as Record<string,string>)[v]||v}
function criterionArabic(v:string){return ({'Planned vs actual completion':'الإنجاز المخطط مقابل الفعلي','SLA compliance':'الالتزام باتفاقية مستوى الخدمة','Service quality':'جودة الخدمة','Response and resolution time':'وقت الاستجابة والمعالجة','HSS compliance':'الالتزام بالصحة والسلامة والأمن','Reporting and documentation':'التقارير والتوثيق'} as Record<string,string>)[v]||v}
