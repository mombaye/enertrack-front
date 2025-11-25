import React from "react";
import { useSearchParams } from "react-router-dom";
import EnergyPage from "@/pages/EnergyPage";
import SiteEnergyPage from "@/pages/SiteEnergyPage";

function TabButton({
  active,
  onClick,
  children,
}: React.PropsWithChildren<{ active: boolean; onClick: () => void }>) {
  return (
    <button
      onClick={onClick}
      className={[
        "rounded-xl px-3 py-1.5 text-sm transition-colors",
        active ? "bg-blue-900 text-white" : "bg-white text-blue-900 ring-1 ring-slate-200 hover:bg-slate-50",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export default function EnergyTabsPage() {
  const [sp, setSp] = useSearchParams();
  const tab = sp.get("tab") === "sites" ? "sites" : "global";
  const setTab = (t: "global" | "sites") => {
    sp.set("tab", t);
    setSp(sp, { replace: true });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">Énergie</h1>
        <div className="flex items-center gap-2">
          <TabButton active={tab === "global"} onClick={() => setTab("global")}>
            Vue globale
          </TabButton>
          <TabButton active={tab === "sites"} onClick={() => setTab("sites")}>
            Sites energy
          </TabButton>
        </div>
      </div>

      {tab === "global" ? <EnergyPage /> : <SiteEnergyPage />}
    </div>
  );
}
