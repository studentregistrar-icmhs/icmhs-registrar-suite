"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const C = {
  ink: "#122A28", bg: "#EEF1EA", card: "#FFFFFF", line: "#D9DFD3",
  teal: "#0F7268", rose: "#B0432E", slate: "#54625D",
};

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("New passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.reason || "Couldn't change password.");
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={styles.page}>
      <form onSubmit={submit} style={styles.card}>
        <div style={styles.eyebrow}>ICMHS</div>
        <h1 style={styles.h1}>Set your password</h1>
        <p style={styles.sub}>
          You're signing in with a temporary password. Choose a new one before continuing —
          this only takes a moment.
        </p>

        <label style={styles.label}>Temporary (current) password</label>
        <input
          type="password"
          style={styles.input}
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoFocus
          autoComplete="current-password"
        />

        <label style={styles.label}>New password</label>
        <input
          type="password"
          style={styles.input}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          placeholder="At least 8 characters"
        />

        <label style={styles.label}>Confirm new password</label>
        <input
          type="password"
          style={styles.input}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
        />

        {error && <p style={styles.error}>{error}</p>}

        <button type="submit" style={styles.submitBtn} disabled={busy}>
          {busy ? "Saving…" : "Set password and continue"}
        </button>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { fontFamily: "Inter, sans-serif", background: C.bg, color: C.ink, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, boxSizing: "border-box" },
  card: { background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "32px 28px", width: "100%", maxWidth: 380, boxShadow: "0 10px 30px rgba(18,42,40,0.08)" },
  eyebrow: { fontFamily: "IBM Plex Mono, monospace", fontSize: 12, color: C.teal, fontWeight: 600, letterSpacing: 1 },
  h1: { fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 22, margin: "4px 0 4px" },
  sub: { fontSize: 13, color: C.slate, margin: "0 0 20px", lineHeight: 1.5 },
  label: { display: "block", fontSize: 12, color: C.slate, fontWeight: 600, marginBottom: 4, marginTop: 12 },
  input: { width: "100%", boxSizing: "border-box", border: `1px solid ${C.line}`, borderRadius: 7, padding: "9px 10px", fontSize: 14 },
  error: { color: C.rose, fontSize: 13, marginTop: 12, marginBottom: 0 },
  submitBtn: { width: "100%", marginTop: 20, border: "none", background: C.ink, color: "#fff", borderRadius: 7, padding: "11px 0", fontSize: 14, fontWeight: 600, cursor: "pointer" },
};
