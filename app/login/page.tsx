"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const C = {
  ink: "#122A28", bg: "#EEF1EA", card: "#FFFFFF", line: "#D9DFD3",
  teal: "#0F7268", rose: "#B0432E", slate: "#54625D",
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.reason || "Couldn't log in.");
        return;
      }
      router.push(json.mustResetPassword ? "/change-password" : next);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={styles.page}>
      <form onSubmit={submit} style={styles.card}>
        <div style={styles.eyebrow}>ICMHS</div>
        <h1 style={styles.h1}>Registrar Suite</h1>
        <p style={styles.sub}>Sign in with your registrar account.</p>

        <label style={styles.label}>Username</label>
        <input
          style={styles.input}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
          autoComplete="username"
        />

        <label style={styles.label}>Password</label>
        <input
          type="password"
          style={styles.input}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />

        {error && <p style={styles.error}>{error}</p>}

        <button type="submit" style={styles.submitBtn} disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <p style={styles.footnote}>
          Forgotten your password? Ask an admin to reset it for you.
        </p>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { fontFamily: "Inter, sans-serif", background: C.bg, color: C.ink, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, boxSizing: "border-box" },
  card: { background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "32px 28px", width: "100%", maxWidth: 360, boxShadow: "0 10px 30px rgba(18,42,40,0.08)" },
  eyebrow: { fontFamily: "IBM Plex Mono, monospace", fontSize: 12, color: C.teal, fontWeight: 600, letterSpacing: 1 },
  h1: { fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 24, margin: "4px 0 4px" },
  sub: { fontSize: 13, color: C.slate, margin: "0 0 20px" },
  label: { display: "block", fontSize: 12, color: C.slate, fontWeight: 600, marginBottom: 4, marginTop: 12 },
  input: { width: "100%", boxSizing: "border-box", border: `1px solid ${C.line}`, borderRadius: 7, padding: "9px 10px", fontSize: 14 },
  error: { color: C.rose, fontSize: 13, marginTop: 12, marginBottom: 0 },
  submitBtn: { width: "100%", marginTop: 20, border: "none", background: C.ink, color: "#fff", borderRadius: 7, padding: "11px 0", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  footnote: { fontSize: 12, color: C.slate, textAlign: "center", marginTop: 16, marginBottom: 0 },
};
