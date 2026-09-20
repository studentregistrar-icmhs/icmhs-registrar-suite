const C = { ink: "#122A28", bg: "#EEF1EA", line: "#D9DFD3", slate: "#54625D" };

export default function Loading() {
  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: C.bg, color: C.ink, padding: "40px 32px", minHeight: "100vh", boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div style={pulse({ width: 200, height: 14 })} />
        <div style={pulse({ width: 140, height: 32, borderRadius: 6 })} />
      </div>
      <div style={{ ...pulse({ width: 320, height: 28 }), marginTop: 10 }} />
      <div style={{ ...pulse({ width: 220, height: 14 }), marginTop: 10, marginBottom: 24 }} />
      <div style={{ display: "flex", gap: 16, marginBottom: 28 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={pulse({ width: 140, height: 30, borderRadius: 6 })} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ ...pulse({ width: 260, height: 200, borderRadius: 10 }) }} />
        ))}
      </div>
    </div>
  );
}

function pulse(size: { width: number; height: number; borderRadius?: number }): React.CSSProperties {
  return {
    width: size.width,
    height: size.height,
    borderRadius: size.borderRadius ?? 4,
    background: `linear-gradient(90deg, ${C.line} 25%, #E4E9DC 37%, ${C.line} 63%)`,
    backgroundSize: "400% 100%",
    animation: "icmhs-pulse 1.4s ease infinite",
  };
}
