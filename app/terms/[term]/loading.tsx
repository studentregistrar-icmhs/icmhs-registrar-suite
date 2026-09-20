const C = { ink: "#122A28", bg: "#EEF1EA", line: "#D9DFD3" };

export default function Loading() {
  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: C.bg, color: C.ink, padding: "32px", minHeight: "100vh", boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <div style={pulse({ width: 120, height: 12 })} />
          <div style={{ ...pulse({ width: 280, height: 30 }), marginTop: 8 }} />
        </div>
        <div style={pulse({ width: 220, height: 36, borderRadius: 8 })} />
      </div>
      <div style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} style={pulse({ width: 130, height: 76, borderRadius: 8 })} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <div style={pulse({ width: 420, height: 280, borderRadius: 10 })} />
        <div style={pulse({ width: 320, height: 280, borderRadius: 10 })} />
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
