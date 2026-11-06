import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const inputSchema=z.object({id:z.string().uuid(),status:z.enum(["confirmed","cancelled","completed","no_show"])});
export async function PATCH(request:Request){
  const supabase=await createSupabaseServerClient();
  if(!supabase)return NextResponse.json({error:"Supabase não está configurado."},{status:503});
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Entre no painel para continuar."},{status:401});
  const {data:staff}=await supabase.from("staff_profiles").select("role,professional_id,active").eq("user_id",user.id).maybeSingle();
  if(!staff?.active)return NextResponse.json({error:"Acesso não autorizado."},{status:403});
  let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:"Pedido inválido."},{status:400})}
  const parsed=inputSchema.safeParse(body);if(!parsed.success)return NextResponse.json({error:"Status ou agendamento inválido."},{status:400});
  let query=supabase.from("appointments").update({status:parsed.data.status,updated_at:new Date().toISOString()}).eq("id",parsed.data.id);
  if(staff.role==="professional"&&staff.professional_id)query=query.eq("professional_id",staff.professional_id);
  const {data,error}=await query.select("id").maybeSingle();
  if(error||!data)return NextResponse.json({error:"Não foi possível atualizar. Confira suas permissões e tente novamente."},{status:400});
  await supabase.from("admin_audit_log").insert({actor_id:user.id,action:`appointment_${parsed.data.status}`,entity_type:"appointment",entity_id:data.id});
  return NextResponse.json({ok:true});
}
