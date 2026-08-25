import {NextResponse} from 'next/server';

const SUPABASE_URL='https://sdbdppcbvlalyjnxeqmy.supabase.co';
const SUPABASE_KEY='sb_publishable_YRnoxe5WTODYiA67nLfpNg_JqYHdaYM';

async function sb(path:string,token:string){
  const r=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${token}`}});
  if(!r.ok) throw new Error(`Supabase ${r.status}`);
  return r.json();
}

export async function POST(req:Request){
  try{
    const auth=req.headers.get('authorization')||'';
    const token=auth.replace(/^Bearer\s+/i,'');
    if(!token) return NextResponse.json({error:'Unauthorized'},{status:401});

    const userRes=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${token}`}});
    if(!userRes.ok) return NextResponse.json({error:'Invalid session'},{status:401});
    const user=await userRes.json();

    const profiles=await sb(`profiles?id=eq.${user.id}&select=role,department,module_permissions,active`,token);
    const profile=profiles?.[0];
    if(!profile?.active) return NextResponse.json({error:'Account disabled'},{status:403});
    const unrestricted=['admin','management'].includes(profile.role);
    const p=profile.module_permissions||{};
    if(!unrestricted&&!p.ai) return NextResponse.json({error:'AI access not permitted'},{status:403});

    const {message}=await req.json();
    if(!String(message||'').trim()) return NextResponse.json({error:'Question required'},{status:400});

    const context:any={};
    const jobs:Promise<void>[]=[];
    const add=(key:string,path:string)=>jobs.push(sb(path,token).then(d=>{context[key]=d}).catch(()=>{context[key]=[]}));

    add('incidents','incidents?select=incident_no,incident_date,category,incident_type,department,building,location,severity,status,description,immediate_action,root_cause&order=incident_date.desc&limit=200');
    add('workOrders','work_orders?select=id,type,module,system,asset_id,location,description,priority,workflow_status,due_date,due_at,overdue,finding,corrective_action&order=created_at.desc&limit=200');
    add('notifications','notifications?select=type,title,message,severity,read_at,created_at&order=created_at.desc&limit=100');
    if(unrestricted||p.physical_security) add('physicalSecurity','physical_security_records?select=source_no,source_year,type,system,sub_system,description,location,area,criticality,start_date,end_date,status,latest_update,remarks&order=start_date.desc&limit=400');
    if(unrestricted||p.agriculture) add('agriculture','agriculture_checklists?select=area_type,location,landscape_category,activity,plant_units,status,check_date,remarks,contractor&order=check_date.desc&limit=400');
    if(unrestricted||p.physical_security) add('ppm','ppm_schedules?select=module,system,sub_system,asset_id,location,description,frequency,next_due_date,priority,sla_hours,active&order=next_due_date.asc&limit=200');
    await Promise.all(jobs);

    const key=process.env.OPENAI_API_KEY;
    if(!key) return NextResponse.json({error:'OPENAI_API_KEY is not configured in Vercel',code:'OPENAI_NOT_CONFIGURED'},{status:503});

    const model=process.env.OPENAI_MODEL||'gpt-5-mini';
    const ai=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',
      headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},
      body:JSON.stringify({
        model,
        input:[
          {role:'system',content:`You are Ask HSS AI for an enterprise Health, Safety, Security, Facilities and Landscaping portal. Answer in the same language as the user. Use only the authorized portal context provided. Never invent records or counts. Clearly say when data is insufficient. User role: ${profile.role}; department: ${profile.department}.`},
          {role:'user',content:`QUESTION:\n${message}\n\nAUTHORIZED PORTAL CONTEXT:\n${JSON.stringify(context)}`}
        ]
      })
    });
    const data=await ai.json();
    if(!ai.ok) return NextResponse.json({error:data?.error?.message||'OpenAI request failed'},{status:502});
    const answer=data.output_text||data.output?.flatMap((x:any)=>x.content||[]).map((x:any)=>x.text||'').join('\n')||'No answer returned.';
    return NextResponse.json({answer,model});
  }catch(e:any){
    return NextResponse.json({error:e?.message||'AI request failed'},{status:500});
  }
}
