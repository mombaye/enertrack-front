
import { CAMUSAT } from "@/theme/camusat";
import KpiCompareCard from "@/components/dashboard/KpiCompareCard";
import SiteKpiCard from "@/components/dashboard/SiteKpiCard";
import GridConsumptionCard from "@/components/dashboard/GridConsumptionCard";
import SolarCard from "@/components/dashboard/SolarCard";
import EnergyEfficiencyCard from "@/components/dashboard/EnergyEfficiencyCard";
export default function DashboardPage(){
    return (
        <div className="min-h-screen bg-gradient-to-b" style={{ backgroundImage: `linear-gradient(to bottom, ${CAMUSAT.bgFrom}, ${CAMUSAT.bgTo})` }}>
            <div className="mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 max-w-[1600px]">
            <div>
                <h1 className="text-3xl font-bold" style={{ color: CAMUSAT.primary }}>Energy Dashboard</h1>
                <p className="text-sm" style={{ color: CAMUSAT.sub }}>Demo – graphiques modernes et interactifs</p>
            </div>
            {/* Grille optimisée 24" : 4 colonnes en xl */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
                <div className="xl:col-span-1"><SiteKpiCard /></div>
                <div className="xl:col-span-3"><GridConsumptionCard /></div>
                <div className="xl:col-span-2"><SolarCard /></div>
                <div className="xl:col-span-2"><EnergyEfficiencyCard /></div>
                <div className="xl:col-span-4"><KpiCompareCard /></div>
            </div>
        </div>
    </div>
);
}