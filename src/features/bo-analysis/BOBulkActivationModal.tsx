// src/features/bo-analysis/BOBulkActivationModal.tsx
// Active une demande d'analyse BO sur plusieurs sites sélectionnés en une fois
// (ex: tous les sites en marge NOK/critique d'une période filtrée).

import { useState } from "react";
import type { CSSProperties } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, ClipboardList, Loader2, Send, X } from "lucide-react";
import { createBORequestsBulk, fetchBOUsers } from "./api";

const C = {
  blue: { 950: "#0B1F4D", 900: "#0F235A", 800: "#123C8C", 700: "#1A56C4", 600: "#2464D6", 300: "#91B9F8", 100: "#E4EFFE", 50: "#F2F6FE" },
  slate: { 900: "#0F172A", 700: "#334155", 600: "#475569", 500: "#64748B", 400: "#94A3B8", 200: "#E2E8F0", 100: "#F1F5F9", 50: "#F8FAFC" },
  ok: { main: "#059669", light: "#D1FAE5", mid: "#A7F3D0", dark: "#065F46" },
  nok: { main: "#DC2626", light: "#FEE2E2", mid: "#FECACA", dark: "#991B1B" },
};

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

export interface BOBulkItem {
  site_id: string;
  site_name?: string | null;
  year: number;
  month: number;
}

export default function BOBulkActivationModal({
  items, onClose, onSuccess,
}: {
  items: BOBulkItem[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [targetedBos, setTargetedBos] = useState<number[]>([]);
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<{ created: number; errors: number } | null>(null);

  const { data: boUsers } = useQuery({ queryKey: ["bo-users"], queryFn: fetchBOUsers });

  const mut = useMutation({
    mutationFn: () =>
      createBORequestsBulk({
        items: items.map((i) => ({ site_id: i.site_id, year: i.year, month: i.month })),
        targeted_bos: targetedBos,
        notes,
      }),
    onSuccess: (res) => setResult({ created: res.created, errors: res.errors.length }),
  });

  function toggleBo(id: number) {
    setTargetedBos((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const inputStyle: CSSProperties = { width: "100%", borderRadius: 12, border: `1px solid ${C.slate[200]}`, background: "#fff", padding: "9px 12px", fontSize: 13, color: C.slate[700], outline: "none" };
  const labelStyle: CSSProperties = { fontSize: 11.5, fontWeight: 900, color: C.slate[600], textTransform: "uppercase", letterSpacing: ".03em", marginBottom: 6, display: "block" };

  return (
    <div onClick={(e) => e.currentTarget === e.target && !mut.isPending && onClose()} style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(2,6,23,.62)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "min(560px,100%)", maxHeight: "88vh", overflowY: "auto", background: "#fff", borderRadius: 24, boxShadow: "0 30px 90px rgba(2,6,23,.28)", padding: 26 }}>
        {!result ? (
          <>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 950, color: C.blue[950], display: "flex", alignItems: "center", gap: 8 }}>
                  <ClipboardList size={18} color={C.blue[700]} /> Activer une analyse BO en masse
                </div>
                <div style={{ fontSize: 12.5, color: C.slate[500], marginTop: 4 }}>
                  {items.length} site{items.length > 1 ? "s" : ""} sélectionné{items.length > 1 ? "s" : ""}
                </div>
              </div>
              {!mut.isPending ? (
                <button type="button" onClick={onClose} style={{ width: 30, height: 30, borderRadius: 10, border: "none", background: C.slate[100], color: C.slate[500], cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={15} /></button>
              ) : null}
            </div>

            <div style={{ maxHeight: 130, overflowY: "auto", border: `1px solid ${C.slate[200]}`, borderRadius: 12, marginBottom: 16 }}>
              {items.map((it, i) => (
                <div key={`${it.site_id}-${it.year}-${it.month}`} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "7px 12px", fontSize: 12, borderBottom: i < items.length - 1 ? `1px solid ${C.slate[100]}` : "none", background: i % 2 ? C.slate[50] : "#fff" }}>
                  <span style={{ fontWeight: 800, color: C.blue[900], fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{it.site_id}</span>
                  <span style={{ color: C.slate[500] }}>{it.site_name || "—"}</span>
                  <span style={{ color: C.slate[400] }}>{MONTHS[it.month - 1]} {it.year}</span>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <label style={labelStyle}>Destinataires</label>
                <div style={{ border: `1px solid ${C.slate[200]}`, borderRadius: 12, background: "#fff", maxHeight: 160, overflowY: "auto" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", fontSize: 12.5, fontWeight: 800, color: C.slate[700], cursor: "pointer", borderBottom: `1px solid ${C.slate[100]}` }}>
                    <input type="checkbox" checked={targetedBos.length === 0} onChange={() => setTargetedBos([])} />
                    Tous les BO
                  </label>
                  {(boUsers || []).map((u) => (
                    <label key={u.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", fontSize: 12.5, color: C.slate[700], cursor: "pointer" }}>
                      <input type="checkbox" checked={targetedBos.includes(u.id)} onChange={() => toggleBo(u.id)} />
                      {u.username}
                    </label>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: C.slate[400], marginTop: 5 }}>
                  {targetedBos.length === 0 ? "Diffusion à tous les BO actifs (1 notification groupée)." : `Restreint à ${targetedBos.length} BO sélectionné(s).`}
                </div>
              </div>

              <div>
                <label style={labelStyle}>Notes / contexte</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Contexte commun à ces sites…" style={{ ...inputStyle, resize: "vertical" }} />
              </div>
            </div>

            {mut.isError ? (
              <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 13, background: C.nok.light, border: `1px solid ${C.nok.mid}`, color: C.nok.dark, fontSize: 12, fontWeight: 800 }}>
                ⚠ {(mut.error as any)?.response?.data?.detail || "Erreur lors de la création des demandes."}
              </div>
            ) : null}

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button type="button" onClick={onClose} disabled={mut.isPending} style={{ flex: 1, padding: "10px 0", borderRadius: 13, border: `1px solid ${C.slate[200]}`, background: "#fff", color: C.slate[700], fontWeight: 900, cursor: "pointer" }}>Annuler</button>
              <button
                type="button"
                disabled={mut.isPending}
                onClick={() => mut.mutate()}
                style={{ flex: 2, padding: "10px 0", borderRadius: 13, border: "none", background: `linear-gradient(135deg, ${C.blue[800]}, ${C.blue[600]})`, color: "#fff", fontWeight: 950, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}
              >
                {mut.isPending ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={15} />}
                {mut.isPending ? "Envoi…" : `Envoyer ${items.length} demande${items.length > 1 ? "s" : ""}`}
              </button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <CheckCircle2 size={42} color={C.ok.main} style={{ marginBottom: 10 }} />
            <div style={{ fontSize: 16, fontWeight: 950, color: C.slate[900], marginBottom: 6 }}>Demandes envoyées</div>
            <div style={{ fontSize: 13, color: C.slate[600], marginBottom: 18 }}>
              {result.created} demande{result.created > 1 ? "s" : ""} créée{result.created > 1 ? "s" : ""}
              {result.errors > 0 ? ` · ${result.errors} erreur(s)` : ""}
            </div>
            <button
              type="button"
              onClick={onSuccess}
              style={{ width: "100%", padding: "10px 0", border: "none", borderRadius: 13, background: C.blue[800], color: "#fff", fontWeight: 950, cursor: "pointer" }}
            >
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
