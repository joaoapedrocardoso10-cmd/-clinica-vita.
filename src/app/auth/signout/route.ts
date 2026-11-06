import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();
  const requested = new URL(request.url).searchParams.get("next");
  const destination = requested === "/paciente/login" ? requested : "/admin/login";
  return NextResponse.redirect(new URL(destination, request.url), { status: 303 });
}
