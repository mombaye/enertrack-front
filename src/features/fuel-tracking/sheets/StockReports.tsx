// src/features/fuel-tracking/sheets/StockReports.tsx
// Rapports téléchargeables (CSV) depuis eGrid : lignes rejetées, tableau de validation, livraisons Closing absentes d'ENOC, Ponctions sans site source,
// conflits ENOC/Closing, cuves prioritaires, lignes Closing à formule incohérente. Lecture seule — rien n'est modifié.

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { downloadStockReport, getBalancePeriods, getStockReports } from "@/services/fuelTracking";
import { Card, SheetTitle, Skeleton } from "../ui";
import { FT } from "../theme";
import { actionBtn, Field, fmtDateTime, inputStyle } from "./stockRegistryUi";

export function StockReportsCard({ only }: { only?: string[] }) {
  const reports = useQuery({ queryKey: ["stock-reports"], queryFn: getStockReports });
  const periods = useQuery({ queryKey: ["stock-balance-periods"], queryFn: getBalancePeriods });
  const [period, setPeriod] = useState("");
  const [lot, setLot] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const current = period || (periods.data?.[0] ? `${periods.data[0].observation_start}|${periods.data[0].observation_end}` : "");
  const [a, b] = current ? current.split("|") : ["", ""];

  const run = async (kind: string, label: string) => {
    setBusy(kind);
    setMsg(null);
    try {
      const r = await downloadStockReport(kind, { debut: a ? a.slice(0, 10) : undefined, fin: b ? b.slice(0, 10) : undefined, lot: lot || undefined });
      setMsg({ ok: true, text: `« ${label} » téléchargé : ${r.name}${Number.isFinite(r.rows) ? ` (${r.rows} ligne(s))` : ""}.` });
    } catch (e: unknown) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const list = (reports.data ?? []).filter((r) => !only || only.includes(r.kind));
  return (
    <Card padded={false} style={{ padding: 18 }}>
      <SheetTitle icon={<Download size={17} />} title="Rapports à télécharger"
        subtitle="Fichiers CSV (ouverture directe dans Excel) à transmettre aux équipes. Lecture seule : rien n'est modifié ni certifié." />
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", margin: "12px 0" }}>
        <Field label="Période du bilan (rapports qui en demandent une)">
          <select aria-label="Période du bilan" value={current} onChange={(e) => setPeriod(e.target.value)} style={inputStyle} disabled={!periods.data?.length}>
            {!periods.data?.length && <option value="">Aucun bilan calculé</option>}
            {(periods.data ?? []).map((x) => (
              <option key={`${x.observation_start}|${x.observation_end}`} value={`${x.observation_start}|${x.observation_end}`}>
                {fmtDateTime(x.observation_start)} → {fmtDateTime(x.observation_end)} ({x.sites} sites)
              </option>
            ))}
          </select>
        </Field>
        <Field label="N° de lot (facultatif)">
          <input value={lot} onChange={(e) => setLot(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="tous" aria-label="Numéro de lot" style={{ ...inputStyle, width: 90 }} />
        </Field>
      </div>
      {reports.isLoading && <Skeleton h={120} />}
      {reports.isError && <div role="alert" style={{ color: FT.red, fontSize: 13 }}>Liste des rapports indisponible (serveur API à mettre à jour).</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 10 }}>
        {list.map((r) => (
          <div key={r.kind} style={{ border: `1px solid ${FT.border}`, borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontWeight: 800, fontSize: 13 }}>{r.label}</div>
            <div style={{ fontSize: 12, color: FT.textSub, flex: 1 }}>{r.description}</div>
            <div style={{ fontSize: 11, color: FT.textSub }}>{r.periode ? "Utilise la période choisie." : r.lot ? "Filtrable par lot." : "Toutes les données."}</div>
            <button type="button" onClick={() => run(r.kind, r.label)} disabled={busy !== null || (r.periode && !current)} style={actionBtn("blue", busy !== null || (r.periode && !current))}
                    aria-label={`Télécharger : ${r.label}`}>
              <Download size={12} style={{ verticalAlign: -2, marginRight: 4 }} />{busy === r.kind ? "Préparation…" : "Télécharger (CSV)"}
            </button>
          </div>
        ))}
      </div>
      {msg && <div role={msg.ok ? "status" : "alert"} style={{ marginTop: 10, fontSize: 12.5, fontWeight: 700, color: msg.ok ? FT.green : FT.red }}>{msg.text}</div>}
    </Card>
  );
}
