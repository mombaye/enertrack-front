import React from "react";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function StatusPill({ v }: { v: "CREATED" | "VALIDATED" | "CONTESTED" }) {
  const map = {
    CREATED: { label: "Créée", cls: "bg-slate-100 text-slate-800 border-slate-200" },
    VALIDATED: { label: "Validée", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
    CONTESTED: { label: "Contestée", cls: "bg-rose-50 text-rose-800 border-rose-200" },
  } as const;
  const m = map[v];
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-semibold border", m.cls)}>
      {m.label}
    </span>
  );
}

export function money(x?: string | null) {
  if (!x) return "—";
  const n = Number(x);
  if (Number.isNaN(n)) return String(x);
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " FCFA";
}

export function num(x?: string | null) {
  if (!x) return "—";
  const n = Number(x);
  if (Number.isNaN(n)) return String(x);
  return n.toLocaleString("fr-FR");
}



export function SeverityPill({ v }: { v: "INFO" | "WARN" | "ERROR" }) {
  const map = {
    INFO: { label: "Info", cls: "bg-slate-50 text-slate-700 border-slate-200" },
    WARN: { label: "Warn", cls: "bg-amber-50 text-amber-800 border-amber-200" },
    ERROR: { label: "Error", cls: "bg-rose-50 text-rose-800 border-rose-200" },
  } as const;
  const m = map[v];
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-semibold border", m.cls)}>
      {m.label}
    </span>
  );
}

