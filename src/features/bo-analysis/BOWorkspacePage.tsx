// src/features/bo-analysis/BOWorkspacePage.tsx
// Espace de travail du Back Office : liste des demandes assignées + pool non assigné,
// formulaire de saisie de l'analyse (catégorie, commentaire, action owner, check).

import { useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ClipboardList,
  Clock,
  Loader2,
  RefreshCw,
  Send,
  User,
  X,
} from "lucide-react";
import {
  ACTION_OWNER_OPTIONS,
  CATEGORIE_BO_OPTIONS,
  fetchBORequests,
  submitBOAnalysis,
  type ActionOwnerValue,
  type BOAnalysisRequest,
  type CategorieBOValue,
} from "./api";

// ─── Design tokens (mêmes valeurs que le reste du module financier) ────────────

const C = {
  blue: { 950: "#010E2A", 900: "#021A40", 800: "#032566", 700: "#0A3D96", 600: "#1A56C4", 500: "#3272E0", 300: "#91B9F8", 100: "#E4EFFE", 50: "#F2F6FE" },
  slate: { 950: "#020617", 900: "#0F172A", 800: "#1E293B", 700: "#334155", 600: "#475569", 500: "#64748B", 400: "#94A3B8", 300: "#CBD5E1", 200: "#E2E8F0", 100: "#F1F5F9", 50: "#F8FAFC" },
  ok: { main: "#059669", light: "#D1FAE5", mid: "#A7F3D0", dark: "#065F46" },
  nok: { main: "#DC2626", light: "#FEE2E2", mid: "#FECACA", dark: "#991B1B" },
  warn: { main: "#D97706", light: "#FEF3C7", mid: "#FDE68A", dark: "#92400E" },
  purple: { main: "#7C3AED", light: "#EDE9FE", dark: "#5B21B6" },
};

const PAGE_BG = "linear-gradient(180deg,#F8FAFC 0%,#EEF4FF 100%)";
const HDR = "linear-gradient(135deg,#010E2A 0%,#032566 55%,#0A3D96 100%)";
const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "blue" | "ok" | "nok" | "warn" | "purple" }) {
  const map = {
    slate: { bg: C.slate[100], color: C.slate[700], border: C.slate[200] },
    blue: { bg: C.blue[100], color: C.blue[700], border: "#BFDBFE" },
    ok: { bg: C.ok.light, color: C.ok.dark, border: C.ok.mid },
    nok: { bg: C.nok.light, color: C.nok.dark, border: C.nok.mid },
    warn: { bg: C.warn.light, color: C.warn.dark, border: C.warn.mid },
    purple: { bg: C.purple.light, color: C.purple.dark, border: "#DDD6FE" },
  }[tone];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 9px", borderRadius: 999, border: `1px solid ${map.border}`, background: map.bg, color: map.color, fontSize: 10.5, fontWeight: 900, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ background: "rgba(255,255,255,.94)", border: `1px solid ${C.slate[200]}`, borderRadius: 20, boxShadow: "0 18px 45px rgba(15,23,42,.07)", overflow: "hidden", ...style }}>{children}</div>;
}

function StatusBadge({ status }: { status: BOAnalysisRequest["status"] }) {
  if (status === "done") return <Badge tone="ok"><CheckCircle2 size={12} /> Terminée</Badge>;
  if (status === "in_progress") return <Badge tone="warn"><Clock size={12} /> En cours</Badge>;
  return <Badge tone="blue"><ClipboardList size={12} /> En attente</Badge>;
}

// ─── Formulaire de soumission ───────────────────────────────────────────────────

