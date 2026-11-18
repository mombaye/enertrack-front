// src/features/fuel-tracking/sheets/ConsoPeriodPicker.tsx
// Sélecteur UNIQUE de période de « Suivis Consommations », placé dans l'en-tête de la page :
// une liste des périodes qui ont un bilan (mois) + « Période personnalisée » (deux dates).
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar } from "lucide-react";
import { getConsommationsPeriodes } from "@/services/fuelTracking";
import { FT } from "../theme";

export type ConsoPeriod = { debut: string; fin: string };

const MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const fr = (v: string) => v.split("-").reverse().join("/");
export function periodLabel(a: string, b: string) {
  const da = new Date(`${a}T00:00:00`), db = new Date(`${b}T00:00:00`);
  const last = new Date(db.getFullYear(), db.getMonth() + 1, 0).getDate();
  return da.getDate() === 1 && db.getDate() === last && da.getMonth() === db.getMonth() && da.getFullYear() === db.getFullYear()
    ? `${MOIS[da.getMonth()]} ${da.getFullYear()}` : `${fr(a)} → ${fr(b)}`;
}

export function ConsoPeriodPicker({ value, onChange }: { value: ConsoPeriod; onChange: (p: ConsoPeriod) => void }) {
  const periods = useQuery({ queryKey: ["conso-periods"], queryFn: getConsommationsPeriodes, staleTime: 60_000 });
  const list = periods.data?.periodes ?? [];
  const cur = value.debut && value.fin ? value : periods.data?.defaut ?? null;
  const known = cur ? list.some((p) => p.debut === cur.debut && p.fin === cur.fin) : false;
  const [custom, setCustom] = useState(false);
  const showDates = custom || (!!cur && !known && !!value.debut);
  const box = { display: "flex", alignItems: "center", gap: 7, border: `1px solid ${FT.border}`, background: FT.slateL, borderRadius: 9, padding: "5px 10px" } as const;
  const input = { border: "none", outline: "none", background: "transparent", fontSize: 12.5, color: FT.text, fontWeight: 700 } as const;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <label style={box} title="Période affichée (bilans de stock enregistrés)">
        <Calendar size={14} color={FT.textSub} aria-hidden />
        <select aria-label="Période" value={showDates ? "custom" : cur ? `${cur.debut}|${cur.fin}` : ""} style={{ ...input, cursor: "pointer" }}
          onChange={(e) => {
            if (e.target.value === "custom") { setCustom(true); return; }
            setCustom(false);
            const [debut, fin] = e.target.value.split("|");
            onChange({ debut, fin });
          }}>
          {!cur && <option value="">Choisir une période…</option>}
          {list.map((p) => <option key={`${p.debut}|${p.fin}`} value={`${p.debut}|${p.fin}`}>{periodLabel(p.debut, p.fin)}</option>)}
          <option value="custom">Période personnalisée…</option>
        </select>
      </label>
      {showDates && (
        <div style={box}>
          <input aria-label="Date début" type="date" value={value.debut || cur?.debut || ""} max={value.fin || undefined} style={input}
            onChange={(e) => e.target.value && onChange({ debut: e.target.value, fin: value.fin || cur?.fin || e.target.value })} />
          <span style={{ color: FT.textSub, fontSize: 12 }}>→</span>
          <input aria-label="Date fin" type="date" value={value.fin || cur?.fin || ""} min={value.debut || undefined} style={input}
            onChange={(e) => e.target.value && onChange({ debut: value.debut || cur?.debut || e.target.value, fin: e.target.value })} />
        </div>
      )}
    </div>
  );
}
