import React from "react";
import { ResponsiveContainer, ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";
import ChartCard from "./ChartCard";
import TogglePill from "./TogglePill";
import { useChartToggles } from "@/hooks/useChartToggles";
import { gridRows } from "@/data/demo/dashboard";
import { CAMUSAT } from "@/theme/camusat";

const formatK = (v:number):string => (v>=1000?`${(v/1000).toFixed(v%1000===0?0:1)}k`:`${v}`);


type FocusKey = "senelec" | "efms" | "target" | null;
const THRESHOLD = 4068; // ligne constante horizontale


// Custom shape pour animer l'opacité/blur et ajouter un halo sur la série focus
function makeBarShape(key: Exclude<FocusKey, null>, color: string, focus: FocusKey, onClick: () => void) {
return function BarShape(props: any) {
const { x, y, width, height } = props;
const active = !focus || focus === key;
return (
<g onClick={onClick} style={{ cursor: "pointer" }}>
<rect
x={x}
y={y}
width={width}
height={height}
rx={6}
ry={6}
fill={color}
style={{
opacity: active ? 1 : 0.25,
filter: active ? "drop-shadow(0 4px 10px rgba(30,58,138,.25))" : "grayscale(0.4)",
transition: "opacity 240ms ease, filter 240ms ease",
}}
/>
</g>
);
};
}

export default function GridConsumptionCard(){
    const { visible, toggle, isolate, showAll } = useChartToggles<"senelec"|"efms"|"target">({ senelec:true, efms:true, target:true });
    const [focus, setFocus] = React.useState<FocusKey>(null);


    const data = gridRows.map(r=>({
    month: r.m,
    senelec: r.grid_kwh, // Senelec
    efms: r.efms_kwh,
    target: r.target_kwh,
    }));


    const SenelecShape = makeBarShape("senelec", CAMUSAT.gridBar, focus, () => setFocus(focus === "senelec" ? null : "senelec"));
    const EfmsShape = makeBarShape("efms", CAMUSAT.efmsLine, focus, () => setFocus(focus === "efms" ? null : "efms"));
    const TargetShape = makeBarShape("target", CAMUSAT.targetLine, focus, () => setFocus(focus === "target" ? null : "target"));


    return (
        <ChartCard
            title="Grid Consumption Evolution"
            subtitle="kWh / mois – Senelec vs eFMS vs Target"
            actions={
                <div className="flex gap-2 items-center">
                    <TogglePill label="Senelec" active={visible.senelec} onClick={()=>toggle("senelec")} onIsolate={()=>isolate("senelec")} />
                    <TogglePill label="eFMS" active={visible.efms} onClick={()=>toggle("efms")} onIsolate={()=>isolate("efms")} />
                    <TogglePill label="Target" active={visible.target} onClick={()=>toggle("target")} onIsolate={()=>isolate("target")} />
                    <button onClick={()=>{ setFocus(null); showAll(); }} className="ml-2 text-sm underline" style={{ color: CAMUSAT.primary }}>Reset</button>
                </div>
        }> 
            <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data} margin={{ left: 8, right: 16, top: 8 }} barCategoryGap="28%" barGap={6}>
                        <defs>
                            {/* halo pour la ligne de seuil */}
                            <filter id="lineGlow" x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur stdDeviation="2" result="colored" />
                                <feMerge>
                                    <feMergeNode in="colored" />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>
                        </defs>
                        <CartesianGrid vertical={false} stroke={CAMUSAT.border} />
                        <XAxis dataKey="month" tick={{ fill: CAMUSAT.sub, fontSize: 12 }} tickLine={false} axisLine={{ stroke: CAMUSAT.border }} />
                        <YAxis tickFormatter={formatK} tick={{ fill: CAMUSAT.sub, fontSize: 12 }} tickLine={false} axisLine={{ stroke: CAMUSAT.border }} />
                        <Tooltip contentStyle={{ background: CAMUSAT.card, border: `1px solid ${CAMUSAT.border}`, borderRadius: 12 }} labelStyle={{ color: CAMUSAT.text }}
                                 formatter={(value:any, name:string)=>[`${Number(value).toLocaleString()} kWh`, name]}
                        />


                        {/* Ligne constante de seuil */}
                        <ReferenceLine y={THRESHOLD} stroke={CAMUSAT.targetLine} strokeWidth={2} strokeDasharray="4 3" ifOverflow="extendDomain"
                            label={{ value: `Seuil ${THRESHOLD.toLocaleString()} kWh`, position: "right", fill: CAMUSAT.targetLine, fontSize: 12 }} 
                        />


                        {/* 3 KPI en barres groupées */}
                        {visible.senelec && (
                            <Bar dataKey="senelec" name="Senelec" barSize={14} shape={<SenelecShape />} isAnimationActive animationDuration={500} />
                        )}
                        {visible.efms && (
                            <Bar dataKey="efms" name="eFMS" barSize={14} shape={<EfmsShape />} isAnimationActive animationDuration={500} />
                        )}
                        {visible.target && (
                            <Bar dataKey="target" name="Target" barSize={14} shape={<TargetShape />} isAnimationActive animationDuration={500} />
                        )}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
            <div className="text-xs mt-2" style={{ color: CAMUSAT.sub }}>
                 Clic sur une <b>barre</b> pour <b>mettre en avant</b> un KPI (les autres se grisent + blur). Clic à nouveau ou « Reset » pour revenir à l'affichage complet.
            </div>
        </ChartCard>
    );
}