"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const C = {
  ink: "#122A28", bg: "#EEF1EA", card: "#FFFFFF", line: "#D9DFD3",
  teal: "#0F7268", rose: "#B0432E", slate: "#54625D", sage: "#3F7D4F",
};

type Role = "admin" | "editor" | "viewer";
type CampusScope = "ALL" | "MAIN" | "NAKURU";
type UserRow = {
  id: number;
  username: string;
  display_name: string;
  role: Role;
  campus_scope: CampusScope;
  active: boolean;
  must_reset_password: boolean;
  created_at: string;
  last_login_at: string | null;
};

const ROLE_LABEL: Record<Role, string> = { admin: "Admin", editor: "Editor", viewer: "Viewer" };
const SCOPE_LABEL: Record<CampusScope, string> = { ALL: "Both campuses", MAIN: "Main only", NAKURU: "Nakuru only" };

export default function ManageUsers({ currentUserId }: { currentUserId: number }) {
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tempPasswordNotice, setTempPasswordNotice] = useState<{ username: string; tempPassword: string } | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newRole, setNewRole] = useState<Role>("editor");
  const [newScope, setNewScope] = useState<CampusScope>("ALL");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/users");
    const json = await res.json();
    if (json.ok) setUsers(json.users);
    else setError(json.reason ?? "Couldn't load users.");
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newUsername,
          displayName: newDisplayName,
          role: newRole,
          campusScope: newScope,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setCreateError(json.reason ?? "Couldn't create user.");
        return;
      }
      setTempPasswordNotice({ username: json.user.username, tempPassword: json.tempPassword });
      setNewUsername("");
      setNewDisplayName("");
      setNewRole("editor");
      setNewScope("ALL");
      setShowCreate(false);
      await load();
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleActive(u: UserRow) {
    if (!confirm(`${u.active ? "Deactivate" : "Reactivate"} ${u.display_name}?`)) return;
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !u.active }),
    });
    const json = await res.json();
    if (!json.ok) alert(json.reason ?? "Couldn't update user.");
    await load();
  }

  async function handleAccessChange(u: UserRow, role: Role, campusScope: CampusScope) {
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, campusScope }),
    });
    const json = await res.json();
    if (!json.ok) alert(json.reason ?? "Couldn't update user.");
    await load();
  }

  async function handleResetPassword(u: UserRow) {
    if (!confirm(`Reset ${u.display_name}'s password? They'll need the new temporary password to log in.`)) return;
    const res = await fetch(`/api/admin/users/${u.id}/reset-password`, { method: "POST" });
    const json = await res.json();
    if (!json.ok) {
      alert(json.reason ?? "Couldn't reset password.");
      return;
    }
    setTempPasswordNotice({ username: u.username, tempPassword: json.tempPassword });
    await load();
  }

  return (
    <div style={styles.page}>
      <Link href="/" style={styles.backLink}>← Back to dashboard</Link>
      <div style={styles.eyebrow}>ADMIN</div>
      <h1 style={styles.h1}>Manage registrar accounts</h1>

      {tempPasswordNotice && (
        <div style={styles.tempNotice}>
          <div>
            Temporary password for <strong>{tempPasswordNotice.username}</strong>:{" "}
            <code style={styles.tempCode}>{tempPasswordNotice.tempPassword}</code>
          </div>
          <div style={{ fontSize: 12, color: C.slate, marginTop: 4 }}>
            Shown once — relay it to them now. They'll be asked to set their own password on first login.
          </div>
          <button style={styles.dismissBtn} onClick={() => setTempPasswordNotice(null)}>Dismiss</button>
        </div>
      )}

      {error && <p style={{ color: C.rose }}>{error}</p>}

      {!showCreate ? (
        <button style={styles.primaryBtn} onClick={() => setShowCreate(true)}>+ Add registrar account</button>
      ) : (
        <form onSubmit={handleCreate} style={styles.createCard}>
          <div style={styles.formRow}>
            <label style={styles.label}>Username</label>
            <input style={styles.input} value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="e.g. amungai" />
          </div>
          <div style={styles.formRow}>
            <label style={styles.label}>Display name</label>
            <input style={styles.input} value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} placeholder="e.g. Andrew Mungai" />
          </div>
          <div style={styles.formRow}>
            <label style={styles.label}>Role</label>
            <select style={styles.input} value={newRole} onChange={(e) => setNewRole(e.target.value as Role)}>
              <option value="admin">Admin — full access, incl. bulk tools and managing accounts</option>
              <option value="editor">Editor — can view and edit student statuses</option>
              <option value="viewer">Viewer — read-only</option>
            </select>
          </div>
          {newRole !== "admin" && (
            <div style={styles.formRow}>
              <label style={styles.label}>Campus scope</label>
              <select style={styles.input} value={newScope} onChange={(e) => setNewScope(e.target.value as CampusScope)}>
                <option value="ALL">Both campuses</option>
                <option value="MAIN">Main campus only</option>
                <option value="NAKURU">Nakuru campus only</option>
              </select>
            </div>
          )}
          {createError && <p style={{ color: C.rose, fontSize: 13 }}>{createError}</p>}
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button type="button" style={styles.cancelBtn} onClick={() => { setShowCreate(false); setCreateError(null); }}>Cancel</button>
            <button type="submit" style={styles.primaryBtn} disabled={creating}>
              {creating ? "Creating…" : "Create account"}
            </button>
          </div>
        </form>
      )}

      <div style={styles.table}>
        <div style={styles.tableHeader}>
          <div>Name</div>
          <div>Username</div>
          <div>Access</div>
          <div>Status</div>
          <div></div>
        </div>
        {(users ?? []).map((u) => (
          <UserRowView
            key={u.id}
            user={u}
            isSelf={u.id === currentUserId}
            onToggleActive={() => handleToggleActive(u)}
            onAccessChange={(role, scope) => handleAccessChange(u, role, scope)}
            onResetPassword={() => handleResetPassword(u)}
          />
        ))}
        {users !== null && users.length === 0 && (
          <div style={{ padding: 16, fontSize: 13, color: C.slate }}>No accounts yet.</div>
        )}
      </div>
    </div>
  );
}

