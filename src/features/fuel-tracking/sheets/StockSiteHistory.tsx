// src/features/fuel-tracking/sheets/StockSiteHistory.tsx
// Panneau historique d'un site du registre de stock : relevés, mouvements, comparaisons
// Loliforce / SCSS, cuves (correction / validation tracée), gardiennage, corrections.

import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createGuardScope,
  createStockTank,
  decideStockMovement,
  decideStockObservation,
  getStockSiteHistory,
  patchStockTank,
  type StockObservation,
  type StockSiteHistory as StockSiteHistoryData,
  type StockTank,
  type TankPatch,
} from "@/services/fuelTracking";
import { EmptyState, Modal, SegmentedTabs, Skeleton } from "../ui";
import { FT } from "../theme";
import {
  actionBtn,
  ageLabel,
  CATEGORY_LABEL,
  FAMILY_DIMS,
  FAMILY_LABEL,
  PROFILE_LABEL,
  CONVERSION_LABEL,
  Dash,
  Field,
  fmtDateTime,
  inputStyle,
  METHOD_LABEL,
  MOVEMENT_LABEL,
  Num,
  ReasonDialog,
  SOURCE_LABEL,
  StatusPill,
  tdStyle,
  thStyle,
} from "./stockRegistryUi";

type Tab = "RELEVES" | "MOUVEMENTS" | "COMPARAISONS" | "CUVES" | "CORRECTIONS";

type Pending = { kind: "obs" | "mv"; id: number; decision: "valider" | "rejeter"; label: string } | null;

