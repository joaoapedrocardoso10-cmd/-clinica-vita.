import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const idSchema = z.string().uuid();
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("appointment");
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: "Código de consulta inválido." }, { status: 400 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Não foi possível consultar o pagamento." }, { status: 503 });
  const { data, error } = await supabase.rpc("checkout_public_status", { p_appointment_id: id });
  if (error || !data) return NextResponse.json({ error: "Não encontramos esta consulta." }, { status: 404 });
  return NextResponse.json({ appointment: data });
}
