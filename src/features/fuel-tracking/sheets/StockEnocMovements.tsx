// src/features/fuel-tracking/sheets/StockEnocMovements.tsx
// Mouvements Fuel & GE ENOC qualifiés : intégration eGrid sur données minimales (Ponction, Truck, Carte Total),
// niveau de qualité non bloquant, date comptable et sa provenance. Totaux séparés (intégrés, non intégrables,
// historiques non vérifiables, demandes…). Une valeur absente reste « — » (jamais 0).

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Search, SlidersHorizontal, Truck } from "lucide-react";
import {
  getEnocMovement,
  getEnocMovements,
  reconcileEnocMovement,
  type EnocDateSource,
  type EnocExecutionState,
  type EnocIntegrationStatus,
  type EnocMovementParams,
  type EnocMovementRow,
} from "@/services/fuelTracking";
import { Card, EmptyState, Modal, Pager, SheetTitle, Skeleton } from "../ui";
import { FT } from "../theme";
import { actionBtn, Dash, Field, fmtDateTime, inputStyle, Num, tdStyle, thStyle } from "./stockRegistryUi";

export const ETAT_LABEL: Record<EnocExecutionState, { label: string; bg: string; fg: string }> = {
  DEMANDE: { label: "Demande", bg: FT.slateL, fg: FT.textMid },
  APPROUVEE: { label: "Approuvée", bg: FT.blueL, fg: FT.navy },
  TERMINEE: { label: "Terminée (incomplète)", bg: FT.orangeL, fg: FT.orange },
  QUANTITE_REELLE_MANQUANTE: { label: "Quantité réelle manquante", bg: FT.orangeL, fg: FT.orange },
  PREUVE_MANQUANTE: { label: "Preuve manquante", bg: FT.orangeL, fg: FT.orange },
  A_RAPPROCHER: { label: "À rapprocher", bg: FT.violetL, fg: FT.violet },
  ELIGIBLE_STOCK_REEL: { label: "Éligible stock réel", bg: FT.greenL, fg: FT.green },
  REJETEE: { label: "Rejetée", bg: FT.redL, fg: FT.red },
  NATURE_A_QUALIFIER: { label: "Nature à qualifier", bg: FT.slateL, fg: FT.textMid },
  TRANSFERT_A_COMPLETER: { label: "Transfert à compléter", bg: FT.orangeL, fg: FT.orange },
};
const TRANSFER_LABEL: Record<string, string> = {
  COMPTABILISE: "Intégré (double écriture)", TRANSFERT_A_COMPLETER: "Non intégrable", REJETE: "Rejeté", NON_APPLICABLE: "—",
};
export const INTEGRATION_LABEL: Record<EnocIntegrationStatus, { label: string; bg: string; fg: string }> = {
  INTEGRE: { label: "Intégré", bg: FT.greenL, fg: FT.green },
  NON_INTEGRABLE: { label: "Non intégrable", bg: FT.orangeL, fg: FT.orange },
  HISTORIQUE_NON_VERIFIABLE: { label: "Historique non vérifiable", bg: FT.slateL, fg: FT.textMid },
};
export const QUALITY_LABEL: Record<string, { label: string; color: string }> = {
  COMPLET: { label: "Complet", color: FT.green },
  CONTROLE_PARTIEL: { label: "Contrôle partiel", color: FT.orange },
  NIVEAUX_MANQUANTS: { label: "Niveaux manquants", color: FT.orange },
  PREUVE_MANQUANTE: { label: "Preuve manquante", color: FT.orange },
  ECART_NIVEAU: { label: "Écart de niveau", color: FT.red },
  DONNEES_MINIMALES_MANQUANTES: { label: "Données minimales manquantes", color: FT.red },
};
export const DATE_SOURCE_LABEL: Record<EnocDateSource, string> = {
  DATE_REELLE: "date réelle", DATE_VALIDATION: "date de validation", AUCUNE_DATE: "aucune date",
};
const FM_LABEL: Record<string, { label: string; color: string }> = {
  AUCUNE: { label: "Aucune", color: FT.textSub }, EN_ATTENTE: { label: "En attente Fuel Manager", color: FT.red },
  TRAITEE: { label: "Traitée", color: FT.green },
};
const PONCTION_FILTERS: Array<[NonNullable<EnocMovementParams["ponction"]>, string]> = [
  ["comptabilisees", "Ponctions intégrées"], ["a_completer", "Ponctions non intégrables"],
  ["avec_ecart", "Ponctions avec écart"], ["attente_fm", "Ponctions en attente Fuel Manager"],
];
const RAPPROCHEMENT_LABEL: Record<string, string> = {
  NON_REQUIS: "Non requis", A_RAPPROCHER: "À rapprocher", RAPPROCHE: "Rapproché", CERTIFIE: "Certifié", REJETE: "Rejeté",
};
const TOTAL_ORDER = ["integres", "transferts", "declares", "transferts_a_completer", "historiques", "demandes", "eligibles", "certifies",
  "a_qualifier", "rejetes"] as const;
