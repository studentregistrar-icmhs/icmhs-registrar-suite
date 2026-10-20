"use client";

import React from "react";
import type { IntakeMatrix } from "@/lib/intakeMatrix";

const C = {
  ink: "#122A28", bg: "#EEF1EA", line: "#D9DFD3", teal: "#0F7268", slate: "#54625D", grey: "#B8C0B6",
  deptBg: "#DDE8DA", subBg: "#F0F4EC",
};

const fmt = (n: number) => n.toLocaleString("en-US");

// Sticky first two columns so course names stay visible while scrolling
// across the (potentially 20+) intake columns.
const CODE_W = 74;
const NAME_W = 280;

const cell = (n: number, bold = false): React.ReactElement => (
  <span style={{ color: n === 0 ? C.grey : bold ? C.ink : C.slate, fontWeight: bold ? 700 : 400 }}>{fmt(n)}</span>
);

export default function IntakeMatrixTable({ matrix }: { matrix: IntakeMatrix }) {
  const { columns, groups, grandCounts, grandTotal } = matrix;
  const span = 2 + columns.length + 1;

  return (
    <div style={{ overflow: "auto", maxHeight: 640, border: `1px solid ${C.line}`, borderRadius: 8 }}>
      <table style={{ borderCollapse: "separate", borderSpacing: 0, fontSize: 12, minWidth: "100%" }}>
        <thead>
          <tr>
            <th style={{ ...th, ...stickyCode, textAlign: "left", zIndex: 5, verticalAlign: "bottom" }}>Code</th>
            <th style={{ ...th, ...stickyName, textAlign: "left", zIndex: 5, verticalAlign: "bottom" }}>Course</th>
            {columns.map((c) => (
              <th key={c.key} style={{ ...th, width: 34, minWidth: 34, padding: "8px 2px", height: 96 }}>
                <div style={rotated}>{c.label}</div>
              </th>
            ))}
            <th style={{ ...th, textAlign: "right", verticalAlign: "bottom", minWidth: 56, borderLeft: `2px solid ${C.ink}` }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <React.Fragment key={g.department}>
              <tr>
                <td colSpan={span} style={deptRow}>{g.department.toUpperCase()}</td>
              </tr>
              {g.rows.map((r) => (
                <tr key={r.code}>
                  <td style={{ ...td, ...stickyCode, color: C.teal, fontFamily: "IBM Plex Mono, monospace", fontWeight: 600 }}>{r.code}</td>
                  <td style={{ ...td, ...stickyName, color: C.ink }} title={r.name}>{r.name}</td>
                  {columns.map((c) => (
                    <td key={c.key} style={numTd}>{cell(r.counts[c.key] ?? 0)}</td>
                  ))}
                  <td style={{ ...numTd, borderLeft: `2px solid ${C.ink}`, fontWeight: 700, color: C.ink }}>{fmt(r.total)}</td>
                </tr>
              ))}
              <tr>
                <td style={{ ...td, ...stickyCode, background: C.subBg }} />
                <td style={{ ...td, ...stickyName, background: C.subBg, fontWeight: 700, color: C.ink }}>SUB-TOTAL</td>
                {columns.map((c) => (
                  <td key={c.key} style={{ ...numTd, background: C.subBg }}>{cell(g.counts[c.key] ?? 0, true)}</td>
                ))}
                <td style={{ ...numTd, background: C.subBg, borderLeft: `2px solid ${C.ink}`, fontWeight: 700, color: C.ink }}>{fmt(g.total)}</td>
              </tr>
            </React.Fragment>
          ))}
          <tr>
            <td style={{ ...td, ...stickyCode, background: C.ink, borderTop: `2px solid ${C.ink}` }} />
            <td style={{ ...td, ...stickyName, background: C.ink, color: "#fff", fontWeight: 700, borderTop: `2px solid ${C.ink}` }}>GRAND TOTAL</td>
            {columns.map((c) => (
              <td key={c.key} style={{ ...numTd, background: C.ink, color: "#fff", fontWeight: 700, borderTop: `2px solid ${C.ink}` }}>
                {fmt(grandCounts[c.key] ?? 0)}
              </td>
            ))}
            <td style={{ ...numTd, background: C.ink, color: "#fff", fontWeight: 700, borderTop: `2px solid ${C.ink}`, borderLeft: `2px solid ${C.ink}` }}>{fmt(grandTotal)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const th: React.CSSProperties = {
  position: "sticky", top: 0, background: "#fff", zIndex: 3,
  fontFamily: "IBM Plex Mono, monospace", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.03em",
  padding: "8px 10px", borderBottom: `2px solid ${C.ink}`, color: C.ink, whiteSpace: "nowrap",
};
const rotated: React.CSSProperties = { writingMode: "vertical-rl", transform: "rotate(180deg)", margin: "0 auto", whiteSpace: "nowrap" };
const stickyCode: React.CSSProperties = { position: "sticky", left: 0, background: "#fff", zIndex: 2, minWidth: CODE_W, width: CODE_W };
const stickyName: React.CSSProperties = {
  position: "sticky", left: CODE_W, background: "#fff", zIndex: 2, minWidth: NAME_W, width: NAME_W, maxWidth: NAME_W,
  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", borderRight: `1px solid ${C.line}`,
};
const td: React.CSSProperties = { padding: "5px 10px", borderBottom: `1px solid ${C.line}` };
const numTd: React.CSSProperties = { ...td, textAlign: "center", fontFamily: "IBM Plex Mono, monospace", padding: "5px 2px" };
const deptRow: React.CSSProperties = {
  background: C.deptBg, color: C.ink, fontWeight: 700, fontSize: 11, letterSpacing: "0.05em",
  padding: "6px 10px", borderBottom: `1px solid ${C.line}`, position: "sticky", left: 0,
};
