import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const querySchema = z.object({ serviceId: z.string().uuid(), professionalId: z.string().uuid(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });
type AvailableSlot = { starts_at: string; ends_at: string };

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "O agendamento online ainda está sendo configurado." }, { status: 503 });
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ serviceId: url.searchParams.get("serviceId"), professionalId: url.searchParams.get("professionalId"), date: url.searchParams.get("date") });
  if (!parsed.success) return NextResponse.json({ error: "Selecione um serviço, profissional e data válidos." }, { status: 400 });
  const { serviceId, professionalId, date } = parsed.data;
  const { data, error } = await supabase.rpc("slot_options", { p_service_id: serviceId, p_professional_id: professionalId, p_date: date });
  if (error) {
    // Keep the existing booking flow usable until the additive occupancy migration is applied.
    if (error.code === "42883" || error.message.includes("slot_options")) {
      const fallback = await supabase.rpc("available_slots", { p_service_id: serviceId, p_professional_id: professionalId, p_date: date });
      if (!fallback.error) {
        const availableSlots = (fallback.data ?? []) as AvailableSlot[];
        return NextResponse.json({ slots: availableSlots.map((item) => ({ ...item, status: "available" })), occupancyEnabled: false });
      }
    }
    console.error("Availability query failed:", error.code, error.message);
    return NextResponse.json({ error: "Não foi possível consultar os horários." }, { status: 500 });
  }
  return NextResponse.json({ slots: data ?? [], occupancyEnabled: true });
}
