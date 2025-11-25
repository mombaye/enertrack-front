import { ResponsiveContainer, AreaChart, Area, Line, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import ChartCard from "./ChartCard";
import { solarRows } from "@/data/demo/dashboard";
import { CAMUSAT } from "@/theme/camusat";
const avgPct = Math.round(solarRows.reduce((a,r)=>a+r.pct,0) / (solarRows.filter(r=>r.pct>0).length || 1));
export default function SolarCard(){
    const pieData = [{ name:"solar", value: avgPct }, { name:"rest", value: 100-avgPct }];
    return (
        <ChartCard title="Solar Consumption Evolution" subtitle="kWh & %">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="h-72 lg:col-span-2">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={solarRows} margin={{ left:8, right:16, top:8 }}>
                            <defs>
                                <linearGradient id="solarGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={CAMUSAT.greenLite} stopOpacity={0.8} />
                                    <stop offset="95%" stopColor={CAMUSAT.greenLite} stopOpacity={0.1} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid vertical={false} stroke={CAMUSAT.border} />
                            <XAxis dataKey="m" tick={{ fill: CAMUSAT.sub, fontSize:12 }} tickLine={false} axisLine={{ stroke: CAMUSAT.border }} />
                            <YAxis yAxisId="kwh" tickFormatter={(v:number)=> (v>=1000?`${(v/1000).toFixed(1)}k`:`${v}`)} tick={{ fill: CAMUSAT.sub, fontSize:12 }} tickLine={false} axisLine={{ stroke: CAMUSAT.border }} />
                            <YAxis yAxisId="pct" orientation="right" tickFormatter={(v:number)=>`${v}%`} tick={{ fill: CAMUSAT.sub, fontSize:12 }} tickLine={false} axisLine={{ stroke: CAMUSAT.border }} />
                            <Tooltip contentStyle={{ background: CAMUSAT.card, border: `1px solid ${CAMUSAT.border}`, borderRadius:12 }} labelStyle={{ color: CAMUSAT.text }}
                            formatter={(v:any, n:string)=>[n==="pct"?`${v}%`:`${v} kWh`, n]} />
                            <Area yAxisId="kwh" type="monotone" dataKey="kwh" name="Solar kWh" stroke={CAMUSAT.greenLite} fill="url(#solarGrad)" />
                            <Line yAxisId="pct" type="monotone" dataKey="pct" name="% Solar" stroke={CAMUSAT.green} strokeWidth={2} dot={{ r:2 }} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
                <div className="relative flex items-center justify-center">
                    <PieChart width={190} height={190}>
                        <Pie data={pieData} dataKey="value" startAngle={90} endAngle={-270} innerRadius={65} outerRadius={85} stroke="none">
                            {pieData.map((_,i)=>(<Cell key={i} fill={i===0?CAMUSAT.greenLite:CAMUSAT.ringTrack} />))}
                        </Pie>
                    </PieChart>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-4xl font-bold" style={{ color: CAMUSAT.text }}>{avgPct}%</span>
                        <span className="text-xs" style={{ color: CAMUSAT.sub }}>AVG. SOLAR</span>
                    </div>
                </div>
            </div>
        </ChartCard>
    );
}