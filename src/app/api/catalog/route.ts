import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "O agendamento online ainda está sendo configurado." }, { status: 503 });
  const [services, professionalContact] = await Promise.all([
    supabase.from("services").select("id,name,duration_minutes,price_cents,specialty_id").eq("active", true).order("name"),
    supabase.from("professionals").select("id,display_name,specialty_id,bio,whatsapp_phone").eq("active", true).order("display_name"),
  ]);
  const professionals = professionalContact.error
    ? await supabase.from("professionals").select("id,display_name,specialty_id,bio").eq("active", true).order("display_name")
    : professionalContact;
  if (services.error || professionals.error) return NextResponse.json({ error: "Não foi possível carregar os serviços." }, { status: 500 });
  return NextResponse.json({ services: services.data ?? [], professionals: (professionals.data ?? []).map((professional) => ({ ...professional, whatsapp_phone: "whatsapp_phone" in professional ? professional.whatsapp_phone : null })) });
}
