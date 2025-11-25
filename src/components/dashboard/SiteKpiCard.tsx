import { PieChart, Pie, Cell } from "recharts";
import ChartCard from "./ChartCard";
import { siteInfo } from "@/data/demo/dashboard";
import { CAMUSAT } from "@/theme/camusat";
export default function SiteKpiCard() {
    const pct = Math.min(100, Math.round((siteInfo.avgLoad / 10000) * 100));
    const pieData = [ { name: "avg", value: pct }, { name: "rest", value: 100 - pct } ];
    return (
        <ChartCard title={`${siteInfo.id} – ${siteInfo.name}`} subtitle="Site details">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <p className="text-sm" style={{ color: CAMUSAT.sub }}><span className="font-medium" style={{ color: CAMUSAT.text }}>Target Typology:</span> {siteInfo.targetTypo}</p>
                    <p className="text-sm" style={{ color: CAMUSAT.sub }}><span className="font-medium" style={{ color: CAMUSAT.text }}>Actual Typology:</span> {siteInfo.actualTypo}</p>
                    <p className="text-sm" style={{ color: CAMUSAT.sub }}><span className="font-medium" style={{ color: CAMUSAT.text }}>Activation Load:</span> {siteInfo.activationLoad.toLocaleString()} W</p>
                    <p className="text-sm" style={{ color: CAMUSAT.sub }}><span className="font-medium" style={{ color: CAMUSAT.text }}>Avg Load:</span> {siteInfo.avgLoad.toLocaleString()} W</p>
                </div>
                <div className="relative flex items-center justify-center">
                    <PieChart width={190} height={190}>
                        <Pie data={pieData} dataKey="value" startAngle={90} endAngle={-270} innerRadius={65} outerRadius={85} stroke="none">
                            {pieData.map((_, i) => (<Cell key={i} fill={i === 0 ? CAMUSAT.blue : CAMUSAT.ringTrack} />))}
                        </Pie>
                    </PieChart>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-bold" style={{ color: CAMUSAT.text }}>{siteInfo.avgLoad.toLocaleString()} W</span>
                        <span className="text-xs" style={{ color: CAMUSAT.sub }}>Average Load</span>
                    </div>
                </div>
            </div>
        </ChartCard>
    );
}