import {NextResponse} from 'next/server';
import {generateText} from 'ai';

const SUPABASE_URL='https://sdbdppcbvlalyjnxeqmy.supabase.co';
const SUPABASE_KEY='sb_publishable_YRnoxe5WTODYiA67nLfpNg_JqYHdaYM';

async function sb(path:string,token:string){
  const r=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${token}`},cache:'no-store'});
  if(!r.ok) throw new Error(`Supabase ${r.status}`);
  return r.json();
}

export async function POST(req:Request){
  try{
    const auth=req.headers.get('authorization')||'';
    const token=auth.replace(/^Bearer\s+/i,'');
    if(!token) return NextResponse.json({error:'Unauthorized'},{status:401});
    const userRes=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${token}`},cache:'no-store'});
    if(!userRes.ok) return NextResponse.json({error:'Invalid session'},{status:401});
    const user=await userRes.json();
    const profiles=await sb(`profiles?id=eq.${user.id}&select=role,department,module_permissions,active`,token);
    const profile=profiles?.[0];
    if(!profile?.active) return NextResponse.json({error:'Account disabled'},{status:403});
    const unrestricted=['admin','management'].includes(profile.role);
    const p=profile.module_permissions||{};
    if(!unrestricted&&!p.ai) return NextResponse.json({error:'AI access not permitted'},{status:403});

    const body=await req.json();const message=String(body?.message||'').trim();
    if(!message) return NextResponse.json({error:'Question required'},{status:400});
    if(message.length>4000) return NextResponse.json({error:'Question is too long'},{status:400});

    const context:any={};const jobs:Promise<void>[]=[];
    const add=(key:string,path:string)=>jobs.push(sb(path,token).then(d=>{context[key]=d}).catch(()=>{context[key]=[]}));
    if(unrestricted||p.health_safety){
      add('incidents','incidents?select=incident_no,incident_date,category,incident_type,department,building,location,severity,status,description,immediate_action,investigation_summary,root_cause&order=incident_date.desc&limit=200');
      add('risks','risks?select=risk_no,module,title,description,building,location,likelihood,impact,risk_score,risk_level,controls,target_date,status&order=created_at.desc&limit=200');
      add('inspections','inspections?select=inspection_no,module,inspection_type,building,location,scheduled_date,completed_date,status,score,summary&order=created_at.desc&limit=200');
      add('correctiveActions','corrective_actions?select=action_no,source_type,module,title,description,priority,due_date,status,overdue&order=created_at.desc&limit=200');
      add('emergencyEvents','emergency_events?select=emergency_no,event_date,emergency_type,building,location,severity,description,crisis_committee_direction,action_taken,evacuation_required,shelter_required,status&order=event_date.desc&limit=150');
    }
    add('workOrders','work_orders?select=id,type,module,system,asset_id,location,description,priority,workflow_status,due_date,due_at,overdue,finding,corrective_action&order=created_at.desc&limit=200');
    add('notifications','notifications?select=type,title,message,severity,read_at,created_at&order=created_at.desc&limit=100');
    add('contracts','contracts?select=contract_no,title,module,start_date,end_date,po_number,sla_summary,status,notes&order=created_at.desc&limit=150');
    add('assets','assets?select=asset_code,asset_name,module,system,building,location,criticality,status&order=created_at.desc&limit=250');
    add('digitalForms','digital_form_records?select=form_no,form_type,module,title,building,location,status,created_at&order=created_at.desc&limit=150');
    if(unrestricted||p.physical_security){
      add('physicalSecurity','physical_security_records?select=source_no,source_year,type,system,sub_system,description,location,area,criticality,start_date,end_date,status,latest_update,remarks&order=start_date.desc&limit=300');
      add('securityPatrols','security_patrols?select=patrol_no,patrol_date,patrol_type,building,area,route,officer_name,status,findings,action_taken,severity&order=patrol_date.desc&limit=200');
    }
    if(unrestricted||p.agriculture){
      add('agriculture','agriculture_checklists?select=area_type,location,landscape_category,activity,plant_units,status,check_date,remarks,contractor&order=check_date.desc&limit=300');
      add('agricultureFollowup','agriculture_followups?select=followup_no,area_type,location,landscape_category,finding,condition,required_action,target_date,status&order=created_at.desc&limit=200');
    }
    if(unrestricted||p.physical_security||p.facilities||p.agriculture) add('ppm','ppm_schedules?select=module,system,sub_system,asset_id,location,description,frequency,next_due_date,priority,sla_hours,active&order=next_due_date.asc&limit=200');
    await Promise.all(jobs);

    const system=`You are Ask HSS AI inside an enterprise portal for Health, Safety, Security, Facilities, Fire & Life Safety, Agriculture & Landscaping, contracts, emergency management, patrols, digital forms and operational management. Answer in the same language as the user. If the user writes Arabic, answer fully in professional Arabic and use Arabic-Indic numerals where natural. Use only the authorized live portal context supplied to you. Never invent incidents, counts, dates, contract details, risks, patrols, emergencies, work orders or compliance results. If data is insufficient, say so clearly. Summarize and analyze when useful, highlight overdue, critical and expiring items, and respect the user's role and department. User role: ${profile.role}; department: ${profile.department}.`;
    const prompt=`USER QUESTION:\n${message}\n\nAUTHORIZED LIVE PORTAL DATA:\n${JSON.stringify(context)}`;
    const {text}=await generateText({model:'openai/gpt-5.6-sol',system,prompt});
    return NextResponse.json({answer:text,model:'openai/gpt-5.6-sol',source:'Vercel AI Gateway'});
  }catch(e:any){return NextResponse.json({error:e?.message||'AI request failed'},{status:500})}
}