export function StockSiteHistory({ siteId, initialTab = "RELEVES", onClose }: { siteId: string; initialTab?: Tab; onClose: () => void }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [pending, setPending] = useState<Pending>(null);
  const [explain, setExplain] = useState<StockObservation | null>(null);
  const q = useQuery({ queryKey: ["stock-registry-site", siteId], queryFn: () => getStockSiteHistory(siteId) });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["stock-registry-site", siteId] });
    qc.invalidateQueries({ queryKey: ["stock-registry"] });
  };
  const d = q.data;
  const can = !!d?.can_validate;

  return (
    <Modal title={`Historique stock — ${siteId}${d?.site?.name ? ` · ${d.site.name}` : ""}`} onClose={onClose} maxWidth={1180}>
      {q.isLoading && <Skeleton h={320} />}
      {q.isError && (
        <div role="alert" style={{ color: FT.red, fontSize: 13 }}>
          Historique indisponible (erreur de chargement).
        </div>
      )}
      {d && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <RetainedSummary d={d} />
          <SegmentedTabs<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { key: "RELEVES", label: `Relevés (${d.observations.length})` },
              { key: "MOUVEMENTS", label: `Mouvements (${d.mouvements.length})` },
              { key: "COMPARAISONS", label: `Comparaisons (${d.comparaisons.length})` },
              { key: "CUVES", label: `Cuves & gardiennage (${d.cuves.length})` },
              { key: "CORRECTIONS", label: `Corrections (${d.corrections.length})` },
            ]}
          />

          {tab === "RELEVES" && (
            <Table
              empty="Aucun relevé pour ce site."
              head={["Date", "Source", "Cuve", "Niveau brut", "Volume géométrique", "Volume calibré", "Volume retenu", "Méthode", "Statut", "Anomalie → action", "Saisi par", "Preuve", "Actions"]}
              rows={d.observations.map((o) => {
                const geoOnly = o.conversion_status === "GEOMETRIC_ONLY" && o.volume_geometric_l !== null;
                const canValidate = o.validation_status !== "VALIDATED" && (o.level_liters !== null && o.conversion_status === "VALID" || geoOnly);
                return [
                  fmtDateTime(o.observation_datetime, o.source_type === "ENOC") ?? <Dash />,
                  SOURCE_LABEL[o.source_type] ?? o.source_type,
                  o.tank_id ?? <Dash reason="Cuve non précisée" />,
                  rawLevel(o),
                  <Num value={o.volume_geometric_l} unit="L" digits={1} reason="Pas de géométrie validée" />,
                  <Num value={o.volume_calibrated_l} unit="L" digits={1} reason="Capacité de plaque non confirmée" />,
                  <strong><Num value={o.level_liters} unit="L" digits={1} reason={o.conversion_message} /></strong>,
                  <span title={o.conversion_rule ?? undefined}>{METHOD_LABEL[o.conversion_method] ?? o.conversion_method}</span>,
                  <StatusPill status={o.statut_releve} />,
                  <Wrap>
                    {o.issues.length
                      ? o.issues.map((x) => <div key={x.code}><b>{x.anomalie}</b> → {x.action}</div>)
                      : o.validation_reason ?? "—"}
                  </Wrap>,
                  o.validated_by ? `${o.source_user ?? "—"} (validé par ${o.validated_by})` : o.source_user ?? <Dash />,
                  o.proof_reference ? <ProofLink value={o.proof_reference} /> : <Dash reason="Aucune preuve" />,
                  <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>
                    <button type="button" onClick={() => setExplain(o)} style={actionBtn("blue")} aria-label={`Expliquer la conversion du relevé ${o.id}`}>
                      Conversion
                    </button>
                    {can && (
                      <>
                        <button
                          type="button"
                          disabled={!canValidate}
                          title={!canValidate && o.validation_status !== "VALIDATED" ? "Relevé non convertible en litres : traiter la cuve d'abord." : geoOnly ? "Retient le volume géométrique (validation explicite, tracée)." : undefined}
                          onClick={() => setPending({ kind: "obs", id: o.id, decision: "valider", label: `relevé #${o.id}${geoOnly ? " (volume géométrique)" : ""}` })}
                          style={actionBtn("green", !canValidate)}
                        >
                          Valider
                        </button>
                        <button
                          type="button"
                          disabled={o.validation_status === "REJECTED"}
                          onClick={() => setPending({ kind: "obs", id: o.id, decision: "rejeter", label: `relevé #${o.id}` })}
                          style={actionBtn("red", o.validation_status === "REJECTED")}
                        >
                          Rejeter
                        </button>
                      </>
                    )}
                  </div>,
                ];
              })}
            />
          )}

          {tab === "MOUVEMENTS" && (
            <Table
              empty="Aucun mouvement pour ce site."
              head={["Date", "Source", "Valeur brute", "Classification", "Type", "Retenu stock", "Qté demandée", "Qté réalisée", "Fournisseur", "Ticket / bon", "Preuve", "Niveaux avant → après", "Statut", "Alertes", "Actions"]}
              rows={d.mouvements.map((m) => [
                fmtDateTime(m.movement_datetime) ?? <Dash />,
                SOURCE_LABEL[m.source_type] ?? m.source_type,
                m.raw_operation_type ?? <Dash />,
                <span title={m.mapping_rule ?? undefined}>{m.source_category ? CATEGORY_LABEL[m.source_category] ?? m.source_category : <Dash />}</span>,
                m.movement_type ? MOVEMENT_LABEL[m.movement_type] ?? m.movement_type : <Dash reason="Type non classifié" />,
                m.retained_in_stock ? "Oui" : <span style={{ color: FT.textSub }} title="Demande, carte Total, type inconnu, quantité ou preuve manquante">Non</span>,
                <Num value={m.requested_quantity_l} unit="L" />,
                <Num value={m.quantity_l} unit="L" reason="Quantité réalisée non déclarée" />,
                m.supplier ?? <Dash />,
                [m.ticket_reference, m.delivery_note].filter(Boolean).join(" / ") || <Dash reason="Sans ticket ni bon" />,
                m.proof_reference ? <ProofLink value={m.proof_reference} /> : <Dash reason="Aucune preuve" />,
                `${m.level_before_raw ?? "—"} → ${m.level_after_raw ?? "—"}`,
                <StatusPill status={m.status} />,
                <Wrap>{m.alerts.map((a) => a.message).join(" · ") || "—"}</Wrap>,
                can ? (
                  <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>
                    <button
                      type="button"
                      disabled={m.status === "VALIDATED" || m.quantity_l === null || !m.movement_type}
                      title={m.quantity_l === null ? "Quantité réalisée inconnue : validation impossible." : undefined}
                      onClick={() => setPending({ kind: "mv", id: m.id, decision: "valider", label: `mouvement #${m.id}` })}
                      style={actionBtn("green", m.status === "VALIDATED" || m.quantity_l === null || !m.movement_type)}
                    >
                      Valider
                    </button>
                    <button
                      type="button"
                      disabled={m.status === "REJECTED"}
                      onClick={() => setPending({ kind: "mv", id: m.id, decision: "rejeter", label: `mouvement #${m.id}` })}
                      style={actionBtn("red", m.status === "REJECTED")}
                    >
                      Rejeter
                    </button>
                  </div>
                ) : <Dash reason="Réservé aux rôles admin et manager" />,
              ])}
            />
          )}

          {tab === "COMPARAISONS" && (
            <>
              <Note>
                Loliforce / SCSS : même site et même cuve, deux relevés en litres à moins de 48 h, capacité validée. Écart ≤ max(100 L, 10 % de la capacité)
                → cohérent ; sinon conflit : les deux relevés repassent « à valider ». Aucune moyenne, aucun choix automatique.
              </Note>
              <Table
                empty="Aucune paire Loliforce / SCSS à moins de 48 h pour ce site."
                head={["Cuve", "Loliforce", "SCSS", "Écart", "Tolérance", "Résultat", "Motif"]}
                rows={d.comparaisons.map((c) => [
                  c.tank_id ?? <Dash />,
                  <>{fmtDateTime(c.loliforce.datetime) ?? "—"} · <Num value={c.loliforce.level_l} unit="L" /></>,
                  <>{fmtDateTime(c.scss.datetime) ?? "—"} · <Num value={c.scss.level_l} unit="L" /></>,
                  <Num value={c.ecart_l} unit="L" />,
                  <Num value={c.tolerance_l} unit="L" />,
                  <StatusPill
                    status={c.status}
                    map={{ COHERENT: { label: "Cohérent", tone: "green" }, STOCK_CONFLICT: { label: "Conflit", tone: "red" }, NOT_COMPARABLE: { label: "Non comparable", tone: "slate" } }}
                  />,
                  <Wrap>{c.reason ?? "—"}</Wrap>,
                ])}
              />
            </>
          )}

          {tab === "CUVES" && <TanksPanel siteId={d.site.site_id} tanks={d.cuves} scopes={d.gardiennage} can={can} onChanged={refresh} />}

          {tab === "CORRECTIONS" && (
            <Table
              empty="Aucune correction tracée."
              head={["Date", "Objet", "Action", "Champ", "Ancienne valeur", "Nouvelle valeur", "Motif", "Auteur"]}
              rows={d.corrections.map((c) => [
                fmtDateTime(c.created_at, true) ?? "—",
                `${c.entity} #${c.entity_id}`,
                c.action,
                c.field ?? "—",
                <Wrap>{c.old_value ?? "∅"}</Wrap>,
                <Wrap>{c.new_value ?? "∅"}</Wrap>,
                <Wrap>{c.reason}</Wrap>,
                c.author ?? "—",
              ])}
            />
          )}
        </div>
      )}

      {explain && d && <ConversionExplanation o={explain} tanks={d.cuves} onClose={() => setExplain(null)} />}
      {pending && (
        <ReasonDialog
          title={`${pending.decision === "valider" ? "Valider" : "Rejeter"} le ${pending.label}`}
          confirmLabel={pending.decision === "valider" ? "Valider" : "Rejeter"}
          tone={pending.decision === "valider" ? "green" : "red"}
          onClose={() => setPending(null)}
          onConfirm={async (reason) => {
            if (pending.kind === "obs") await decideStockObservation(pending.id, pending.decision, reason);
            else await decideStockMovement(pending.id, pending.decision, reason);
            refresh();
          }}
        />
      )}
    </Modal>
  );
}

