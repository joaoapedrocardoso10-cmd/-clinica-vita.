import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const nextPath = url.searchParams.get("next") ?? "/paciente";
  const destination = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/paciente";
  const code = url.searchParams.get("code");
  const supabase = await createSupabaseServerClient();
  if (!supabase || !code) return NextResponse.redirect(new URL("/paciente/login?erro=link", url.origin));
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/paciente/login?erro=link", url.origin));
  if (destination !== "/paciente/redefinir-senha") {
    const { data: linked, error: profileError } = await supabase.rpc("ensure_my_patient_profile");
    if (profileError || linked !== true) return NextResponse.redirect(new URL("/paciente/login?erro=perfil", url.origin));
  }
  return NextResponse.redirect(new URL(destination, url.origin));
}
