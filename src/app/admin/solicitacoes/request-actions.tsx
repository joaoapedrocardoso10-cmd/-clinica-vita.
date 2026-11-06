"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RequestActions({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function decide(decision: "approved" | "declined") {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/solicitacoes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, decision }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível atualizar.");
      router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível atualizar."); }
    finally { setBusy(false); }
  }
  return <div className="admin-record-actions"><button disabled={busy} onClick={() => decide("approved")}>{busy ? "Salvando…" : "Aprovar"}</button><button className="danger" disabled={busy} onClick={() => decide("declined")}>Recusar</button>{error && <small role="alert">{error}</small>}</div>;
}