const TOTAL_TONE: Record<string, string> = {
  integres: FT.green, demandes: FT.textMid, declares: FT.orange, historiques: FT.textSub, eligibles: FT.green, certifies: FT.green,
  transferts: FT.navy, transferts_a_completer: FT.orange, a_qualifier: FT.textSub, rejetes: FT.red,
};

function useList(params: EnocMovementParams) {
  return useQuery({ queryKey: ["stock-enoc-movements", params], queryFn: () => getEnocMovements(params), placeholderData: (p) => p });
}

function EtatBadge({ etat }: { etat: EnocExecutionState }) {
  const t = ETAT_LABEL[etat] ?? { label: etat, bg: FT.slateL, fg: FT.textMid };
  return <span style={{ display: "inline-block", padding: "3px 9px", borderRadius: 999, fontSize: 10.5, fontWeight: 800, background: t.bg, color: t.fg, whiteSpace: "nowrap" }}>{t.label}</span>;
}

function IntegrationBadge({ r }: { r: EnocMovementRow }) {
  if (!r.statut_integration) return <Dash reason="Qualification à resynchroniser" />;
  const t = INTEGRATION_LABEL[r.statut_integration];
  return (
    <div>
      <span style={{ display: "inline-block", padding: "3px 9px", borderRadius: 999, fontSize: 10.5, fontWeight: 800, background: t.bg, color: t.fg, whiteSpace: "nowrap" }}>{t.label}</span>
      {r.cause_non_integration_libelle && <div style={{ fontSize: 10.5, color: FT.textSub, marginTop: 2 }}>{r.cause_non_integration_libelle}</div>}
    </div>
  );
}

function Quality({ r }: { r: EnocMovementRow }) {
  if (!r.qualite) return <Dash />;
  const t = QUALITY_LABEL[r.qualite] ?? { label: r.qualite, color: FT.textMid };
  return (
    <div>
      <span style={{ fontWeight: 800, fontSize: 11, color: t.color }}>{t.label}</span>
      {(r.qualite_manquant ?? []).length > 0 && <div style={{ fontSize: 10.5, color: FT.textSub }}>manque : {(r.qualite_manquant ?? []).join(", ")}</div>}
    </div>
  );
}

function AccountingDate({ r }: { r: EnocMovementRow }) {
  if (!r.date_comptable) return <Dash reason="Aucune date réelle ni de validation : non intégrable dans un bilan de période" />;
  return (
    <div>
      {fmtDateTime(r.date_comptable, true)}
      <div style={{ fontSize: 10.5, color: r.date_source === "DATE_REELLE" ? FT.textSub : FT.orange }}>{r.date_source ? DATE_SOURCE_LABEL[r.date_source] : ""}</div>
    </div>
  );
}

function Impact({ yes }: { yes: boolean }) {
  return (
    <span style={{ fontWeight: 800, fontSize: 11, color: yes ? FT.green : FT.textSub }} aria-label={`Impact stock : ${yes ? "oui" : "non"}`}>
      {yes ? "OUI" : "NON"}
    </span>
  );
}

function pair(a: number | null, b: number | null, unit: string) {
  if (a === null && b === null) return <Dash />;
  return (
    <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11.5 }}>
      {a === null ? "—" : a.toLocaleString("fr-FR")} → {b === null ? "—" : b.toLocaleString("fr-FR")} {unit}
    </span>
  );
}

