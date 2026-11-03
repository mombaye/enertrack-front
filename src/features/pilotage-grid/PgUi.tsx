// Éléments d'affichage communs des sections Pilotage Grid.
import type { CSSProperties, ReactNode } from "react";
import { INK, MUTED, RULE } from "./format";

export const card: CSSProperties = { background: "#fff", border: `1px solid ${RULE}`, borderRadius: 12 };

export function Panel({ title, note, children, style }: { title: string; note?: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <section style={{ ...card, padding: "14px 16px", ...style }}>
      <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: INK }}>{title}</h3>
      {note && <p style={{ margin: "4px 0 10px", fontSize: 12, color: MUTED }}>{note}</p>}
      {children}
    </section>
  );
}

export function KpiRow({ items }: { items: Array<[string, string, string]> }) {
  return (
    <div role="group" aria-label="Indicateurs" style={{ ...card, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", overflow: "hidden" }}>
      {items.map(([label, value, sub], i) => (
        <div key={label} style={{ padding: "12px 14px", borderLeft: i === 0 ? "none" : `1px solid ${RULE}`, minWidth: 0 }}>
          <div style={{ fontSize: 11.5, color: MUTED }}>{label}</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: INK, fontVariantNumeric: "tabular-nums", margin: "2px 0" }}>{value}</div>
          <div style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.35 }}>{sub}</div>
        </div>
      ))}
    </div>
  );
}

export function StateBox({ kind, children }: { kind: "loading" | "error" | "empty"; children: ReactNode }) {
  const color = kind === "error" ? "#B0425A" : MUTED;
  return <div role={kind === "error" ? "alert" : "status"} style={{ ...card, padding: 18, color, fontWeight: kind === "error" ? 700 : 500, fontSize: 13 }}>{children}</div>;
}

export const th: CSSProperties = { padding: "7px 10px", fontSize: 11.5, fontWeight: 800, color: MUTED, textAlign: "left", borderBottom: `1px solid ${RULE}`, whiteSpace: "nowrap", background: "#fff", position: "sticky", top: 0 };
export const thn: CSSProperties = { ...th, textAlign: "right" };
export const td: CSSProperties = { padding: "6px 10px", fontSize: 12.5, borderBottom: "1px solid #E4EBE9", whiteSpace: "nowrap" };
export const tdn: CSSProperties = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };

export const smallBtn: CSSProperties = { padding: "5px 10px", borderRadius: 8, border: `1px solid ${RULE}`, background: "#fff", fontSize: 12, fontWeight: 700, color: INK, cursor: "pointer" };
