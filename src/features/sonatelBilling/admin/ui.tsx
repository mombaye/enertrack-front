import { cn } from "@/features/sonatelBilling/ui";

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
