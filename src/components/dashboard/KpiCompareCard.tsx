import { useMemo, useState } from "react";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Scatter, ReferenceLine } from "recharts";
import ChartCard from "./ChartCard";
import TogglePill from "./TogglePill";
import { compareRows } from "@/data/demo/dashboard";
import { CAMUSAT } from "@/theme/camusat";


type Mode = "timeline" | "correlation";
const money = (v:number): string => v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}M CFA` : `${Math.round(v/1000)}k CFA`;


export default function KpiCompareCard(){
    const [mode, setMode] = useState<Mode>("timeline");
    const [show, setShow] = useState({ real:true, est:true, solar:true });


    const points = useMemo(()=> compareRows.map(r => ({ sx: r.solar_pct, sy: (r.redev_real - r.redev_est)/1_000_000 })), []);
    const reg = useMemo(()=>{
    const xs = points.map(p=>p.sx), ys = points.map(p=>p.sy);
        const xbar = xs.reduce((a,b)=>a+b,0)/xs.length; const ybar = ys.reduce((a,b)=>a+b,0)/ys.length;
        const cov = xs.reduce((acc, x, i) => acc + (x - xbar)*(ys[i] - ybar), 0);
        const varx = xs.reduce((acc, x) => acc + (x - xbar)**2, 0) || 1;
        const slope = cov/varx; const intercept = ybar - slope*xbar;
        return { slope, intercept };
    }, [points]);
    const regLine = useMemo(()=> [{ sx: 0, sy: reg.intercept }, { sx: 100, sy: reg.intercept + reg.slope*100 }], [reg]);
    return (
        <ChartCard
            title="Solar vs Redevance"
            subtitle={mode === "timeline" ? "Évolution mensuelle – % Solaire vs Redevance (réel/estimation)" : "Corrélation – % Solaire vs Δ Redevance (réel - est.)"}
            actions={
            <div className="flex items-center gap-2">
            <TogglePill label="Timeline" active={mode==='timeline'} onClick={()=>setMode('timeline')} />
            <TogglePill label="Correlation" active={mode==='correlation'} onClick={()=>setMode('correlation')} />
            </div>
        }>
            {mode === 'timeline' ? (
                <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={compareRows} margin={{ left:8, right:16, top:8 }} barCategoryGap="28%" barGap={6}>
                            <CartesianGrid vertical={false} stroke={CAMUSAT.border} />
                            <XAxis dataKey="m" tick={{ fill: CAMUSAT.sub, fontSize:12 }} tickLine={false} axisLine={{ stroke: CAMUSAT.border }} />
                            <YAxis yAxisId="pct" orientation="left" tickFormatter={(v:number)=>`${v}%`} tick={{ fill: CAMUSAT.sub, fontSize:12 }} tickLine={false} axisLine={{ stroke: CAMUSAT.border }} />
                            <YAxis yAxisId="money" orientation="right" tickFormatter={(v:number)=>money(v)} tick={{ fill: CAMUSAT.sub, fontSize:12 }} tickLine={false} axisLine={{ stroke: CAMUSAT.border }} />
                            <Tooltip contentStyle={{ background: CAMUSAT.card, border: `1px solid ${CAMUSAT.border}`, borderRadius:12 }} labelStyle={{ color: CAMUSAT.text }}
                            formatter={(v:any, n:any, p:any)=>{
                                if(n==='solar_pct') return [`${v}%`, 'Solaire'];
                                if(n==='redev_real') return [money(Number(v)), 'Redevance (réel)'];
                                if(n==='redev_est') return [money(Number(v)), 'Estimation Senelec'];
                                return [v, n];
                            }} />
                            {show.real && <Bar yAxisId="money" dataKey="redev_real" name="Redevance (réel)" fill={CAMUSAT.gridBar} barSize={14} radius={[6,6,0,0]} />}
                            {show.est && <Bar yAxisId="money" dataKey="redev_est" name="Estimation Senelec" fill={CAMUSAT.efmsLine} barSize={14} radius={[6,6,0,0]} />}
                            {show.solar && <Line yAxisId="pct" type="monotone" dataKey="solar_pct" name="% Solaire" stroke={CAMUSAT.targetLine} strokeWidth={2} dot={{ r:2 }} />}
                        </ComposedChart>
                    </ResponsiveContainer>
                    <div className="flex gap-2 mt-2">
                        <TogglePill label="Réel" active={show.real} onClick={()=>setShow(s=>({...s, real:!s.real}))} />
                        <TogglePill label="Estimation" active={show.est} onClick={()=>setShow(s=>({...s, est:!s.est}))} />
                        <TogglePill label="Solaire %" active={show.solar} onClick={()=>setShow(s=>({...s, solar:!s.solar}))} />
                    </div>
                </div>
            ) : (
                <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart margin={{ left:8, right:16, top:8 }}>
                            <CartesianGrid vertical={false} stroke={CAMUSAT.border} />
                            <XAxis type="number" dataKey="sx" domain={[0,100]} name="% Solaire" tickFormatter={(v:number)=>`${v}%`} tick={{ fill: CAMUSAT.sub, fontSize:12 }} />
                            <YAxis type="number" dataKey="sy" name="Δ Redevance (M CFA)" tickFormatter={(v:number)=>`${v.toFixed(1)}M`} tick={{ fill: CAMUSAT.sub, fontSize:12 }} />
                            <Tooltip contentStyle={{ background: CAMUSAT.card, border: `1px solid ${CAMUSAT.border}`, borderRadius:12 }} labelStyle={{ color: CAMUSAT.text }}
                            formatter={(v:any, n:any)=> [n.includes('Redevance')?`${v.toFixed(1)}M`:`${v}%`, n]} />
                            <ReferenceLine x={0} stroke={CAMUSAT.border} />
                            <ReferenceLine y={0} stroke={CAMUSAT.border} />
                            <Scatter data={points} fill={CAMUSAT.blue} name="Mois" />
                            <Line data={regLine} dataKey="sy" name="Tendance" stroke={CAMUSAT.targetLine} dot={false} />
                        </ComposedChart>
                    </ResponsiveContainer>
                    <div className="text-xs mt-2" style={{ color: CAMUSAT.sub }}>
                         Chaque point = un mois • Axe X : % solaire • Axe Y : Δ redevance (réel - estimation) en **millions** CFA. La ligne montre la tendance.
                    </div>
                </div>
            )}
        </ChartCard>
    );
}