// src/features/fuel-tracking/sheets/StockPeriodBalance.tsx
// Bilan de stock par site et période EXACTE (jamais limité au mois civil) : stock initial, mouvements, stock final,
// consommation réelle, statut de pré-certification. Certification = action explicite du Fuel Manager (historique
// non modifiable). Une valeur absente reste « — » (jamais 0). + Rapprochement réel / instrumentée / théorique.

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Calculator, ExternalLink, Scale, Search, SlidersHorizontal } from "lucide-react";
import {
  certifyPeriodBalance,
  computePeriodBalances,
  getBalancePeriods,
  getBalanceReconciliation,
  getPeriodBalance,
  getPeriodBalances,
  type BalanceMovement,
  type PeriodBalanceParams,
  type PeriodBalanceRow,
  type StockBalanceCertLevel,
  type StockBalanceStatus,
  type StockCandidate,
} from "@/services/fuelTracking";
import { Card, EmptyState, Modal, Pager, SheetTitle, Skeleton } from "../ui";
import { FT } from "../theme";
import { actionBtn, Dash, Field, fmtDateTime, inputStyle, Num, SOURCE_LABEL, tdStyle, thStyle } from "./stockRegistryUi";

export const BALANCE_STATUS: Record<StockBalanceStatus, { label: string; bg: string; fg: string }> = {
  PRET_A_CERTIFIER: { label: "Prêt à certifier", bg: FT.greenL, fg: FT.green },
  PRET_A_CERTIFIER_AVEC_RESERVE: { label: "Prêt avec réserve", bg: FT.orangeL, fg: FT.orange },
  DONNEES_STOCK_INCOMPLETES: { label: "Stock incomplet", bg: FT.slateL, fg: FT.textMid },
  MOUVEMENTS_A_CONTROLER: { label: "Mouvements à contrôler", bg: FT.redL, fg: FT.red },
  HISTORIQUE_NON_VERIFIABLE: { label: "Historique non vérifiable", bg: FT.slateL, fg: FT.textSub },
};
export const CERT_LEVEL: Record<StockBalanceCertLevel, { label: string; color: string }> = {
  NON_CERTIFIE: { label: "Non certifié", color: FT.textSub },
  CERTIFIE: { label: "Certifié", color: FT.green },
  CERTIFIE_AVEC_RESERVE: { label: "Certifié avec réserve", color: FT.orange },
  A_RECERTIFIER: { label: "À recertifier", color: FT.red },
};
const COMPONENT_LABEL: Record<string, string> = {
  truck_l: "Truck", carte_total_l: "Carte Total", transferts_entrants_l: "Transfert entrant", transferts_sortants_l: "Transfert sortant",
  vols_l: "Vol", vidanges_l: "Vidange", retraits_l: "Retrait", rajouts_l: "Rajout", livraisons_externes_l: "Livraison externe",
};

const pad = (n: number) => String(n).padStart(2, "0");
const localInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fromIso = (v: string | null | undefined) => (v ? v.slice(0, 16) : "");

function defaultPeriod() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59);
  return { debut: localInput(start), fin: localInput(end) };
}

function StatusBadge({ s }: { s: StockBalanceStatus }) {
  const t = BALANCE_STATUS[s] ?? { label: s, bg: FT.slateL, fg: FT.textMid };
  return <span style={{ display: "inline-block", padding: "3px 9px", borderRadius: 999, fontSize: 10.5, fontWeight: 800, background: t.bg, color: t.fg, whiteSpace: "nowrap" }}>{t.label}</span>;
}

function Cert({ c }: { c: StockBalanceCertLevel }) {
  const t = CERT_LEVEL[c] ?? { label: c, color: FT.textMid };
  return <span style={{ fontWeight: 800, fontSize: 11, color: t.color }}>{t.label}</span>;
}

function StockCell({ v, source, date }: { v: number | null; source: string | null; date: string | null }) {
  if (v === null) return <Dash reason="Aucun relevé validé et converti en litres autour de la borne" />;
  return (
    <div>
      <Num value={v} unit="L" />
      <div style={{ fontSize: 10.5, color: FT.textSub }}>{SOURCE_LABEL[source ?? ""] ?? source} · {fmtDateTime(date, true)}</div>
    </div>
  );
}

const cell: CSSProperties = { ...tdStyle, textAlign: "left", whiteSpace: "normal", verticalAlign: "top", padding: "9px 10px" };

