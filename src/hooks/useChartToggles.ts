import { useState, useCallback } from "react";
export type SeriesMap<K extends string> = Record<K, boolean>;
export function useChartToggles<K extends string>(initial: SeriesMap<K>) {
    const [visible, setVisible] = useState<SeriesMap<K>>(initial);
    const toggle = useCallback((key: K) => 
        setVisible(v => ({ ...v, [key]: !v[key] })), 
    []);
    const isolate = useCallback((key: K) => {
        setVisible(v => Object.fromEntries(Object.keys(v).map(k => [k, k === key])) as SeriesMap<K>);
    }, []);
    const showAll = useCallback(() => 
        setVisible(v => Object.fromEntries(Object.keys(v).map(k => [k, true])) as SeriesMap<K>), 
    []);
    return { 
        visible, toggle, isolate, showAll 
    };
}