function RetainedSummary({ d }: { d: StockSiteHistoryData }) {
  const r = d.retenu;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
      <Info label="Stock retenu">
        {r?.stock_l !== null && r?.stock_l !== undefined ? <Num value={r.stock_l} unit="L" /> : <span style={{ color: FT.orange, fontWeight: 700 }}>Indisponible</span>}
      </Info>
      <Info label="Source · date">{r?.source_type ? `${SOURCE_LABEL[r.source_type]} · ${fmtDateTime(r.observation_datetime) ?? "—"} (${ageLabel(r.age_hours) ?? "—"})` : "—"}</Info>
      <Info label="Méthode">{r?.conversion_method ? METHOD_LABEL[r.conversion_method] : "—"}</Info>
      <Info label="Capacité · remplissage">
        {r?.capacity_l ? `${r.capacity_l.toLocaleString("fr-FR")} L · ${r.fill_pct ?? "—"} %` : "Capacité non validée"}
      </Info>
      <Info label="Snowflake (technique)">
        {d.snowflake_technique?.stock_l !== null && d.snowflake_technique?.stock_l !== undefined
          ? `${d.snowflake_technique.stock_l.toLocaleString("fr-FR")} L · ${fmtDateTime(d.snowflake_technique.date) ?? "—"}`
          : "—"}
        <div style={{ fontSize: 10.5, color: FT.textSub, fontWeight: 500 }}>Jamais retenu comme stock</div>
      </Info>
      {r?.unavailable_reason && (
        <div style={{ gridColumn: "1 / -1", fontSize: 12, color: FT.orange, background: FT.orangeL, borderRadius: 8, padding: "8px 10px" }}>
          {r.unavailable_reason}
        </div>
      )}
    </div>
  );
}