function UserRowView({
  user, isSelf, onToggleActive, onAccessChange, onResetPassword,
}: {
  user: UserRow;
  isSelf: boolean;
  onToggleActive: () => void;
  onAccessChange: (role: Role, scope: CampusScope) => void;
  onResetPassword: () => void;
}) {
  const [role, setRole] = useState(user.role);
  const [scope, setScope] = useState(user.campus_scope);

  return (
    <div style={styles.tableRow}>
      <div>
        {user.display_name}
        {isSelf && <span style={{ color: C.slate, fontSize: 11 }}> (you)</span>}
      </div>
      <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 12.5 }}>{user.username}</div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        {isSelf ? (
          <span>{ROLE_LABEL[user.role]} · {SCOPE_LABEL[user.campus_scope]}</span>
        ) : (
          <>
            <select
              style={styles.smallSelect}
              value={role}
              onChange={(e) => {
                const r = e.target.value as Role;
                setRole(r);
                onAccessChange(r, r === "admin" ? "ALL" : scope);
              }}
            >
              <option value="admin">Admin</option>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            {role !== "admin" && (
              <select
                style={styles.smallSelect}
                value={scope}
                onChange={(e) => {
                  const s = e.target.value as CampusScope;
                  setScope(s);
                  onAccessChange(role, s);
                }}
              >
                <option value="ALL">Both campuses</option>
                <option value="MAIN">Main only</option>
                <option value="NAKURU">Nakuru only</option>
              </select>
            )}
          </>
        )}
      </div>
      <div>
        <span style={{ ...styles.statusPill, background: user.active ? "#EAF3EF" : "#F3E7E4", color: user.active ? C.sage : C.rose }}>
          {user.active ? "Active" : "Deactivated"}
        </span>
        {user.must_reset_password && user.active && (
          <span style={{ fontSize: 11, color: C.slate, marginLeft: 6 }}>awaiting first login</span>
        )}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button style={styles.smallBtn} onClick={onResetPassword}>Reset password</button>
        {!isSelf && (
          <button style={styles.smallBtn} onClick={onToggleActive}>
            {user.active ? "Deactivate" : "Reactivate"}
          </button>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { fontFamily: "Inter, sans-serif", background: C.bg, color: C.ink, padding: "40px 32px", minHeight: "100vh", boxSizing: "border-box", maxWidth: 900, margin: "0 auto" },
  backLink: { fontFamily: "IBM Plex Mono, monospace", fontSize: 12, color: C.slate, textDecoration: "none", display: "inline-block", marginBottom: 20 },
  eyebrow: { fontFamily: "IBM Plex Mono, monospace", fontSize: 12, color: C.teal, fontWeight: 600 },
  h1: { fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 26, margin: "4px 0 20px" },
  tempNotice: { background: "#FFF9E8", border: "1px solid #E8D69A", borderRadius: 8, padding: "12px 14px", marginBottom: 20 },
  tempCode: { background: "#fff", padding: "2px 8px", borderRadius: 4, border: `1px solid ${C.line}`, fontSize: 14 },
  dismissBtn: { marginTop: 8, border: "none", background: "transparent", color: C.teal, fontSize: 12, cursor: "pointer", padding: 0 },
  primaryBtn: { border: "none", background: C.ink, color: "#fff", borderRadius: 7, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  cancelBtn: { border: `1px solid ${C.line}`, background: "#fff", borderRadius: 7, padding: "9px 16px", fontSize: 13, cursor: "pointer" },
  createCard: { background: "#fff", border: `1px solid ${C.line}`, borderRadius: 10, padding: 20, marginTop: 12, marginBottom: 20, maxWidth: 420 },
  formRow: { marginBottom: 12 },
  label: { display: "block", fontSize: 12, color: C.slate, fontWeight: 600, marginBottom: 4 },
  input: { width: "100%", boxSizing: "border-box", border: `1px solid ${C.line}`, borderRadius: 7, padding: "8px 10px", fontSize: 13.5 },
  table: { marginTop: 20, border: `1px solid ${C.line}`, borderRadius: 10, overflow: "hidden", background: "#fff" },
  tableHeader: { display: "grid", gridTemplateColumns: "1.2fr 1fr 1.6fr 1fr 1.2fr", gap: 8, padding: "10px 14px", fontSize: 11, fontWeight: 700, color: C.slate, textTransform: "uppercase", letterSpacing: 0.5, borderBottom: `1px solid ${C.line}`, background: "#F5F7F2" },
  tableRow: { display: "grid", gridTemplateColumns: "1.2fr 1fr 1.6fr 1fr 1.2fr", gap: 8, padding: "10px 14px", fontSize: 13, alignItems: "center", borderBottom: `1px solid ${C.line}` },
  smallSelect: { border: `1px solid ${C.line}`, borderRadius: 6, padding: "3px 6px", fontSize: 12 },
  smallBtn: { border: `1px solid ${C.line}`, background: "#fff", borderRadius: 6, padding: "5px 9px", fontSize: 11.5, cursor: "pointer", whiteSpace: "nowrap" },
  statusPill: { fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 20 },
};
