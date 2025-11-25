import { CAMUSAT } from "@/theme/camusat";
export default function TogglePill({ label, active, onClick, onIsolate }: { label: string; active: boolean; onClick: () => void; onIsolate?: () => void; }) {
    return (
    <button
        onClick={onClick}
        onContextMenu={(e) => { e.preventDefault(); onIsolate?.(); }}
        className={`px-3 py-1 rounded-full text-sm transition-all border`}
        style={{
        background: active ? CAMUSAT.primary : CAMUSAT.primary50,
        color: active ? "#FFFFFF" : CAMUSAT.primary,
        borderColor: active ? CAMUSAT.primary : CAMUSAT.border,
        }}
        title="Clic pour afficher/masquer • Clic droit pour isoler"
        >
        {label}
    </button>
    );
}