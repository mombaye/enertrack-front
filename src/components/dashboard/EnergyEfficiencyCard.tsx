import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import ChartCard from "./ChartCard";
import { energyRows } from "@/data/demo/dashboard";
const C4 = { grid: "#60A5FA", solar: "#22C55E", dg: "#94A3B8", sub: "#9EB1C7", text: "#E6EEF6" } as const;
export default function EnergyEfficiencyCard(){
    const target = [ { name: "Grid", value: 72, color: C4.grid }, { name: "Solar", value: 28, color: C4.solar } ];
    return (
        <ChartCard title="Energy Efficiency" subtitle="Répartition mensuelle (Grid / Solar / DG)">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="h-72 lg:col-span-2">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={energyRows} stackOffset="expand" margin={{ left:8, right:16, top:8 }}>
                            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                            <XAxis dataKey="m" tick={{ fill: C4.sub, fontSize:12 }} tickLine={false} axisLine={{ stroke:"rgba(255,255,255,0.1)" }} />
                            <YAxis tickFormatter={(v:number)=>`${Math.round(v*100)}%`} tick={{ fill: C4.sub, fontSize:12 }} tickLine={false} axisLine={{ stroke:"rgba(255,255,255,0.1)" }} />
                            <Tooltip formatter={(val:any, name:string)=>[`${val}%`, name]} contentStyle={{ background: "#121A23", border: "1px solid rgba(255,255,255,0.06)", borderRadius:12 }} labelStyle={{ color: C4.text }} />
                            <Bar dataKey="solar" stackId="a" name="Solar" fill={C4.solar} radius={[6,6,0,0]} />
                            <Bar dataKey="grid" stackId="a" name="Grid" fill={C4.grid} radius={[6,6,0,0]} />
                            <Bar dataKey="dg" stackId="a" name="DG" fill={C4.dg} radius={[6,6,0,0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div className="relative flex items-center justify-center">
                    <PieChart width={190} height={190}>
                        <Pie data={target} dataKey="value" innerRadius={60} outerRadius={85} startAngle={90} endAngle={-270} stroke="none">
                        {target.map((t,i)=>(<Cell key={i} fill={t.color} />))}
                        </Pie>
                    </PieChart>
                    <div className="absolute text-center">
                        <div className="text-sm text-[#9EB1C7]">TARGET ENERGY RATIO</div>
                        <div className="text-lg font-semibold text-[#E6EEF6]">Grid 72% / Solar 28%</div>
                    </div>
                </div>
            </div>
        </ChartCard>
    );
}