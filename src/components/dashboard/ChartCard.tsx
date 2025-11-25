import React from "react";
import { CAMUSAT } from "@/theme/camusat";
export default function ChartCard({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode; }) {
    return (
    <div className="rounded-2xl p-5 shadow-sm border" style={{ background: CAMUSAT.card, borderColor: CAMUSAT.border }}>
        <div className="flex items-center justify-between mb-4">
            <div>
                <h3 className="text-base font-semibold" style={{ color: CAMUSAT.primary }}>{title}</h3>
                {subtitle && <p className="text-xs" style={{ color: CAMUSAT.sub }}>{subtitle}</p>}
            </div>
                {actions}
            </div>
        {children}
    </div>
);
}