function TanksPanel({
  siteId,
  tanks,
  scopes,
  can,
  onChanged,
}: {
  siteId: string;
  tanks: StockTank[];
  scopes: Array<{ id: number; provider: string; active_from: string; active_to: string | null; comment: string | null }>;
  can: boolean;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<StockTank | "new" | null>(null);
  const [scopeOpen, setScopeOpen] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Note>
        Conversion cm → L uniquement avec une cuve <b>validée</b> : abaque validé, sinon géométrie (dimensions validées). Aucun coefficient générique.
        Toute correction est tracée et reconvertit les relevés du site.
      </Note>
      <Table
        empty="Aucune cuve référencée pour ce site : les relevés en cm ne peuvent pas être convertis."
        head={["Cuve", "Statut", "Famille", "Cotes (cm)", "Fonds", "Capacité de plaque", "Géométrie pleine", "k / écart", "Modèle", "Source", "Motif", "Actions"]}
        rows={tanks.map((t) => [
          t.tank_id,
          <StatusPill status={t.validation_status} />,
          t.shape_family ? FAMILY_LABEL[t.shape_family] : <Dash reason="Forme manquante" />,
          t.shape_family ? FAMILY_DIMS[t.shape_family].map((lbl, i) => (lbl ? `${lbl.split(" · ")[0]} ${[t.dimension_1_cm, t.dimension_2_cm, t.dimension_3_cm][i] ?? "?"}` : null)).filter(Boolean).join(" · ") : "—",
          `${PROFILE_LABEL[t.bottom_profile ?? "plat"] ?? t.bottom_profile}${t.bottom_z_cm ? ` (Z ${t.bottom_z_cm})` : ""}`,
          t.capacity_plate_l ? <span title={t.capacity_plate_source ?? undefined}><Num value={t.capacity_plate_l} unit="L" /></span> : <Dash reason={t.capacity_l ? `Capacité déclarée ${t.capacity_l} L (non plaque)` : "Inconnue"} />,
          <Num value={t.geometric_capacity_l} unit="L" reason="Géométrie non reconnue" />,
          t.calibration_k ? <span style={{ color: t.plate_coherent ? FT.green : FT.orange, fontWeight: 700 }}>{t.calibration_k.toFixed(3)} / {t.plate_gap_pct} %</span> : <Dash />,
          t.tank_model_id ? <span title={t.tank_model_label ?? undefined}>{t.tank_model_id} <StatusPill status={t.model_match_status} /></span> : <Dash />,
          <Wrap>{[t.source_type, t.source_file, t.source_row ? `ligne ${t.source_row}` : null].filter(Boolean).join(" · ")}</Wrap>,
          <Wrap>{t.validation_reason ?? "—"}</Wrap>,
          can ? (
            <button type="button" onClick={() => setEditing(t)} style={actionBtn("violet")}>
              Corriger / valider
            </button>
          ) : <Dash reason="Réservé aux rôles admin et manager" />,
        ])}
      />
      {can && (
        <div>
          <button type="button" onClick={() => setEditing("new")} style={actionBtn("blue")}>
            + Ajouter une cuve
          </button>
        </div>
      )}

      <div style={{ fontSize: 13, fontWeight: 800, color: FT.text, marginTop: 6 }}>Périmètre de gardiennage</div>
      <Table
        empty="Périmètre non configuré : les relevés Loliforce / SCSS de ce site restent « à valider » (aucun site n'est supposé Loliforce par défaut)."
        head={["Prestataire", "Du", "Au", "Commentaire"]}
        rows={scopes.map((s) => [s.provider, fmtDateTime(s.active_from) ?? "—", fmtDateTime(s.active_to) ?? "en cours", s.comment ?? "—"])}
      />
      {can && (
        <div>
          <button type="button" onClick={() => setScopeOpen(true)} style={actionBtn("blue")}>
            + Affecter un prestataire
          </button>
        </div>
      )}

      {editing && <TankEditor siteId={siteId} tank={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={onChanged} />}
      {scopeOpen && <ScopeEditor siteId={siteId} onClose={() => setScopeOpen(false)} onSaved={onChanged} />}
    </div>
  );
}

function numOrNull(v: string) {
  const t = v.trim().replace(",", ".");
  return t === "" ? null : Number(t);
}

function TankEditor({ siteId, tank, onClose, onSaved }: { siteId: string; tank: StockTank | null; onClose: () => void; onSaved: () => void }) {
  const [tankId, setTankId] = useState(tank?.tank_id ?? "");
  const [family, setFamily] = useState<string>(tank?.shape_family ?? "");
  const [dims, setDims] = useState({
    d1: tank?.dimension_1_cm?.toString() ?? "",
    d2: tank?.dimension_2_cm?.toString() ?? "",
    d3: tank?.dimension_3_cm?.toString() ?? "",
    bz: tank?.bottom_z_cm?.toString() ?? "",
    plate: tank?.capacity_plate_l?.toString() ?? "",
  });
  const [bottom, setBottom] = useState(tank?.bottom_profile ?? "plat");
  const [plateSource, setPlateSource] = useState(tank?.capacity_plate_source ?? "");
  const [proof, setProof] = useState(tank?.proof_reference ?? "");
  const [comment, setComment] = useState(tank?.comment ?? "");
  const [modelAction, setModelAction] = useState<"" | "CONFIRMED" | "REJECTED">("");
  const [validate, setValidate] = useState<"" | "true" | "false">("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const labels = family ? FAMILY_DIMS[family] : [null, null, null];
  const m = useMutation({
    mutationFn: async () => {
      if (!reason.trim()) throw new Error("Le motif est obligatoire.");
      const body: TankPatch = {
        shape_family: (family || null) as StockTank["shape_family"],
        dimension_1_cm: numOrNull(dims.d1),
        dimension_2_cm: labels[1] ? numOrNull(dims.d2) : null,
        dimension_3_cm: labels[2] ? numOrNull(dims.d3) : null,
        bottom_profile: bottom,
        bottom_z_cm: numOrNull(dims.bz),
        capacity_plate_l: numOrNull(dims.plate),
        capacity_plate_source: plateSource || null,
        proof_reference: proof || null,
        comment: comment || null,
        reason: reason.trim(),
        ...(modelAction ? { model_match_status: modelAction } : {}),
        ...(validate ? { validate: validate === "true" } : {}),
      };
      if (tank) return patchStockTank(tank.id, body);
      if (!tankId.trim()) throw new Error("Identifiant de cuve obligatoire (jamais attribué automatiquement).");
      return createStockTank({ ...body, site_id: siteId, tank_id: tankId.trim() });
    },
    onSuccess: () => {
      onSaved();
      onClose();
    },
    onError: (e: unknown) => {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? (e as Error).message ?? "Enregistrement impossible.");
    },
  });
  return (
    <Modal title={tank ? `Cuve ${tank.tank_id} — correction / validation` : "Nouvelle cuve"} onClose={onClose} maxWidth={640}>
      <Note>
        Cotes intérieures en cm, selon la famille du calculateur. La capacité de plaque sert au volume calibré (écart ≤ 5 % avec la géométrie) ;
        sans plaque confirmée, le volume géométrique reste une valeur technique. Chaque modification est tracée.
      </Note>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
        {!tank && (
          <Field label="Identifiant de cuve (1, 2…)">
            <input value={tankId} onChange={(e) => setTankId(e.target.value)} style={inputStyle} />
          </Field>
        )}
        <Field label="Famille de cuve">
          <select value={family} onChange={(e) => setFamily(e.target.value)} style={inputStyle}>
            <option value="">—</option>
            {Object.entries(FAMILY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        {labels.map((lbl, i) => lbl && (
          <Field key={lbl} label={`${lbl} (cm)`}>
            <input inputMode="decimal" value={[dims.d1, dims.d2, dims.d3][i]} onChange={(e) => setDims({ ...dims, [["d1", "d2", "d3"][i]]: e.target.value })} style={inputStyle} />
          </Field>
        ))}
        <Field label="Profil des fonds">
          <select value={bottom} onChange={(e) => setBottom(e.target.value)} style={inputStyle}>
            {Object.entries(PROFILE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Flèche Z du fond (cm)">
          <input inputMode="decimal" value={dims.bz} onChange={(e) => setDims({ ...dims, bz: e.target.value })} style={inputStyle} />
        </Field>
        <Field label="Capacité de plaque (L)">
          <input inputMode="decimal" value={dims.plate} onChange={(e) => setDims({ ...dims, plate: e.target.value })} style={inputStyle} />
        </Field>
        <Field label="Source de la capacité de plaque">
          <input value={plateSource} onChange={(e) => setPlateSource(e.target.value)} placeholder="Plaque lue sur site, photo…" style={inputStyle} />
        </Field>
        <Field label="Preuve (référence / lien photo)">
          <input value={proof} onChange={(e) => setProof(e.target.value)} style={inputStyle} />
        </Field>
        {tank?.tank_model_id && tank.model_match_status === "PROPOSED" && (
          <Field label={`Modèle proposé ${tank.tank_model_id}`}>
            <select value={modelAction} onChange={(e) => setModelAction(e.target.value as "" | "CONFIRMED" | "REJECTED")} style={inputStyle}>
              <option value="">Laisser proposé</option>
              <option value="CONFIRMED">Confirmer (géométrie + plaque du modèle)</option>
              <option value="REJECTED">Écarter le modèle</option>
            </select>
          </Field>
        )}
        <Field label="Validation">
          <select value={validate} onChange={(e) => setValidate(e.target.value as "" | "true" | "false")} style={inputStyle}>
            <option value="">Inchangée ({tank?.validation_status ?? "nouvelle"})</option>
            <option value="true">Valider la cuve</option>
            <option value="false">Rejeter la cuve</option>
          </select>
        </Field>
      </div>
      <div style={{ marginTop: 10 }}>
        <Field label="Commentaire">
          <input value={comment} onChange={(e) => setComment(e.target.value)} style={inputStyle} />
        </Field>
      </div>
      <div style={{ marginTop: 10 }}>
        <Field label="Motif (obligatoire, tracé)">
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} style={{ ...inputStyle, height: "auto", padding: 8 }} />
        </Field>
      </div>
      {error && <div role="alert" style={{ color: FT.red, fontSize: 12, marginTop: 8 }}>{error}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
        <button type="button" onClick={onClose} style={actionBtn("slate")}>Annuler</button>
        <button type="button" onClick={() => { setError(null); m.mutate(); }} disabled={m.isPending} style={actionBtn("violet", m.isPending)}>
          {m.isPending ? "…" : "Enregistrer"}
        </button>
      </div>
    </Modal>
  );
}

function ScopeEditor({ siteId, onClose, onSaved }: { siteId: string; onClose: () => void; onSaved: () => void }) {
  const [provider, setProvider] = useState<"LOLIFORCE" | "SCSS">("LOLIFORCE");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  return (
    <ReasonDialog
      title={`Gardiennage — ${siteId}`}
      confirmLabel="Enregistrer"
      description={
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <Field label="Prestataire">
            <select value={provider} onChange={(e) => setProvider(e.target.value as "LOLIFORCE" | "SCSS")} style={inputStyle}>
              <option value="LOLIFORCE">Loliforce</option>
              <option value="SCSS">SCSS</option>
            </select>
          </Field>
          <Field label="Du">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Au (optionnel)">
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={inputStyle} />
          </Field>
        </div>
      }
      onClose={onClose}
      onConfirm={async (reason) => {
        await createGuardScope({ site_id: siteId, provider, active_from: from, active_to: to || undefined, reason });
        onSaved();
      }}
    />
  );
}

function Table({ head, rows, empty }: { head: string[]; rows: ReactNode[][]; empty: string }) {
  if (!rows.length) return <EmptyState icon={<span aria-hidden>∅</span>} title={empty} />;
  return (
    <div style={{ overflow: "auto", maxHeight: 420, borderRadius: 10, border: `1px solid ${FT.border}` }}>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ background: i % 2 ? FT.cardAlt : "#fff" }}>
              {r.map((c, j) => (
                <td key={j} style={tdStyle}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Wrap({ children }: { children: ReactNode }) {
  return <div style={{ whiteSpace: "normal", minWidth: 180, maxWidth: 320, textAlign: "left", fontSize: 11.5, color: FT.textMid }}>{children}</div>;
}

function Note({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 12, color: FT.textMid, background: FT.blueL, borderRadius: 8, padding: "8px 11px", lineHeight: 1.5 }}>{children}</div>;
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ border: `1px solid ${FT.border}`, borderRadius: 9, padding: "9px 11px", background: FT.cardAlt }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: FT.textSub, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: FT.text }}>{children}</div>
    </div>
  );
}

function ProofLink({ value }: { value: string }) {
  const first = value.split(",")[0].trim();
  if (/^https?:\/\//.test(first)) {
    return (
      <a href={first} target="_blank" rel="noreferrer" style={{ color: FT.blue, fontWeight: 700 }}>
        Voir
      </a>
    );
  }
  return <span title={value}>{value.length > 18 ? `${value.slice(0, 18)}…` : value}</span>;
}


function rawLevel(o: StockObservation) {
  if (!o.level_raw) return <Dash />;
  const unit = o.level_unit === "CM" ? "cm" : o.level_unit === "L" ? "L" : "";
  const txt = /[a-z]/i.test(o.level_raw) || !unit ? o.level_raw : `${o.level_raw} ${unit}`;
  return o.level_cm !== null && o.level_unit === "L" ? `${txt} (+ ${o.level_cm} cm)` : txt;
}

/** Explication pas à pas d'une conversion : niveau brut → cuve → géométrie → calibration → contrôle → statut. */
function ConversionExplanation({ o, tanks, onClose }: { o: StockObservation; tanks: StockTank[]; onClose: () => void }) {
  const t = tanks.find((x) => x.tank_id === o.tank_id) ?? (tanks.length === 1 ? tanks[0] : undefined);
  const dims = t?.shape_family ? FAMILY_DIMS[t.shape_family] : null;
  const steps: Array<[string, ReactNode]> = [
    ["Relevé source", <>{SOURCE_LABEL[o.source_type] ?? o.source_type} du {fmtDateTime(o.observation_datetime, true)} — {o.source_reference ?? "—"}</>],
    ["Niveau brut / unité", <>{rawLevel(o)} — unité {o.level_unit ?? "inconnue"}{o.declared_liters !== null && o.level_unit === "L" ? " (litres déclarés : valeur brute conservée)" : ""}</>],
    ["Cuve du site", t ? (
      <>
        Cuve {t.tank_id} — <StatusPill status={t.validation_status} /> {FAMILY_LABEL[t.shape_family ?? ""] ?? "forme inconnue"}
        {dims && ` — ${dims.map((lbl, i) => (lbl ? `${lbl.split(" · ")[0]} ${[t.dimension_1_cm, t.dimension_2_cm, t.dimension_3_cm][i] ?? "?"} cm` : null)).filter(Boolean).join(", ")}`}
        {t.bottom_profile && ` — fonds ${PROFILE_LABEL[t.bottom_profile] ?? t.bottom_profile}${t.bottom_z_cm ? ` (Z ${t.bottom_z_cm} cm)` : ""}`}
        {t.tank_model_id && ` — modèle ${t.tank_model_id} (${t.model_match_status === "CONFIRMED" ? "confirmé" : "proposé"})`}
      </>
    ) : "Aucune cuve validée pour ce site : conversion cm → L interdite."],
    ["Volume géométrique", o.volume_geometric_l !== null ? <><Num value={o.volume_geometric_l} unit="L" digits={1} /> — calculateur universel (cotes mesurées, valeur physique)</> : "—"],
    ["Capacité de plaque", t?.capacity_plate_l ? <><Num value={t.capacity_plate_l} unit="L" /> ({t.capacity_plate_source ?? "source non précisée"}) — géométrie pleine <Num value={t.geometric_capacity_l} unit="L" />, k = {t.calibration_k?.toFixed(4) ?? "—"}, écart {t.plate_gap_pct ?? "—"} % {t.plate_coherent ? "(cohérent ≤ 5 %)" : "(incohérent > 5 %)"}</> : "Non confirmée : le volume géométrique reste une valeur technique."],
    ["Volume calibré", o.volume_calibrated_l !== null ? <><Num value={o.volume_calibrated_l} unit="L" digits={1} /> = géométrique × k</> : "—"],
    ["Volume retenu", o.level_liters !== null ? <strong><Num value={o.level_liters} unit="L" digits={1} /></strong> : <span style={{ color: FT.orange }}>Aucun (NULL, jamais 0)</span>],
    ["Contrôle de capacité", o.capacity_l ? <>capacité {o.capacity_l.toLocaleString("fr-FR")} L — remplissage {o.fill_pct ?? "—"} %</> : "Impossible (capacité inconnue)"],
    ["Écart cm / litres déclarés", o.cm_liters_gap_l !== null ? <Num value={o.cm_liters_gap_l} unit="L" digits={1} /> : "—"],
    ["Règle appliquée", o.conversion_rule ?? o.conversion_message ?? "—"],
    ["Statut", <><StatusPill status={o.statut_releve} /> {o.validation_reason}</>],
  ];
  return (
    <Modal title={`Conversion du relevé #${o.id} — ${o.source_type}`} onClose={onClose} maxWidth={760}>
      <ol style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 8 }}>
        {steps.map(([label, value]) => (
          <li key={label} style={{ fontSize: 12.5, color: FT.text, lineHeight: 1.5 }}>
            <span style={{ fontWeight: 800, color: FT.textMid }}>{label} : </span>{value}
          </li>
        ))}
      </ol>
      {o.issues.length > 0 && (
        <div style={{ marginTop: 12, background: FT.orangeL, borderRadius: 8, padding: "8px 10px", fontSize: 12.5 }}>
          {o.issues.map((x) => <div key={x.code}><b>{x.anomalie}</b> — règle : {x.regle}. <b>Action : {x.action}.</b></div>)}
        </div>
      )}
    </Modal>
  );
}
