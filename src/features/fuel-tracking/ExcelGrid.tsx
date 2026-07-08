// src/features/fuel-tracking/ExcelGrid.tsx
//
// Grille façon Excel : en-têtes de groupe fusionnés (comme les cellules
// fusionnées du fichier source), colonne(s) figée(s) à gauche pendant le
// scroll horizontal, en-têtes collants pendant le scroll vertical.
//
// Construit avec CSS Grid (pas de <table>) pour garder un contrôle total
// sur le "freeze pane" horizontal — chaque ligne (en-tête ou donnée) utilise
// le même gridTemplateColumns, donc tout reste parfaitement aligné.

import { useMemo, type CSSProperties, type ReactNode } from "react";
import { FT, GROUP_PALETTE } from "./theme";
import { EmptyState, Skeleton } from "./ui";

export type ExcelColumn<T> = {
  id: string;
  header: string;
  width: number;
  align?: "left" | "right" | "center";
  render: (row: T, rowIndex: number) => ReactNode;
  emphasis?: boolean;
};

export type ExcelGroup<T> = {
  id: string;
  label: string;
  color: keyof typeof GROUP_PALETTE;
  columns: ExcelColumn<T>[];
};

type Segment = {
  key: string;
  label: string;
  color: keyof typeof GROUP_PALETTE;
  colStart: number; // 1-based, grid-column
  span: number;
  pinned: boolean;
};

function buildGroupSegments<T>(groups: ExcelGroup<T>[], pinnedCount: number): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0; // 0-based flat column index

  for (const g of groups) {
    const start = cursor;
    const end = cursor + g.columns.length; // exclusive
    cursor = end;

    if (start >= pinnedCount) {
      segments.push({ key: `${g.id}-main`, label: g.label, color: g.color, colStart: start + 1, span: end - start, pinned: false });
      continue;
    }

    if (end <= pinnedCount) {
      // Groupe entièrement figé : pas de label (colonne trop étroite, cf. Site ID).
      segments.push({ key: `${g.id}-pin`, label: "", color: g.color, colStart: start + 1, span: end - start, pinned: true });
      continue;
    }

    // Le groupe chevauche la frontière figée : on le scinde en deux segments.
    segments.push({ key: `${g.id}-pin`, label: "", color: g.color, colStart: start + 1, span: pinnedCount - start, pinned: true });
    segments.push({ key: `${g.id}-main`, label: g.label, color: g.color, colStart: pinnedCount + 1, span: end - pinnedCount, pinned: false });
  }

  return segments;
}

const GROUP_ROW_H = 30;
const HEAD_ROW_H = 38;
const ROW_H = 40;

export function ExcelGrid<T>({
  groups,
  rows,
  rowKey,
  loading,
  emptyIcon,
  emptyTitle = "Aucune donnée",
  emptySubtitle,
  pinnedCount = 1,
  maxHeight = 560,
  showGroupHeader = true,
}: {
  groups: ExcelGroup<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  loading?: boolean;
  emptyIcon?: ReactNode;
  emptyTitle?: string;
  emptySubtitle?: string;
  pinnedCount?: number;
  maxHeight?: number;
  showGroupHeader?: boolean;
}) {
  const flatColumns = useMemo(() => groups.flatMap((g) => g.columns), [groups]);
  const totalWidth = useMemo(() => flatColumns.reduce((s, c) => s + c.width, 0), [flatColumns]);
  const gridTemplate = useMemo(() => flatColumns.map((c) => `${c.width}px`).join(" "), [flatColumns]);

  const offsets = useMemo(() => {
    const o: number[] = [];
    let acc = 0;
    flatColumns.forEach((c, i) => {
      o[i] = acc;
      acc += c.width;
    });
    return o;
  }, [flatColumns]);

  const segments = useMemo(() => buildGroupSegments(groups, pinnedCount), [groups, pinnedCount]);
  const headerTop = showGroupHeader ? GROUP_ROW_H : 0;

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} h={40} />
        ))}
      </div>
    );
  }

  return (
    <div
      className="ft-scroll"
      style={{
        overflow: "auto",
        maxHeight,
        border: `1px solid ${FT.border}`,
        borderRadius: 12,
        position: "relative",
        background: FT.card,
      }}
    >
      <div style={{ minWidth: totalWidth, width: "max-content" }}>
        {showGroupHeader && (
          <div style={{ display: "grid", gridTemplateColumns: gridTemplate, position: "sticky", top: 0, zIndex: 5, height: GROUP_ROW_H }}>
            {segments.map((seg) => {
              const c = GROUP_PALETTE[seg.color];
              const style: CSSProperties = {
                gridColumn: `${seg.colStart} / span ${seg.span}`,
                background: c.bg,
                color: c.fg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: ".06em",
                borderBottom: `1px solid ${FT.border}`,
                borderRight: `1px solid rgba(255,255,255,.6)`,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                padding: "0 6px",
              };
              if (seg.pinned) {
                style.position = "sticky";
                style.left = offsets[seg.colStart - 1];
                style.zIndex = 6;
              }
              return (
                <div key={seg.key} style={style}>
                  {seg.label}
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: gridTemplate, position: "sticky", top: headerTop, zIndex: 5, height: HEAD_ROW_H }}>
          {flatColumns.map((col, i) => {
            const pinned = i < pinnedCount;
            const style: CSSProperties = {
              display: "flex",
              alignItems: "center",
              justifyContent: col.align === "right" ? "flex-end" : col.align === "center" ? "center" : "flex-start",
              padding: "0 10px",
              background: FT.slateL,
              color: FT.text,
              fontSize: 11,
              fontWeight: 800,
              borderBottom: `1px solid ${FT.borderStrong}`,
              borderRight: `1px solid ${FT.border}`,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            };
            if (pinned) {
              style.position = "sticky";
              style.left = offsets[i];
              style.zIndex = 6;
              style.boxShadow = i === pinnedCount - 1 ? "3px 0 8px -3px rgba(15,23,42,.18)" : undefined;
            }
            return (
              <div key={col.id} style={style} title={col.header}>
                {col.header}
              </div>
            );
          })}
        </div>

        {rows.length === 0 ? (
          <div style={{ gridColumn: "1 / -1", minWidth: totalWidth }}>
            <EmptyState icon={emptyIcon} title={emptyTitle} subtitle={emptySubtitle} />
          </div>
        ) : (
          rows.map((row, ri) => {
            const zebra = ri % 2 === 0 ? FT.card : FT.cardAlt;
            return (
              <div
                key={rowKey(row, ri)}
                className="ft-row"
                style={{ display: "grid", gridTemplateColumns: gridTemplate, height: ROW_H }}
              >
                {flatColumns.map((col, ci) => {
                  const pinned = ci < pinnedCount;
                  const style: CSSProperties = {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: col.align === "right" ? "flex-end" : col.align === "center" ? "center" : "flex-start",
                    padding: "0 10px",
                    fontSize: 12.5,
                    color: col.emphasis ? FT.text : FT.textMid,
                    fontWeight: col.emphasis ? 800 : 500,
                    borderBottom: `1px solid ${FT.border}`,
                    borderRight: `1px solid ${FT.border}`,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    background: zebra,
                  };
                  if (pinned) {
                    style.position = "sticky";
                    style.left = offsets[ci];
                    style.zIndex = 2;
                    style.boxShadow = ci === pinnedCount - 1 ? "3px 0 8px -3px rgba(15,23,42,.12)" : undefined;
                  }
                  return (
                    <div key={col.id} style={style}>
                      {col.render(row, ri)}
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