export function StockPeriodBalance() {
  const qc = useQueryClient();
  const def = defaultPeriod();
  const [debut, setDebut] = useState(def.debut);
  const [fin, setFin] = useState(def.fin);
  const [p, setP] = useState<PeriodBalanceParams>({ page: 1, limit: 50 });
  const [search, setSearch] = useState("");
  const [more, setMore] = useState(false);
  const [detail, setDetail] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const periods = useQuery({ queryKey: ["stock-balance-periods"], queryFn: getBalancePeriods });
  useEffect(() => {
    const t = setTimeout(() => setP((x) => ({ ...x, site: search || undefined, page: 1 })), 300);
    return () => clearTimeout(t);
  }, [search]);
  const q = useQuery({ queryKey: ["stock-balances", p], queryFn: () => getPeriodBalances(p), placeholderData: (x) => x });
  const d = q.data;
  useEffect(() => {  // aligne les champs sur la période affichée (dernière calculée par défaut)
    if (d?.periode.debut && !p.debut) {
      setDebut(fromIso(d.periode.debut));
      setFin(fromIso(d.periode.fin));
    }
  }, [d?.periode.debut, d?.periode.fin, p.debut]);
  const set = (patch: Partial<PeriodBalanceParams>) => setP((x) => ({ ...x, ...patch, page: 1 }));
  const sel = (label: string, value: string | undefined, options: Array<[string, string]>, onChange: (v: string) => void) => (
    <select aria-label={label} value={value ?? ""} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
      <option value="">{label} : tous</option>
      {options.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
    </select>
  );

  const compute = async () => {
    if (!debut || !fin) return setMsg("Choisir le début et la fin de la période.");
    setBusy(true);
    setMsg(null);
    try {
      const r = await computePeriodBalances(debut, fin);
      setMsg(`${r.sites} site(s) calculé(s) : ${r.calculables} avec consommation réelle, ${r.incomplets} incomplet(s).`);
      set({ debut, fin });
      await Promise.all([qc.invalidateQueries({ queryKey: ["stock-balances"] }), qc.invalidateQueries({ queryKey: ["stock-balance-periods"] })]);
    } catch (e: unknown) {
      setMsg((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Calcul impossible.");
    } finally {
      setBusy(false);
    }
  };

  const totals = d?.totaux;
  return (
    <Card padded={false} style={{ padding: 18 }}>
      <SheetTitle icon={<Scale size={17} />} title="Bilan de stock par site"
        subtitle="Période exacte (pas forcément un mois civil). Consommation réelle = stock initial + entrées − sorties − stock final ; NULL si un stock manque. La certification est une action du Fuel Manager." />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", margin: "12px 0" }}>
        <Field label="Début (inclus)"><input type="datetime-local" value={debut} onChange={(e) => setDebut(e.target.value)} style={inputStyle} /></Field>
        <Field label="Fin (incluse)"><input type="datetime-local" value={fin} onChange={(e) => setFin(e.target.value)} style={inputStyle} /></Field>
        <button type="button" onClick={() => set({ debut, fin })} style={actionBtn("blue")}>Afficher</button>
        {d?.can_validate && (
          <button type="button" disabled={busy} onClick={compute} style={actionBtn("green", busy)}>
            <Calculator size={12} style={{ verticalAlign: -2, marginRight: 4 }} />{busy ? "Calcul en cours…" : "Calculer / recalculer le bilan"}
          </button>
        )}
        {(periods.data ?? []).length > 0 && (
          <select aria-label="Périodes déjà calculées" value="" style={inputStyle}
                  onChange={(e) => { const [a, b] = e.target.value.split("|"); setDebut(fromIso(a)); setFin(fromIso(b)); set({ debut: fromIso(a), fin: fromIso(b) }); }}>
            <option value="">Périodes calculées…</option>
            {(periods.data ?? []).map((x) => (
              <option key={`${x.observation_start}|${x.observation_end}`} value={`${x.observation_start}|${x.observation_end}`}>
                {fmtDateTime(x.observation_start, true)} → {fmtDateTime(x.observation_end, true)} ({x.calculables}/{x.sites} calculables)
              </option>
            ))}
          </select>
        )}
      </div>
      {msg && <div role="status" style={{ fontSize: 12.5, fontWeight: 700, color: FT.navy, marginBottom: 8 }}>{msg}</div>}

      {d && d.periode.debut && totals && (
        <>
          <div style={{ fontSize: 12, color: FT.textSub, marginBottom: 6 }}>
            Période affichée : <b style={{ color: FT.text }}>{fmtDateTime(d.periode.debut, true)} → {fmtDateTime(d.periode.fin, true)}</b> ·
            {" "}{totals.calculables} site(s) avec consommation réelle · {totals.incomplets} sans
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, marginBottom: 10 }}>
            {(Object.keys(BALANCE_STATUS) as StockBalanceStatus[]).map((k) => {
              const active = p.statut === k;
              return (
                <button key={k} type="button" aria-pressed={active} onClick={() => set({ statut: active ? undefined : k })}
                        style={{ textAlign: "left", border: `1px solid ${active ? BALANCE_STATUS[k].fg : FT.border}`, borderRadius: 10, padding: "8px 12px",
                                 background: active ? BALANCE_STATUS[k].bg : FT.slateL, cursor: "pointer" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: BALANCE_STATUS[k].fg, fontFamily: "ui-monospace, Menlo, monospace" }}>
                    {(totals.par_statut[k] ?? 0).toLocaleString("fr-FR")}
                  </div>
                  <div style={{ fontSize: 11.5, fontWeight: 800, color: FT.text }}>{BALANCE_STATUS[k].label}</div>
                </button>
              );
            })}
          </div>
          {Object.keys(totals.sources_stock).length > 0 && (
            <div style={{ fontSize: 11.5, color: FT.textSub, marginBottom: 8 }}>
              Sources de stock utilisées : {Object.entries(totals.sources_stock).map(([s, n]) => `${SOURCE_LABEL[s] ?? s} (initial ${n.initial}, final ${n.final})`).join(" · ")}
            </div>
          )}
        </>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, border: `1px solid ${FT.border}`, background: FT.slateL, borderRadius: 9, padding: "0 10px", height: 32, minWidth: 200 }}>
          <Search size={14} color={FT.textSub} aria-hidden />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Site ou nom…" aria-label="Rechercher un site"
                 style={{ border: "none", outline: "none", background: "transparent", fontSize: 12.5, flex: 1 }} />
        </div>
        {sel("Pays", p.pays, (d?.facettes.pays ?? []).map((x) => [x, x] as [string, string]), (v) => set({ pays: v || undefined }))}
        {sel("Zone", p.zone, (d?.facettes.zones ?? []).map((x) => [x, x] as [string, string]), (v) => set({ zone: v || undefined }))}
        {sel("Certification", p.certification, (d?.facettes.certifications ?? []).map((x) => [x.key, CERT_LEVEL[x.key]?.label ?? x.label] as [string, string]),
          (v) => set({ certification: v || undefined }))}
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: FT.text }}>
          <input type="checkbox" checked={!!p.a_controler} onChange={(e) => set({ a_controler: e.target.checked })} /> Mouvements à contrôler
        </label>
        <button type="button" aria-expanded={more} onClick={() => setMore(!more)} style={actionBtn("blue")}>
          <SlidersHorizontal size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Plus de filtres
        </button>
      </div>
      {more && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {sel("Typologie", p.typologie, (d?.facettes.typologies ?? []).map((x) => [x, x] as [string, string]), (v) => set({ typologie: v || undefined }))}
          {sel("Stock initial", p.stock_initial, [["present", "Présent"], ["absent", "Absent"]], (v) => set({ stock_initial: (v || "") as "" | "present" | "absent" }))}
          {sel("Stock final", p.stock_final, [["present", "Présent"], ["absent", "Absent"]], (v) => set({ stock_final: (v || "") as "" | "present" | "absent" }))}
          {sel("Source de stock", p.source, (d?.facettes.sources ?? []).map((x) => [x, SOURCE_LABEL[x] ?? x] as [string, string]), (v) => set({ source: v || undefined }))}
        </div>
      )}

      {q.isLoading && <Skeleton h={300} />}
      {q.isError && <div role="alert" style={{ color: FT.red, fontSize: 13 }}>Bilans indisponibles (serveur API à mettre à jour ou erreur de chargement).</div>}
      {d && !d.periode.debut && (
        <EmptyState icon={<Scale size={20} />} title="Aucun bilan calculé" subtitle="Choisir la période exacte puis « Calculer / recalculer le bilan »." />
      )}
      {d && d.periode.debut && d.data.length === 0 && <EmptyState icon={<Scale size={20} />} title="Aucun bilan pour ces filtres" />}
      {d && d.data.length > 0 && (
        <>
          <div style={{ overflow: "auto", maxHeight: 600, borderRadius: 12, border: `1px solid ${FT.border}`, opacity: q.isFetching ? 0.7 : 1 }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 1900 }}>
              <thead>
                <tr>
                  {["Site", "Typologie", "Stock initial", "Truck / Eydon", "Carte Total", "Transferts entrants", "Transferts sortants", "Autres mouvements",
                    "Stock final", "Consommation réelle", "Statut bilan", "Certification", "Motifs et alertes", "Mis à jour"].map((h) => (
                    <th key={h} scope="col" style={{ ...thStyle, textAlign: "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.data.map((r, i) => <BalanceRow key={r.id} r={r} i={i} onOpen={() => setDetail(r.id)} />)}
              </tbody>
            </table>
          </div>
          <Pager page={d.pagination.page} totalPages={d.pagination.totalPages} hasPrev={d.pagination.hasPrev} hasNext={d.pagination.hasNext}
                 onPrev={() => setP((x) => ({ ...x, page: Math.max(1, (x.page ?? 1) - 1) }))} onNext={() => setP((x) => ({ ...x, page: (x.page ?? 1) + 1 }))} />
          <div style={{ fontSize: 11.5, color: FT.textSub, marginTop: 6 }}>{d.formule}</div>
        </>
      )}
      {detail !== null && <BalanceDetailModal id={detail} onClose={() => setDetail(null)} />}
    </Card>
  );
}

function others(r: PeriodBalanceRow) {
  const parts: Array<[string, number | null, number]> = [["Rajouts", r.rajouts_l, 1], ["Retraits", r.retraits_l, -1], ["Vols", r.vols_l, -1], ["Vidanges", r.vidanges_l, -1]];
  const nz = parts.filter(([, v]) => v);
  if (!nz.length) return <span style={{ color: FT.textSub }}>0 L</span>;
  return <Wrap>{nz.map(([l, v, s]) => `${l} ${s < 0 ? "−" : "+"}${(v ?? 0).toLocaleString("fr-FR")} L`).join(" · ")}</Wrap>;
}

function Wrap({ children }: { children: ReactNode }) {
  return <span style={{ fontSize: 11.5, whiteSpace: "normal" }}>{children}</span>;
}

function BalanceRow({ r, i, onOpen }: { r: PeriodBalanceRow; i: number; onOpen: () => void }) {
  return (
    <tr onClick={onOpen} onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }} tabIndex={0}
        style={{ background: i % 2 ? FT.cardAlt : "#fff", cursor: "pointer" }} aria-label={`Ouvrir le bilan de ${r.site_id}`}>
      <th scope="row" style={cell}>
        <div style={{ fontWeight: 800 }}>{r.site_id}</div>
        <div style={{ fontSize: 11, color: FT.textSub }}>{[r.site_name, r.zone, r.country?.toUpperCase()].filter(Boolean).join(" · ")}</div>
      </th>
      <td style={cell}><Wrap>{r.typologie ?? "—"}{r.profil_energetique ? <div style={{ color: FT.textSub }}>{r.profil_energetique}</div> : null}</Wrap></td>
      <td style={cell}><StockCell v={r.stock_initial_l} source={r.source_stock_initial} date={r.date_stock_initial} /></td>
      <td style={cell}><Num value={r.livraisons_externes_l} unit="L" /></td>
      <td style={cell}><Num value={r.carte_total_l} unit="L" /></td>
      <td style={cell}><Num value={r.transferts_entrants_l} unit="L" /></td>
      <td style={cell}><Num value={r.transferts_sortants_l} unit="L" /></td>
      <td style={cell}>{others(r)}</td>
      <td style={cell}><StockCell v={r.stock_final_l} source={r.source_stock_final} date={r.date_stock_final} /></td>
      <td style={cell}>{r.consommation_reelle_l !== null
        ? <b style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>{r.consommation_reelle_l.toLocaleString("fr-FR")} L</b>
        : <Dash reason="Non calculable (stock manquant ou mouvement à contrôler)" />}</td>
      <td style={cell}><StatusBadge s={r.statut_bilan} /></td>
      <td style={cell}><Cert c={r.niveau_certification} /></td>
      <td style={{ ...cell, minWidth: 260 }}><Wrap>{[...r.motifs, ...r.alertes].slice(0, 3).join(" · ") || "—"}{r.motifs.length + r.alertes.length > 3 ? " …" : ""}</Wrap></td>
      <td style={cell}>{fmtDateTime(r.calculated_at, true)}</td>
    </tr>
  );
}