function SubmitForm({ req, onClose, onSubmitted }: { req: BOAnalysisRequest; onClose: () => void; onSubmitted: () => void }) {
  const [categorieBo, setCategorieBo] = useState<CategorieBOValue | "">("");
  const [categorieAutre, setCategorieAutre] = useState("");
  const [commentaireBo, setCommentaireBo] = useState("");
  const [actionOwner, setActionOwner] = useState<ActionOwnerValue | "">("");
  const [actionOwnerAutre, setActionOwnerAutre] = useState("");
  const [commentaire, setCommentaire] = useState("");
  const [checkDone, setCheckDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: () =>
      submitBOAnalysis(req.id, {
        categorie_bo: categorieBo as CategorieBOValue,
        categorie_bo_autre: categorieBo === "autre" ? categorieAutre : "",
        commentaire_bo: commentaireBo,
        action_owner: actionOwner as ActionOwnerValue,
        action_owner_autre: actionOwner === "autre" ? actionOwnerAutre : "",
        commentaire,
        check_done: checkDone,
      }),
    onSuccess: () => onSubmitted(),
    onError: (e: any) => setError(e?.response?.data?.detail || e?.message || "Erreur lors de la soumission."),
  });

  function submit() {
    setError(null);
    if (!categorieBo || !actionOwner) {
      setError("Catégorie BO et Action Owner sont requis.");
      return;
    }
    mut.mutate();
  }

  const inputStyle: CSSProperties = { width: "100%", borderRadius: 12, border: `1px solid ${C.slate[200]}`, background: "#fff", padding: "9px 12px", fontSize: 13, color: C.slate[700], outline: "none" };
  const labelStyle: CSSProperties = { fontSize: 11.5, fontWeight: 900, color: C.slate[600], textTransform: "uppercase", letterSpacing: ".03em", marginBottom: 6, display: "block" };

  return (
    <div onClick={(e) => e.currentTarget === e.target && onClose()} style={{ position: "fixed", inset: 0, zIndex: 700, background: "rgba(2,6,23,.62)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "min(560px,100%)", maxHeight: "90vh", overflow: "auto", background: "#fff", borderRadius: 24, boxShadow: "0 30px 90px rgba(2,6,23,.28)", padding: 26 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 950, color: C.blue[950] }}>Analyse BO — {req.site_id}</div>
            <div style={{ fontSize: 12.5, color: C.slate[500], marginTop: 4 }}>{MONTHS[req.month - 1]} {req.year} · {req.site_name}</div>
          </div>
          <button type="button" onClick={onClose} style={{ width: 30, height: 30, borderRadius: 10, border: "none", background: C.slate[100], color: C.slate[500], cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={15} /></button>
        </div>

        {req.notes ? (
          <div style={{ padding: "10px 12px", borderRadius: 13, background: C.blue[50], border: `1px solid ${C.blue[100]}`, color: C.blue[800], fontSize: 12.5, marginBottom: 16 }}>
            <strong>Contexte :</strong> {req.notes}
          </div>
        ) : null}

        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <label style={labelStyle}>Catégorie BO *</label>
            <select value={categorieBo} onChange={(e) => setCategorieBo(e.target.value as CategorieBOValue)} style={inputStyle}>
              <option value="">— Sélectionner —</option>
              {CATEGORIE_BO_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {categorieBo === "autre" ? (
              <input value={categorieAutre} onChange={(e) => setCategorieAutre(e.target.value)} placeholder="Précisez…" style={{ ...inputStyle, marginTop: 8 }} />
            ) : null}
          </div>

          <div>
            <label style={labelStyle}>Commentaire BO</label>
            <textarea value={commentaireBo} onChange={(e) => setCommentaireBo(e.target.value)} rows={3} placeholder="Diagnostic / cause identifiée…" style={{ ...inputStyle, resize: "vertical" }} />
          </div>

          <div>
            <label style={labelStyle}>Action Owner *</label>
            <select value={actionOwner} onChange={(e) => setActionOwner(e.target.value as ActionOwnerValue)} style={inputStyle}>
              <option value="">— Sélectionner —</option>
              {ACTION_OWNER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {actionOwner === "autre" ? (
              <input value={actionOwnerAutre} onChange={(e) => setActionOwnerAutre(e.target.value)} placeholder="Précisez…" style={{ ...inputStyle, marginTop: 8 }} />
            ) : null}
          </div>

          <div>
            <label style={labelStyle}>Commentaire (action corrective)</label>
            <textarea value={commentaire} onChange={(e) => setCommentaire(e.target.value)} rows={2} placeholder="Détail de l'action / équipement…" style={{ ...inputStyle, resize: "vertical" }} />
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 800, color: C.slate[700], cursor: "pointer" }}>
            <input type="checkbox" checked={checkDone} onChange={(e) => setCheckDone(e.target.checked)} />
            Analyse vérifiée / clôturée
          </label>
        </div>

        {error ? <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 13, background: C.nok.light, border: `1px solid ${C.nok.mid}`, color: C.nok.dark, fontSize: 12, fontWeight: 800 }}>⚠ {error}</div> : null}

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button type="button" onClick={onClose} disabled={mut.isPending} style={{ flex: 1, padding: "10px 0", borderRadius: 13, border: `1px solid ${C.slate[200]}`, background: "#fff", color: C.slate[700], fontWeight: 900, cursor: "pointer" }}>Annuler</button>
          <button type="button" onClick={submit} disabled={mut.isPending} style={{ flex: 2, padding: "10px 0", borderRadius: 13, border: "none", background: C.blue[800], color: "#fff", fontWeight: 950, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
            {mut.isPending ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={15} />}
            {mut.isPending ? "Envoi…" : "Enregistrer l'analyse"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page principale ────────────────────────────────────────────────────────────

export default function BOWorkspacePage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<"" | "pending" | "in_progress" | "done">("");
  const [activeReq, setActiveReq] = useState<BOAnalysisRequest | null>(null);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["bo-requests", statusFilter],
    queryFn: () => fetchBORequests({ status: statusFilter || undefined, page_size: 100 }),
  });

  const requests = data?.results ?? [];

  const counts = useMemo(() => {
    const all = requests;
    return {
      pending: all.filter((r) => r.status === "pending").length,
      in_progress: all.filter((r) => r.status === "in_progress").length,
      done: all.filter((r) => r.status === "done").length,
    };
  }, [requests]);

  function handleSubmitted() {
    setActiveReq(null);
    qc.invalidateQueries({ queryKey: ["bo-requests"] });
  }

  const iconButtonStyle: CSSProperties = { height: 38, borderRadius: 12, border: "none", display: "inline-flex", alignItems: "center", gap: 7, padding: "0 12px", fontSize: 12, fontWeight: 950, cursor: "pointer" };

  return (
    <div style={{ minHeight: "100vh", background: PAGE_BG, color: C.slate[800] }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ background: HDR, color: "#fff", padding: "22px 24px 18px", boxShadow: "0 18px 45px rgba(1,14,42,.24)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 9px", background: "rgba(255,255,255,.10)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 999, fontSize: 11, fontWeight: 950, color: "rgba(255,255,255,.72)" }}>
              <ClipboardList size={13} /> Espace Back Office
            </div>
            <h1 style={{ margin: "12px 0 4px", fontSize: 27, lineHeight: 1.1, letterSpacing: "-.04em", fontWeight: 950 }}>Analyses BO à traiter</h1>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,.62)", maxWidth: 700 }}>Vos demandes assignées et le pool de demandes en attente d'un BO.</div>
          </div>
          <button type="button" onClick={() => refetch()} style={{ ...iconButtonStyle, background: "rgba(255,255,255,.12)", color: "#fff", border: "1px solid rgba(255,255,255,.18)" }}>
            <RefreshCw size={14} className={isFetching ? "spin" : ""} /> Actualiser
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(140px,1fr))", gap: 12, marginTop: 18, maxWidth: 560 }}>
          {[
            { label: "En attente", value: counts.pending, color: C.blue[300] },
            { label: "En cours", value: counts.in_progress, color: C.warn.main },
            { label: "Terminées", value: counts.done, color: C.ok.main },
          ].map((k) => (
            <div key={k.label} style={{ borderRadius: 16, background: "rgba(255,255,255,.09)", border: "1px solid rgba(255,255,255,.14)", padding: "12px 14px" }}>
              <div style={{ fontSize: 10, fontWeight: 950, color: "rgba(255,255,255,.55)", textTransform: "uppercase", letterSpacing: ".06em" }}>{k.label}</div>
              <div style={{ fontSize: 22, fontWeight: 950, color: k.color, marginTop: 4 }}>{k.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: 22, display: "grid", gap: 16 }}>
        <Card>
          <div style={{ padding: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(["", "pending", "in_progress", "done"] as const).map((s) => (
              <button
                key={s || "all"}
                type="button"
                onClick={() => setStatusFilter(s)}
                style={{
                  ...iconButtonStyle,
                  background: statusFilter === s ? C.blue[800] : "#fff",
                  color: statusFilter === s ? "#fff" : C.slate[600],
                  border: `1px solid ${statusFilter === s ? C.blue[800] : C.slate[200]}`,
                }}
              >
                {s === "" ? "Toutes" : s === "pending" ? "En attente" : s === "in_progress" ? "En cours" : "Terminées"}
              </button>
            ))}
          </div>
        </Card>

        <Card>
          {isLoading ? (
            <div style={{ padding: 54, textAlign: "center", color: C.slate[500] }}>
              <Loader2 size={26} style={{ animation: "spin 1s linear infinite", marginBottom: 10 }} />
              <div>Chargement…</div>
            </div>
          ) : requests.length === 0 ? (
            <div style={{ padding: 54, textAlign: "center", color: C.slate[500] }}>
              <div style={{ width: 54, height: 54, borderRadius: 18, background: C.slate[100], margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center", color: C.slate[400] }}>
                <ClipboardList size={22} />
              </div>
              <div style={{ color: C.slate[700], fontSize: 15, fontWeight: 950 }}>Aucune demande</div>
              <div style={{ fontSize: 12, marginTop: 5 }}>Rien à traiter pour ce filtre pour le moment.</div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: C.slate[50] }}>
                    {["Site", "Période", "Statut", "Demandé par", "Date", ""].map((h, i) => (
                      <th key={i} style={{ padding: "12px 14px", textAlign: "left", fontSize: 11, fontWeight: 900, color: C.slate[500], textTransform: "uppercase", letterSpacing: ".03em", borderBottom: `1px solid ${C.slate[100]}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id} style={{ borderBottom: `1px solid ${C.slate[100]}` }}>
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ fontSize: 13, fontWeight: 900, color: C.blue[950] }}>{r.site_id}</div>
                        <div style={{ fontSize: 11, color: C.slate[400] }}>{r.site_name}</div>
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 12.5, fontWeight: 700 }}>{MONTHS[r.month - 1]} {r.year}</td>
                      <td style={{ padding: "12px 14px" }}><StatusBadge status={r.status} /></td>
                      <td style={{ padding: "12px 14px", fontSize: 12, color: C.slate[600] }}><User size={11} style={{ marginRight: 4, verticalAlign: -1 }} />{r.requested_by_username}</td>
                      <td style={{ padding: "12px 14px", fontSize: 11.5, color: C.slate[400] }}>{new Date(r.requested_at).toLocaleDateString("fr-FR")}</td>
                      <td style={{ padding: "12px 14px", textAlign: "right" }}>
                        {r.status !== "done" ? (
                          <button type="button" onClick={() => setActiveReq(r)} style={{ ...iconButtonStyle, background: C.blue[50], color: C.blue[700], border: `1px solid ${C.blue[100]}` }}>
                            <ClipboardList size={13} /> Remplir
                          </button>
                        ) : (
                          <Badge tone="ok"><CheckCircle2 size={12} /> Soumise</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {activeReq ? (
        <SubmitForm req={activeReq} onClose={() => setActiveReq(null)} onSubmitted={handleSubmitted} />
      ) : null}
    </div>
  );
}