export function StockEnocMovements({ openId, onOpened }: { openId?: number | null; onOpened?: () => void }) {
  const [p, setP] = useState<EnocMovementParams>({ page: 1, limit: 25 });
  const [more, setMore] = useState(false);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<number | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setP((x) => ({ ...x, site: search || undefined, page: 1 })), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => {
    if (openId) {
      setDetail(openId);
      onOpened?.();
    }
  }, [openId, onOpened]);
  const q = useList(p);
  const d = q.data;
  const set = (patch: Partial<EnocMovementParams>) => setP((x) => ({ ...x, ...patch, page: 1 }));
  const sel = (label: string, value: string | undefined, options: Array<[string, string]>, onChange: (v: string) => void) => (
    <select aria-label={label} value={value ?? ""} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
      <option value="">{label} : tous</option>
      {options.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
    </select>
  );

  return (
    <Card padded={false} style={{ padding: 18 }}>
      <SheetTitle
        icon={<Truck size={17} />}
        title="Mouvements ENOC (Fuel & GE)"
        subtitle="Un mouvement ENOC validé est intégré au stock dès que ses données comptables minimales sont présentes. Niveaux, photo, bon et compteur absents ne bloquent pas : ils baissent le niveau de qualité."
      />

      {d && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8, margin: "12px 0" }}>
          {TOTAL_ORDER.map((k) => {
            const t = d.totaux[k];
            if (!t) return null;
            return (
              <div key={k} style={{ border: `1px solid ${FT.border}`, borderRadius: 10, padding: "8px 12px", background: FT.slateL }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: TOTAL_TONE[k], fontFamily: "ui-monospace, Menlo, monospace" }}>{t.count.toLocaleString("fr-FR")}</div>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: FT.text }}>{t.label}</div>
                <div style={{ fontSize: 10.5, color: FT.textSub }}>
                  {t.quantite_reelle_l !== null ? `${t.quantite_reelle_l.toLocaleString("fr-FR")} L (${t.base ?? "quantité réelle"})` : `${t.base ?? "quantité réelle"} : —`}
                  {t.sans_quantite ? ` · ${t.sans_quantite} sans quantité` : ""}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, border: `1px solid ${FT.border}`, background: FT.slateL, borderRadius: 9, padding: "0 10px", height: 32, minWidth: 220 }}>
          <Search size={14} color={FT.textSub} aria-hidden />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Site, nom ou référence ENOC…" aria-label="Rechercher"
                 style={{ border: "none", outline: "none", background: "transparent", fontSize: 12.5, flex: 1 }} />
        </div>
        {sel("Type brut", p.type_brut, [["TOTAL_CARD", "Carte Total"], ["PONCTION", "Ponction"], ["TRUCK", "Truck"], ["AUTRE", "Autre"],
          ...(d?.facettes.types_bruts ?? []).filter((t) => !["TOTAL_CARD", "PONCTION", "TRUCK"].includes(t)).map((t) => [t, t] as [string, string])],
          (v) => set({ type_brut: v || undefined }))}
        {sel("Statut ENOC", p.statut_enoc, [...(d?.facettes.statuts_enoc ?? []).map((s) => [s, s] as [string, string]), ["(aucun)", "Sans statut (opération seule)"]],
          (v) => set({ statut_enoc: v || undefined }))}
        {sel("Qualification", p.qualification, (d?.facettes.qualifications ?? []).map((x) => [x.key, x.label] as [string, string]),
          (v) => set({ qualification: v || undefined }))}
        {sel("Intégration", p.integration, (d?.facettes.integrations ?? []).map((x) => [x.key, INTEGRATION_LABEL[x.key]?.label ?? x.label] as [string, string]),
          (v) => set({ integration: (v || "") as "" | EnocIntegrationStatus }))}
        {sel("Qualité", p.qualite, (d?.facettes.qualites ?? []).map((x) => [x, QUALITY_LABEL[x]?.label ?? x] as [string, string]),
          (v) => set({ qualite: v || undefined }))}
        {sel("Impact stock", p.impact, [["OUI", "Oui"], ["NON", "Non"]], (v) => set({ impact: (v || "") as "" | "OUI" | "NON" }))}
        {sel("Preuve", p.preuve, [["AVEC", "Avec preuve"], ["SANS", "Sans preuve"]], (v) => set({ preuve: (v || "") as "" | "AVEC" | "SANS" }))}
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: FT.text }}>
          <input type="checkbox" checked={!!p.a_rapprocher} onChange={(e) => set({ a_rapprocher: e.target.checked })} /> Intégrés non rapprochés
        </label>
        <button type="button" aria-expanded={more} onClick={() => setMore(!more)} style={actionBtn("blue")}>
          <SlidersHorizontal size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Plus de filtres
        </button>
      </div>
      <div role="group" aria-label="Filtres Ponction" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {PONCTION_FILTERS.map(([k, label]) => {
          const active = p.ponction === k;
          return (
            <button key={k} type="button" aria-pressed={active} onClick={() => set({ ponction: active ? undefined : k })}
                    style={{ ...actionBtn(active ? "violet" : "blue"), background: active ? FT.violetL : undefined }}>
              {label}
            </button>
          );
        })}
      </div>
      {more && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 10 }}>
          {sel("Cause de non-intégration", p.cause, (d?.facettes.causes ?? []).map((x) => [x.key, x.label] as [string, string]),
            (v) => set({ cause: v || undefined }))}
          {sel("Anomalie", p.anomalie, [["1", "Avec au moins une anomalie"], ...(d?.facettes.anomalies ?? []).map((a) => [a, a] as [string, string])],
            (v) => set({ anomalie: v || undefined }))}
          <Field label="Du"><input type="date" value={p.date_debut ?? ""} onChange={(e) => set({ date_debut: e.target.value || undefined })} style={inputStyle} /></Field>
          <Field label="Au"><input type="date" value={p.date_fin ?? ""} onChange={(e) => set({ date_fin: e.target.value || undefined })} style={inputStyle} /></Field>
          {sel("Pays", p.pays, (d?.facettes.pays ?? []).map((x) => [x, x] as [string, string]), (v) => set({ pays: v || undefined }))}
          {sel("Zone", p.zone, (d?.facettes.zones ?? []).map((x) => [x, x] as [string, string]), (v) => set({ zone: v || undefined }))}
        </div>
      )}

      {q.isLoading && <Skeleton h={300} />}
      {q.isError && <div role="alert" style={{ color: FT.red, fontSize: 13 }}>Mouvements ENOC indisponibles (serveur API à mettre à jour ou erreur de chargement).</div>}
      {d && d.data.length === 0 && <EmptyState icon={<Truck size={20} />} title="Aucun mouvement ENOC pour ces filtres" />}
      {d && d.data.length > 0 && (
        <>
          {(p.ponction || p.type_brut === "PONCTION") ? <PonctionTable rows={d.data} fetching={q.isFetching} onOpen={setDetail} /> : (
          <div style={{ overflow: "auto", maxHeight: 560, borderRadius: 12, border: `1px solid ${FT.border}`, opacity: q.isFetching ? 0.7 : 1 }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 2000 }}>
              <thead>
                <tr>
                  {["Réf. ENOC", "Site", "Type brut", "Statut ENOC", "Intégration", "Impact stock", "Qualité", "Date comptable", "Quantité réelle",
                    "Niveau av. → ap. (L)", "Niveau av. → ap. (cm)", "Compteur GE av. → ap.", "Preuves", "Qualification eGrid", "Rapprochement", "Motif"].map((h) => (
                    <th key={h} scope="col" style={{ ...thStyle, textAlign: "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.data.map((r, i) => (
                  <tr key={r.id} onClick={() => setDetail(r.id)} style={{ background: i % 2 ? FT.cardAlt : "#fff", cursor: "pointer" }}>
                    <th scope="row" style={cell}>
                      <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontWeight: 800 }}>{r.enoc_reference ?? "—"}</span>
                      {r.lien_enoc && (
                        <a href={r.lien_enoc} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} aria-label={`Ouvrir ${r.enoc_reference} dans ENOC`}
                           style={{ marginLeft: 4, color: FT.blue }}><ExternalLink size={12} /></a>
                      )}
                    </th>
                    <td style={cell}>
                      <div style={{ fontWeight: 700 }}>{r.site_id ?? <Dash reason="site_id absent" />}</div>
                      <div style={{ fontSize: 11, color: r.site_connu ? FT.textSub : FT.orange }}>{r.site_connu ? r.site_name ?? "" : "site non reconnu"}</div>
                    </td>
                    <td style={cell}>{r.type_brut ?? <Dash />}</td>
                    <td style={cell}>{r.statut_brut ?? <span style={{ color: FT.textSub, fontSize: 11 }}>aucun (opération seule)</span>}</td>
                    <td style={cell}><IntegrationBadge r={r} /></td>
                    <td style={cell}>{r.impact_stock && r.quantite_integree_l !== null && r.quantite_integree_l !== undefined
                      ? <span style={{ fontWeight: 800, color: FT.green }}>+{r.quantite_integree_l.toLocaleString("fr-FR")} L</span> : <Impact yes={r.impact_stock} />}</td>
                    <td style={cell}><Quality r={r} /></td>
                    <td style={cell}><AccountingDate r={r} /></td>
                    <td style={cell}>{r.quantite_reelle_l !== null ? <><Num value={r.quantite_reelle_l} /> {r.unite ?? "?"}</> : <Dash reason="Quantité réelle absente" />}</td>
                    <td style={cell}>{pair(r.niveau_avant_l, r.niveau_apres_l, "L")}</td>
                    <td style={cell}>{pair(r.niveau_avant_cm, r.niveau_apres_cm, "cm")}</td>
                    <td style={cell}>{pair(r.compteur_avant_h, r.compteur_apres_h, "h")}</td>
                    <td style={cell}>{r.nb_preuves ? <strong>{r.nb_preuves}</strong> : <span style={{ color: FT.orange, fontWeight: 700 }}>0</span>}</td>
                    <td style={cell}><EtatBadge etat={r.etat} /><div style={{ fontSize: 10.5, color: FT.textSub, marginTop: 2 }}>{r.qualification}</div></td>
                    <td style={cell}>{RAPPROCHEMENT_LABEL[r.rapprochement] ?? r.rapprochement}</td>
                    <td style={{ ...cell, minWidth: 260, fontSize: 11.5 }}>{r.motif}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
          <Pager
            page={d.pagination.page}
            totalPages={d.pagination.totalPages}
            hasPrev={d.pagination.hasPrev}
            hasNext={d.pagination.hasNext}
            onPrev={() => setP((x) => ({ ...x, page: Math.max(1, (x.page ?? 1) - 1) }))}
            onNext={() => setP((x) => ({ ...x, page: (x.page ?? 1) + 1 }))}
          />
          <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 11.5, color: FT.textSub }}>
            {d.regles.map((r) => <li key={r}>{r}</li>)}
          </ul>
        </>
      )}
      {detail !== null && <EnocMovementDetailModal id={detail} onClose={() => setDetail(null)} />}
    </Card>
  );
}

