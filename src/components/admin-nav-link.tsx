"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function AdminNavLink({ onClick }: { onClick?: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let active = true;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;

    const supabase = createBrowserClient(url, key);
    async function checkAdminRole(userId: string) {
      const { data } = await supabase.from("staff_profiles").select("role,active").eq("user_id", userId).maybeSingle();
      if (active) setVisible(data?.active === true && data.role === "admin");
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) { setVisible(false); return; }
      void checkAdminRole(session.user.id);
    });
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!active) return;
      if (user) void checkAdminRole(user.id);
      else setVisible(false);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  if (!visible) return null;
  return <a className="admin-nav-link" href="/admin" onClick={onClick}>Painel administrativo <span aria-hidden="true">↗</span></a>;
}