function CandidateTable({ title, rows, chosen }: { title: string; rows: StockCandidate[]; chosen?: number | null }) {
  return (
    <div>
      <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 4 }}>{title} — relevés candidats ({rows.length})</div>
      {rows.length === 0 ? <span style={{ fontSize: 12, color: FT.textSub }}>Aucun relevé autour de cette borne.</span> : (
        <div style={{ overflow: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%" }}>
            <thead><tr>{["", "Source (priorité)", "Date", "Brut", "Litres", "Conversion", "Confiance", "Utilisable"].map((h) => <th key={h} style={{ ...thStyle, fontSize: 10, textAlign: "left" }}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((c) => {
                const isChosen = chosen === c.observation_id;
                return (
                  <tr key={c.observation_id} style={{ background: isChosen ? FT.greenL : undefined }}>
                    <td style={tdStyle}>{isChosen ? <b style={{ color: FT.green }}>Retenu</b> : ""}</td>
                    <td style={{ ...tdStyle, textAlign: "left" }}>{c.source_libelle} ({c.rang_priorite})</td>
                    <td style={tdStyle}>{fmtDateTime(c.date, true)}{!c.dans_periode && <div style={{ fontSize: 10, color: FT.orange }}>hors période</div>}</td>
                    <td style={tdStyle}>{c.valeur_brute ?? "—"}</td>
                    <td style={tdStyle}><Num value={c.litres} unit="L" reason={c.motif_rejet} /></td>
                    <td style={{ ...tdStyle, textAlign: "left", whiteSpace: "normal" }}>{c.methode_conversion}{c.modele_cuve ? ` · ${c.modele_cuve}` : ""}</td>
                    <td style={tdStyle}>{c.confiance}</td>
                    <td style={{ ...tdStyle, textAlign: "left", whiteSpace: "normal", color: c.utilisable ? FT.green : FT.orange }}>{c.utilisable ? "Oui" : c.motif_rejet}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MovementTable({ rows, excluded }: { rows: BalanceMovement[]; excluded?: boolean }) {
  return (
    <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%" }}>
      <thead><tr>{["Date", "Source", "Référence", "Type", excluded ? "Motif" : "Composante", excluded ? "Statut" : "Quantité", "Qualité"].map((h) =>
        <th key={h} style={{ ...thStyle, fontSize: 10, textAlign: "left" }}>{h}</th>)}</tr></thead>
      <tbody>
        {rows.map((m, i) => (
          <tr key={`${m.reference}-${i}`}>
            <td style={tdStyle}>{fmtDateTime(m.date, true)}{m.date_source && m.date_source !== "DATE_REELLE" ? <div style={{ fontSize: 10, color: FT.orange }}>{m.date_source}</div> : null}</td>
            <td style={tdStyle}>{m.source}</td>
            <td style={{ ...tdStyle, textAlign: "left" }}>
              {m.reference ?? "—"}
              {m.lien_enoc && <a href={m.lien_enoc} target="_blank" rel="noreferrer" aria-label={`Ouvrir ${m.reference} dans ENOC`} style={{ marginLeft: 4, color: FT.blue }}><ExternalLink size={11} /></a>}
            </td>
            <td style={tdStyle}>{m.type ?? "—"}</td>
            <td style={{ ...tdStyle, textAlign: "left", whiteSpace: "normal" }}>{excluded ? m.motif : COMPONENT_LABEL[m.composante ?? ""] ?? m.composante}</td>
            <td style={tdStyle}>{excluded ? `${m.statut_brut ?? "—"} → ${m.statut_metier ?? "—"}` : <Num value={m.quantite_l ?? null} unit="L" />}</td>
            <td style={tdStyle}>{m.qualite ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BalanceDetailModal({ id, onClose }: { id: number; onClose: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["stock-balance", id], queryFn: () => getPeriodBalance(id) });
  const [decision, setDecision] = useState<"certifier" | "certifier_avec_reserve" | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const d = q.data;
  const submit = async () => {
    if (!decision) return;
    if (decision === "certifier_avec_reserve" && !comment.trim()) return setError("Commentaire obligatoire pour une certification avec réserve.");
    setBusy(true);
    setError(null);
    try {
      await certifyPeriodBalance(id, decision, comment.trim());
      await Promise.all([qc.invalidateQueries({ queryKey: ["stock-balance", id] }), qc.invalidateQueries({ queryKey: ["stock-balances"] })]);
      setDecision(null);
      setComment("");
    } catch (e: unknown) {
      setError((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Certification impossible.");
    } finally {
      setBusy(false);
    }
  };
  const line = (label: string, v: number | null, sign: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12.5 }}>
      <span>{sign} {label}</span><span style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>{v === null ? "—" : `${v.toLocaleString("fr-FR")} L`}</span>
    </div>
  );
  const certifiable = d && ["PRET_A_CERTIFIER", "PRET_A_CERTIFIER_AVEC_RESERVE"].includes(d.statut_bilan);
  return (
    <Modal title={`Bilan ${d?.site_id ?? ""} — ${d ? `${fmtDateTime(d.observation_start, true)} → ${fmtDateTime(d.observation_end, true)}` : ""}`} onClose={onClose} maxWidth={1150}>
      {q.isLoading && <Skeleton h={260} />}
      {q.isError && <div role="alert" style={{ color: FT.red }}>Bilan indisponible.</div>}
      {d && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <StatusBadge s={d.statut_bilan} /> <Cert c={d.niveau_certification} />
            <span style={{ fontSize: 12, color: FT.textSub }}>{[d.site_name, d.zone, d.country?.toUpperCase(), d.typologie, d.profil_energetique].filter(Boolean).join(" · ")}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 360px) 1fr", gap: 16 }}>
            <div style={{ border: `1px solid ${FT.border}`, borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 4 }}>
              {line("Stock initial", d.stock_initial_l, "")}
              {line("Livraisons externes (Truck / Eydon)", d.livraisons_externes_l, "+")}
              {line("Carte Total", d.carte_total_l, "+")}
              {line("Transferts entrants", d.transferts_entrants_l, "+")}
              {line("Rajouts", d.rajouts_l, "+")}
              {line("Transferts sortants", d.transferts_sortants_l, "−")}
              {line("Retraits", d.retraits_l, "−")}
              {line("Vols", d.vols_l, "−")}
              {line("Vidanges", d.vidanges_l, "−")}
              {line("Stock final", d.stock_final_l, "−")}
              <div style={{ borderTop: `1px solid ${FT.border}`, marginTop: 4, paddingTop: 6, display: "flex", justifyContent: "space-between", fontWeight: 800 }}>
                <span>= Consommation réelle</span><span>{d.consommation_reelle_l === null ? "— (non calculable)" : `${d.consommation_reelle_l.toLocaleString("fr-FR")} L`}</span>
              </div>
              {d.conso_journaliere_l !== null && <div style={{ fontSize: 11.5, color: FT.textSub }}>Soit {d.conso_journaliere_l.toLocaleString("fr-FR")} L / jour entre les deux relevés</div>}
              <div style={{ fontSize: 11, color: FT.textSub }}>
                Fenêtre des mouvements : {fmtDateTime(d.periode_effective.debut, true)} → {fmtDateTime(d.periode_effective.fin, true)} (entre les relevés retenus)
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[...d.motifs, ...d.alertes].length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5 }}>
                  {d.motifs.map((m) => <li key={m}>{m}</li>)}
                  {d.alertes.map((a) => <li key={a} style={{ color: FT.red }}>{a}</li>)}
                </ul>
              ) : <span style={{ fontSize: 12.5, color: FT.green }}>Aucune anomalie : bilan prêt à certifier.</span>}
              <div style={{ fontSize: 11.5, color: FT.textSub }}>
                <b>Priorité des stocks :</b> {d.priorite_sources.join(" · ")}. Les relevés dans la période et les plus proches de la borne sont préférés.
              </div>
              {d.stock_initial_detail.motif_selection && <div style={{ fontSize: 12 }}><b>Stock initial :</b> {d.stock_initial_detail.motif_selection}</div>}
              {d.stock_final_detail.motif_selection && <div style={{ fontSize: 12 }}><b>Stock final :</b> {d.stock_final_detail.motif_selection}</div>}
            </div>
          </div>

          <CandidateTable title="Stock initial" rows={d.candidats.initial ?? []} chosen={d.stock_initial_detail.observation_id ?? null} />
          <CandidateTable title="Stock final" rows={d.candidats.final ?? []} chosen={d.stock_final_detail.observation_id ?? null} />

          <div>
            <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 4 }}>Mouvements retenus ({d.mouvements.length})</div>
            {d.mouvements.length ? <MovementTable rows={d.mouvements} /> : <span style={{ fontSize: 12, color: FT.textSub }}>Aucun mouvement intégré sur la fenêtre.</span>}
          </div>
          {d.mouvements_exclus.length > 0 && (
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 4 }}>Mouvements exclus ou à contrôler ({d.mouvements_exclus.length})</div>
              <MovementTable rows={d.mouvements_exclus} excluded />
            </div>
          )}

          <div style={{ border: `1px solid ${FT.border}`, borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 6 }}>Validation Fuel Manager</div>
            {d.certifications.length === 0 ? <div style={{ fontSize: 12, color: FT.textSub, marginBottom: 6 }}>Aucune certification.</div> : (
              <ul style={{ margin: "0 0 8px", paddingLeft: 18, fontSize: 12 }}>
                {d.certifications.map((c, i) => (
                  <li key={i}>
                    {fmtDateTime(c.date, true)} — <b>{CERT_LEVEL[c.action as StockBalanceCertLevel]?.label ?? c.action}</b> par {c.utilisateur ?? "—"}
                    {c.commentaire ? ` : « ${c.commentaire} »` : ""}{!c.toujours_valide && <span style={{ color: FT.red }}> (valeurs modifiées depuis)</span>}
                  </li>
                ))}
              </ul>
            )}
            {d.can_validate && (
              <>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" disabled={d.statut_bilan !== "PRET_A_CERTIFIER"} onClick={() => setDecision("certifier")}
                          title={d.statut_bilan !== "PRET_A_CERTIFIER" ? "Réservé aux bilans « Prêt à certifier »." : undefined}
                          style={actionBtn("green", d.statut_bilan !== "PRET_A_CERTIFIER")}>Certifier</button>
                  <button type="button" disabled={!certifiable} onClick={() => setDecision("certifier_avec_reserve")}
                          title={!certifiable ? "Bilan non calculable ou mouvements à contrôler : certification impossible." : undefined}
                          style={actionBtn("violet", !certifiable)}>Certifier avec réserve</button>
                </div>
                {decision && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                    <Field label={decision === "certifier_avec_reserve" ? "Commentaire (obligatoire)" : "Commentaire (facultatif)"}>
                      <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} style={{ ...inputStyle, width: "100%", height: "auto" }} />
                    </Field>
                    {error && <div role="alert" style={{ color: FT.red, fontSize: 12 }}>{error}</div>}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="button" disabled={busy} onClick={submit} style={actionBtn("green", busy)}>{busy ? "Enregistrement…" : "Confirmer"}</button>
                      <button type="button" onClick={() => { setDecision(null); setError(null); }} style={actionBtn("blue")}>Annuler</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Onglet Consommation : réel (bilan stock) / instrumentée (Snowflake) / théorique (CPH), même période exacte. */
export function BalanceReconciliationSection() {
  const periods = useQuery({ queryKey: ["stock-balance-periods"], queryFn: getBalancePeriods });
  const [period, setPeriod] = useState<string>("");
  const [page, setPage] = useState(1);
  const [onlyComputed, setOnlyComputed] = useState(true);
  const current = period || (periods.data?.[0] ? `${periods.data[0].observation_start}|${periods.data[0].observation_end}` : "");
  const [a, b] = current ? current.split("|") : ["", ""];
  const q = useQuery({
    queryKey: ["stock-balance-reconciliation", current, page, onlyComputed],
    queryFn: () => getBalanceReconciliation({ debut: fromIso(a), fin: fromIso(b), calculables: onlyComputed, page, limit: 25 }),
    enabled: !!current, placeholderData: (x) => x,
  });
  const gap = (v: number | null, pct: number | null) => v === null ? <Dash reason="Pas d'écart sans consommation réelle et référence" /> : (
    <span style={{ fontWeight: 700, color: Math.abs(pct ?? 0) > 20 ? FT.red : FT.text }}>
      {v > 0 ? "+" : ""}{v.toLocaleString("fr-FR")} L{pct !== null ? ` (${pct > 0 ? "+" : ""}${pct.toFixed(0)} %)` : ""}
    </span>
  );
  return (
    <Card padded={false} style={{ padding: 18 }}>
      <SheetTitle icon={<Scale size={17} />} title="Consommation réelle vs instrumentée vs théorique"
        subtitle="Réelle = bilan de stock (Stock › Bilan de stock) ; instrumentée = Snowflake ; théorique = CPH. Aucun écart n'est calculé si la consommation réelle est inconnue." />
      {periods.isLoading && <Skeleton h={120} />}
      {periods.data && periods.data.length === 0 && (
        <EmptyState icon={<Scale size={20} />} title="Aucun bilan de stock calculé" subtitle="Calculer une période dans l'onglet Stock › Bilan de stock." />
      )}
      {periods.data && periods.data.length > 0 && (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", margin: "10px 0" }}>
            <select aria-label="Période du bilan" value={current} onChange={(e) => { setPeriod(e.target.value); setPage(1); }} style={inputStyle}>
              {periods.data.map((x) => (
                <option key={`${x.observation_start}|${x.observation_end}`} value={`${x.observation_start}|${x.observation_end}`}>
                  {fmtDateTime(x.observation_start, true)} → {fmtDateTime(x.observation_end, true)} ({x.calculables}/{x.sites} calculables)
                </option>
              ))}
            </select>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700 }}>
              <input type="checkbox" checked={onlyComputed} onChange={(e) => { setOnlyComputed(e.target.checked); setPage(1); }} /> Seulement les sites avec consommation réelle
            </label>
          </div>
          {q.isLoading && <Skeleton h={200} />}
          {q.isError && <div role="alert" style={{ color: FT.red, fontSize: 13 }}>Rapprochement indisponible.</div>}
          {q.data && !q.data.calcule && <div style={{ fontSize: 12.5, color: FT.textSub }}>{q.data.message}</div>}
          {q.data && q.data.calcule && q.data.data.length === 0 && <EmptyState icon={<Scale size={20} />} title="Aucun site pour ce filtre" />}
          {q.data && q.data.data.length > 0 && (
            <>
              <div style={{ overflow: "auto", borderRadius: 12, border: `1px solid ${FT.border}` }}>
                <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 1200 }}>
                  <thead><tr>{["Site", "Conso réelle (stock)", "Conso instrumentée (Snowflake)", "Conso théorique (CPH)", "Écart réel − instrumentée",
                    "Écart réel − théorique", "Statut / certification", "Explication"].map((h) => <th key={h} scope="col" style={{ ...thStyle, textAlign: "left" }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {q.data.data.map((r, i) => (
                      <tr key={r.bilan_id} style={{ background: i % 2 ? FT.cardAlt : "#fff" }}>
                        <th scope="row" style={cell}><b>{r.site_id}</b><div style={{ fontSize: 11, color: FT.textSub }}>{[r.site_name, r.zone].filter(Boolean).join(" · ")}</div></th>
                        <td style={cell}><Num value={r.conso_reelle_l} unit="L" reason="Non calculable" /></td>
                        <td style={cell}><Num value={r.conso_instrumentee_l} unit="L" reason="Indisponible" /></td>
                        <td style={cell}><Num value={r.conso_theorique_l} unit="L" reason="Non calculable" /></td>
                        <td style={cell}>{gap(r.ecart_reel_instrumentee_l, r.ecart_reel_instrumentee_pct)}</td>
                        <td style={cell}>{gap(r.ecart_reel_theorique_l, r.ecart_reel_theorique_pct)}</td>
                        <td style={cell}><StatusBadge s={r.statut_bilan} /><div><Cert c={r.niveau_certification} /></div></td>
                        <td style={{ ...cell, minWidth: 220 }}><Wrap>{r.motif ?? "—"}</Wrap></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pager page={q.data.pagination.page} totalPages={q.data.pagination.totalPages} hasPrev={q.data.pagination.hasPrev}
                     hasNext={q.data.pagination.hasNext} onPrev={() => setPage((x) => Math.max(1, x - 1))} onNext={() => setPage((x) => x + 1)} />
            </>
          )}
        </>
      )}
    </Card>
  );
}