const cell: CSSProperties = { ...tdStyle, textAlign: "left", whiteSpace: "normal", verticalAlign: "top", padding: "9px 10px" };

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ minWidth: 150 }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, color: FT.textSub, textTransform: "uppercase", letterSpacing: ".03em" }}>{label}</div>
      <div style={{ fontSize: 12.5, color: FT.text }}>{children ?? <Dash />}</div>
    </div>
  );
}

function EnocMovementDetailModal({ id, onClose }: { id: number; onClose: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["stock-enoc-movement", id], queryFn: () => getEnocMovement(id) });
  const [showRaw, setShowRaw] = useState(false);
  const [decision, setDecision] = useState<"rapprocher" | "rejeter" | "acquitter" | null>(null);
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const d = q.data;

  const submit = async () => {
    if (!decision) return;
    if (!reason.trim()) return setError("Le motif est obligatoire.");
    if (decision === "rapprocher" && !evidence.trim()) return setError("L'élément de rapprochement est obligatoire (relevé terrain, stock, bon fournisseur…).");
    setBusy(true);
    setError(null);
    try {
      await reconcileEnocMovement(id, decision, reason.trim(), evidence.trim());
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["stock-enoc-movement", id] }),
        qc.invalidateQueries({ queryKey: ["stock-enoc-movements"] }),
        qc.invalidateQueries({ queryKey: ["stock-queue-counters"] }),
        qc.invalidateQueries({ queryKey: ["stock-queue"] }),
      ]);
      setDecision(null);
      setReason("");
      setEvidence("");
    } catch (e: unknown) {
      setError((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Action impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`Mouvement ENOC ${d?.enoc_reference ?? ""}`} onClose={onClose} maxWidth={1100}>
      {q.isLoading && <Skeleton h={260} />}
      {q.isError && <div role="alert" style={{ color: FT.red }}>Détail indisponible.</div>}
      {d && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <EtatBadge etat={d.etat} />
            <span style={{ fontSize: 12, fontWeight: 700 }}>{d.qualification}</span>
            <span style={{ fontSize: 12 }}>Impact stock : <Impact yes={d.impact_stock} /></span>
            <span style={{ fontSize: 12 }}>Rapprochement : {RAPPROCHEMENT_LABEL[d.rapprochement]}</span>
            {d.lien_enoc && <a href={d.lien_enoc} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: FT.blue }}>Ouvrir dans ENOC <ExternalLink size={11} /></a>}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: d.impact_stock ? FT.green : FT.orange }}>{d.motif}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, border: `1px solid ${FT.border}`, borderRadius: 10, padding: 10 }}>
            <Info label="Mouvement intégré"><IntegrationBadge r={d} /></Info>
            <Info label="Impact stock">{d.impact_stock && d.quantite_integree_l != null
              ? <b style={{ color: FT.green }}>{d.type_famille === "PONCTION" ? "±" : "+"}{d.quantite_integree_l.toLocaleString("fr-FR")} L</b> : "Aucun"}</Info>
            <Info label="Niveau de qualité"><Quality r={d} /></Info>
            <Info label="Date utilisée (provenance)"><AccountingDate r={d} /></Info>
          </div>
          {d.conditions_manquantes.length > 0 && <div style={{ fontSize: 12, color: FT.orange }}>Conditions manquantes : {d.conditions_manquantes.join(", ")}</div>}
          {d.alertes.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
              {d.alertes.map((a, i) => <li key={i} style={{ color: a.blocking ? FT.red : FT.textMid }}>{a.blocking ? "Bloquant — " : ""}{a.message}</li>)}
            </ul>
          )}

          {d.type_famille === "PONCTION" && <PonctionSection d={d} />}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
            <Info label="Site">{d.site_id} {d.site_name ? `· ${d.site_name}` : ""}{!d.site_connu && <span style={{ color: FT.orange }}> (non reconnu)</span>}</Info>
            <Info label="Pays / zone">{[d.country, d.zone].filter(Boolean).join(" · ") || null}</Info>
            <Info label="Type brut / statut brut">{`${d.type_brut ?? "—"} / ${d.statut_brut ?? "—"}`}</Info>
            <Info label="Demandé / approuvé / réel">
              {[d.quantite_demandee_l, d.quantite_approuvee_l, d.quantite_reelle_l].map((v) => (v === null ? "—" : v.toLocaleString("fr-FR"))).join(" / ")} {d.unite ?? ""}
            </Info>
            <Info label="Date prévue / réelle">{`${fmtDateTime(d.date_prevue) ?? "—"} / ${fmtDateTime(d.date_reelle, true) ?? "—"}`}</Info>
            <Info label="Demande / approbation / clôture">
              {[d.date_demande, d.date_approbation, d.date_cloture].map((v) => fmtDateTime(v) ?? "—").join(" / ")}
            </Info>
            <Info label="Niveau avant → après">{pair(d.niveau_avant_l, d.niveau_apres_l, "L")} · {pair(d.niveau_avant_cm, d.niveau_apres_cm, "cm")}</Info>
            <Info label="Compteur GE">{pair(d.compteur_avant_h, d.compteur_apres_h, "h")}</Info>
            <Info label="Technicien / valideur / clôture">{[d.technicien, d.valideur, d.cloture_par].map((v) => v ?? "—").join(" / ")}</Info>
            <Info label="Fournisseur / BL / camion">{[d.fournisseur, d.bon_livraison, d.camion].map((v) => v ?? "—").join(" / ")}</Info>
            <Info label="Opérations ENOC liées">{d.nb_operations}</Info>
            <Info label="Commentaire">{d.commentaire}</Info>
          </div>

          <div>
            <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 4 }}>Preuves ({d.nb_preuves})</div>
            {d.preuves.length === 0 ? <span style={{ fontSize: 12, color: FT.orange }}>Aucune photo ni pièce jointe dans ENOC.</span> : (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
                {d.preuves.map((u) => <li key={u}>{/^https?:\/\//.test(u) ? <a href={u} target="_blank" rel="noreferrer" style={{ color: FT.blue }}>{u}</a> : u}</li>)}
              </ul>
            )}
          </div>

          <div>
            <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 4 }}>Éléments de rapprochement (relevés terrain à ± 72 h)</div>
            {d.contexte_rapprochement.releves_terrain.length === 0 ? (
              <span style={{ fontSize: 12, color: FT.textSub }}>Aucun relevé terrain autour de la date réelle.</span>
            ) : (
              <table style={{ borderCollapse: "collapse", fontSize: 12 }}>
                <thead><tr>{["Position", "Source", "Date", "Brut", "Litres", "Statut"].map((h) => <th key={h} style={{ ...thStyle, fontSize: 10 }}>{h}</th>)}</tr></thead>
                <tbody>
                  {d.contexte_rapprochement.releves_terrain.map((o) => (
                    <tr key={o.id}>
                      <td style={tdStyle}>{o.position}</td><td style={tdStyle}>{o.source}</td><td style={tdStyle}>{fmtDateTime(o.date, true)}</td>
                      <td style={tdStyle}>{o.brut ?? "—"}</td><td style={tdStyle}><Num value={o.litres} unit="L" /></td><td style={tdStyle}>{o.statut}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {d.rapproche_par && (
              <div style={{ fontSize: 12, marginTop: 6 }}>
                Rapproché par <b>{d.rapproche_par}</b> le {fmtDateTime(d.rapproche_le, true)} — {d.motif_rapprochement} ({d.element_rapprochement})
              </div>
            )}
          </div>

          {d.can_validate && !["REJETEE"].includes(d.etat) && (
            <div style={{ border: `1px solid ${FT.border}`, borderRadius: 10, padding: 12 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {d.alerte_fuel_manager === "EN_ATTENTE" && (
                  <button type="button" onClick={() => setDecision("acquitter")} style={actionBtn("violet")}>Acquitter l'alerte Fuel Manager</button>
                )}
                {d.type_famille !== "PONCTION" && (() => {
                  const off = d.statut_integration !== "INTEGRE" || d.rapprochement !== "A_RAPPROCHER" || d.bloquant;
                  return (
                    <button type="button" disabled={off} onClick={() => setDecision("rapprocher")}
                            title={off ? "Seul un mouvement intégré non encore rapproché peut être rapproché (certification)." : undefined}
                            style={actionBtn("green", off)}>Rapprocher (certifier)</button>
                  );
                })()}
                <button type="button" onClick={() => setDecision("rejeter")} style={actionBtn("red")}>
                  {d.impact_stock ? "Rejeter (retirer du stock)" : "Rejeter"}
                </button>
              </div>
              {decision && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                  {decision === "rapprocher" && (
                    <Field label="Élément de rapprochement (obligatoire)">
                      <input value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="Ex. relevé Loliforce du 02/10 : +200 L ; BL Eydon 4512"
                             style={{ ...inputStyle, width: "100%" }} />
                    </Field>
                  )}
                  <Field label="Motif (obligatoire)">
                    <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} style={{ ...inputStyle, width: "100%", height: "auto" }} />
                  </Field>
                  {error && <div role="alert" style={{ color: FT.red, fontSize: 12 }}>{error}</div>}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" disabled={busy} onClick={submit} style={actionBtn(decision === "rejeter" ? "red" : "green", busy)}>
                      {busy ? "Enregistrement…" : decision === "rapprocher" ? "Confirmer le rapprochement" : decision === "acquitter" ? "Confirmer le contrôle" : "Confirmer le rejet"}
                    </button>
                    <button type="button" onClick={() => { setDecision(null); setError(null); }} style={actionBtn("blue")}>Annuler</button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <button type="button" aria-expanded={showRaw} onClick={() => setShowRaw(!showRaw)} style={actionBtn("blue")}>
              {showRaw ? "Masquer" : "Voir"} la donnée brute ENOC et la source de chaque champ
            </button>
            {showRaw && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 10, marginTop: 8 }}>
                <pre style={pre}>{JSON.stringify(d.sources_champs, null, 2)}</pre>
                <pre style={pre}>{JSON.stringify({ demande: d.brut.demande, operations: d.brut.operations ?? d.brut.operation }, null, 2)}</pre>
              </div>
            )}
          </div>

          {d.historique.length > 0 && (
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 4 }}>Historique</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
                {d.historique.map((h, i) => <li key={i}>{fmtDateTime(h.date, true)} — {h.action} {h.champ ?? ""} : {h.ancien ?? "—"} → {h.nouveau ?? "—"} ({h.auteur ?? "—"}) — {h.motif}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

const pre: CSSProperties = { margin: 0, maxHeight: 320, overflow: "auto", background: FT.slateL, borderRadius: 8, padding: 10, fontSize: 11 };



function signed(v: number | null) {
  if (v === null) return <Dash />;
  return <span style={{ fontWeight: 800, color: v < 0 ? FT.red : FT.green, fontFamily: "ui-monospace, Menlo, monospace" }}>{v > 0 ? "+" : ""}{v.toLocaleString("fr-FR")} L</span>;
}

/** Ponctions : site_id de la demande = DESTINATAIRE, « Site source » = SOURCE ; volume comptable = quantité approuvée. */
function PonctionTable({ rows, fetching, onOpen }: { rows: EnocMovementRow[]; fetching: boolean; onOpen: (id: number) => void }) {
  return (
    <div style={{ overflow: "auto", maxHeight: 560, borderRadius: 12, border: `1px solid ${FT.border}`, opacity: fetching ? 0.7 : 1 }}>
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 2200 }}>
        <thead>
          <tr>
            {["Réf. ENOC", "transfer_id", "Site source", "Site destinataire", "Qté approuvée", "Statut transfert", "Qualité", "Date comptable",
              "Niveau source av. → ap.", "Variation observée", "Écart de contrôle", "Impact source", "Impact destinataire", "Alerte Fuel Manager",
              "Bon de transfert", "Validé par / le", "Motif"].map((h) => <th key={h} scope="col" style={{ ...thStyle, textAlign: "left" }}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} onClick={() => onOpen(r.id)} style={{ background: i % 2 ? FT.cardAlt : "#fff", cursor: "pointer" }}>
              <th scope="row" style={{ ...cell, fontFamily: "ui-monospace, Menlo, monospace" }}>{r.enoc_reference ?? "—"}</th>
              <td style={{ ...cell, fontSize: 11 }}>{r.transfer_id ?? <Dash />}</td>
              <td style={cell}>{r.site_source ?? <Dash reason="Site source absent" />}{r.site_source && !r.site_source_connu && <div style={{ fontSize: 10.5, color: FT.orange }}>inconnu</div>}</td>
              <td style={cell}>{r.site_destinataire ?? <Dash reason="site_id absent" />}</td>
              <td style={cell}><Num value={r.quantite_approuvee_l} unit="L" reason="Quantité approuvée absente" /></td>
              <td style={cell}>{TRANSFER_LABEL[r.statut_transfert] ?? r.statut_transfert}
                {r.cause_non_integration_libelle && <div style={{ fontSize: 10.5, color: FT.textSub }}>{r.cause_non_integration_libelle}</div>}</td>
              <td style={cell}><Quality r={r} /></td>
              <td style={cell}><AccountingDate r={r} /></td>
              <td style={cell}>{r.niveau_source_avant_l !== null || r.niveau_source_apres_l !== null
                ? pair(r.niveau_source_avant_l, r.niveau_source_apres_l, "L") : pair(r.niveau_source_avant_cm, r.niveau_source_apres_cm, "cm")}</td>
              <td style={cell}>{signed(r.variation_source_l)}</td>
              <td style={cell}><Num value={r.ecart_controle_l} unit="L" reason="Niveaux source en litres absents" /></td>
              <td style={cell}>{signed(r.impact_source_l)}</td>
              <td style={cell}>{signed(r.impact_destinataire_l)}</td>
              <td style={{ ...cell, color: FM_LABEL[r.alerte_fuel_manager]?.color, fontWeight: 700 }}>{FM_LABEL[r.alerte_fuel_manager]?.label}</td>
              <td style={cell}>{r.bon_transfert ?? <Dash reason="Bon de transfert absent" />}</td>
              <td style={cell}>{r.valideur ?? "—"}<div style={{ fontSize: 11, color: FT.textSub }}>{fmtDateTime(r.date_approbation, true) ?? "—"}</div></td>
              <td style={{ ...cell, minWidth: 280, fontSize: 11.5 }}>{r.motif}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PonctionSection({ d }: { d: EnocMovementRow }) {
  return (
    <div style={{ border: `1px solid ${FT.border}`, borderRadius: 10, padding: 12, background: FT.slateL }}>
      <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 8 }}>
        Ponction — {TRANSFER_LABEL[d.statut_transfert]} {d.transfer_id ? `· ${d.transfer_id}` : ""}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
        <Info label="Site source (fournit)">{d.site_source}</Info>
        <Info label="Site destinataire (reçoit)">{d.site_destinataire}</Info>
        <Info label="Quantité approuvée (comptable)"><Num value={d.quantite_approuvee_l} unit="L" /></Info>
        <Info label="Impact source / destinataire"><>{signed(d.impact_source_l)} / {signed(d.impact_destinataire_l)}</></Info>
        <Info label="Niveau source avant → après">{pair(d.niveau_source_avant_l, d.niveau_source_apres_l, "L")} · {pair(d.niveau_source_avant_cm, d.niveau_source_apres_cm, "cm")}</Info>
        <Info label="Variation observée / écart de contrôle"><>{signed(d.variation_source_l)} / <Num value={d.ecart_controle_l} unit="L" /></></Info>
        <Info label="Bon de transfert">{d.bon_transfert}</Info>
        <Info label="Validé par / le">{`${d.valideur ?? "—"} / ${fmtDateTime(d.date_approbation, true) ?? "—"}`}</Info>
        <Info label="Alerte Fuel Manager">
          <span style={{ color: FM_LABEL[d.alerte_fuel_manager]?.color, fontWeight: 700 }}>{FM_LABEL[d.alerte_fuel_manager]?.label}</span>
          {d.fm_traite_par && <div style={{ fontSize: 11 }}>par {d.fm_traite_par} le {fmtDateTime(d.fm_traite_le, true)} — {d.fm_commentaire}</div>}
        </Info>
      </div>
      <div style={{ fontSize: 11, color: FT.textSub, marginTop: 6 }}>
        Le volume approuvé fait foi pour la comptabilisation ; la variation de niveau n'est qu'un contrôle (alerte au-delà de max(20 L ; 10 %)).
      </div>
    </div>
  );
}
