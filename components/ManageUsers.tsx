"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BackLink from "@/components/BackLink";
import { DEPARTMENTS } from "@/lib/departments";
import { TERMS } from "@/lib/terms";

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
  department_scope: string[] | null;
  term_scope: string[] | null;
  can_view_deferments: boolean;
  active: boolean;
  must_reset_password: boolean;
  created_at: string;
  last_login_at: string | null;
};

// What an admin is actually setting per account, independent of the
// UserRow shape returned by the list API — used for both the create form
// and each row's expanded editor so the two stay in lockstep.
type AccessDraft = {
  role: Role;
  campusScope: CampusScope;
  departmentScope: string[]; // [] here means "all" — converted to null on the wire
  termScope: string[];       // [] here means "all" — converted to null on the wire
  canViewDeferments: boolean;
};

const ROLE_LABEL: Record<Role, string> = { admin: "Admin", editor: "Editor", viewer: "Viewer" };
const SCOPE_LABEL: Record<CampusScope, string> = { ALL: "Both campuses", MAIN: "Main only", NAKURU: "Nakuru only" };

function draftFromUser(u: UserRow): AccessDraft {
  return {
    role: u.role,
    campusScope: u.campus_scope,
    departmentScope: u.department_scope ?? [],
    termScope: u.term_scope ?? [],
    canViewDeferments: u.can_view_deferments,
  };
}

function summarizeAccess(u: UserRow): string {
  if (u.role === "admin") return "Admin · full access";
  const parts = [ROLE_LABEL[u.role], SCOPE_LABEL[u.campus_scope]];
  parts.push(
    u.department_scope && u.department_scope.length > 0
      ? `${u.department_scope.length} school${u.department_scope.length === 1 ? "" : "s"}`
      : "all schools"
  );
  parts.push(
    u.term_scope && u.term_scope.length > 0
      ? `${u.term_scope.length} term${u.term_scope.length === 1 ? "" : "s"}`
      : "all terms"
  );
  parts.push(u.can_view_deferments ? "Deferments" : "no Deferments");
  return parts.join(" · ");
}

export default function ManageUsers({ currentUserId }: { currentUserId: number }) {
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tempPasswordNotice, setTempPasswordNotice] = useState<{ username: string; tempPassword: string } | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newAccess, setNewAccess] = useState<AccessDraft>({
    role: "editor", campusScope: "ALL", departmentScope: [], termScope: [], canViewDeferments: false,
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<number | null>(null);

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
          role: newAccess.role,
          campusScope: newAccess.campusScope,
          departmentScope: newAccess.departmentScope,
          termScope: newAccess.termScope,
          canViewDeferments: newAccess.canViewDeferments,
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
      setNewAccess({ role: "editor", campusScope: "ALL", departmentScope: [], termScope: [], canViewDeferments: false });
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

  async function handleAccessSave(userId: number, draft: AccessDraft) {
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: draft.role,
        campusScope: draft.campusScope,
        departmentScope: draft.departmentScope,
        termScope: draft.termScope,
        canViewDeferments: draft.canViewDeferments,
      }),
    });
    const json = await res.json();
    if (!json.ok) {
      alert(json.reason ?? "Couldn't update user.");
      return;
    }
    setExpandedId(null);
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
      <BackLink fallbackHref="/" style={styles.backLink} />
      <div style={styles.eyebrow}>ADMIN</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 10 }}>
        <h1 style={styles.h1}>Manage registrar accounts</h1>
        <Link href="/admin/audit-log" style={{ fontSize: 13, fontWeight: 600, color: C.teal, textDecoration: "none" }}>
          View audit log →
        </Link>
      </div>

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
          <AccessEditor draft={newAccess} onChange={setNewAccess} />
          {createError && <p style={{ color: C.rose, fontSize: 13 }}>{createError}</p>}
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
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
            expanded={expandedId === u.id}
            onToggleExpand={() => setExpandedId(expandedId === u.id ? null : u.id)}
            onToggleActive={() => handleToggleActive(u)}
            onAccessSave={(draft) => handleAccessSave(u.id, draft)}
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
  user, isSelf, expanded, onToggleExpand, onToggleActive, onAccessSave, onResetPassword,
}: {
  user: UserRow;
  isSelf: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleActive: () => void;
  onAccessSave: (draft: AccessDraft) => void;
  onResetPassword: () => void;
}) {
  const [draft, setDraft] = useState<AccessDraft>(() => draftFromUser(user));

  // Reset the draft to the latest saved values whenever the row is
  // (re)opened, so a cancelled edit never lingers into the next open.
  useEffect(() => {
    if (expanded) setDraft(draftFromUser(user));
  }, [expanded, user]);

  return (
    <div>
      <div style={styles.tableRow}>
        <div>
          {user.display_name}
          {isSelf && <span style={{ color: C.slate, fontSize: 11 }}> (you)</span>}
        </div>
        <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 12.5 }}>{user.username}</div>
        <div style={{ fontSize: 12.5 }}>{summarizeAccess(user)}</div>
        <div>
          <span style={{ ...styles.statusPill, background: user.active ? "#EAF3EF" : "#F3E7E4", color: user.active ? C.sage : C.rose }}>
            {user.active ? "Active" : "Deactivated"}
          </span>
          {user.must_reset_password && user.active && (
            <span style={{ fontSize: 11, color: C.slate, marginLeft: 6 }}>awaiting first login</span>
          )}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {!isSelf && (
            <button style={styles.smallBtn} onClick={onToggleExpand}>{expanded ? "Close" : "Edit access"}</button>
          )}
          <button style={styles.smallBtn} onClick={onResetPassword}>Reset password</button>
          {!isSelf && (
            <button style={styles.smallBtn} onClick={onToggleActive}>
              {user.active ? "Deactivate" : "Reactivate"}
            </button>
          )}
        </div>
      </div>
      {expanded && !isSelf && (
        <div style={styles.expandedPanel}>
          <AccessEditor draft={draft} onChange={setDraft} />
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button style={styles.cancelBtn} onClick={onToggleExpand}>Cancel</button>
            <button style={styles.primaryBtn} onClick={() => onAccessSave(draft)}>Save access</button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Shared role/campus/department/term/deferments editor — used identically
 * for the create-account form and for editing an existing account, so the
 * two can never drift into different sets of options.
 */
function AccessEditor({ draft, onChange }: { draft: AccessDraft; onChange: (d: AccessDraft) => void }) {
  const isAdminRole = draft.role === "admin";

  function toggle(list: string[], value: string): string[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  return (
    <>
      <div style={styles.formRow}>
        <label style={styles.label}>Role</label>
        <select
          style={styles.input}
          value={draft.role}
          onChange={(e) => onChange({ ...draft, role: e.target.value as Role })}
        >
          <option value="admin">Admin — full access, incl. bulk tools and managing accounts</option>
          <option value="editor">Editor — can view and edit student statuses</option>
          <option value="viewer">Viewer — read-only</option>
        </select>
      </div>

      {!isAdminRole && (
        <>
          <div style={styles.formRow}>
            <label style={styles.label}>Campus scope</label>
            <select
              style={styles.input}
              value={draft.campusScope}
              onChange={(e) => onChange({ ...draft, campusScope: e.target.value as CampusScope })}
            >
              <option value="ALL">Both campuses</option>
              <option value="MAIN">Main campus only</option>
              <option value="NAKURU">Nakuru campus only</option>
            </select>
          </div>

          <div style={styles.formRow}>
            <label style={styles.label}>
              School / department scope
              <span style={styles.labelHint}>
                {draft.departmentScope.length === 0 ? " — all schools" : ` — ${draft.departmentScope.length} selected`}
              </span>
            </label>
            <div style={styles.checkboxList}>
              {DEPARTMENTS.map((dept) => (
                <label key={dept} style={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={draft.departmentScope.includes(dept)}
                    onChange={() => onChange({ ...draft, departmentScope: toggle(draft.departmentScope, dept) })}
                  />
                  {dept}
                </label>
              ))}
            </div>
            <p style={styles.helpText}>
              Leave everything unchecked for access to every school. Check specific schools — e.g. for an HOD —
              to restrict this account to only students in those schools, everywhere in the app.
            </p>
          </div>

          <div style={styles.formRow}>
            <label style={styles.label}>
              Term scope
              <span style={styles.labelHint}>
                {draft.termScope.length === 0 ? " — all terms" : ` — ${draft.termScope.length} selected`}
              </span>
            </label>
            <div style={styles.checkboxList}>
              {TERMS.map((t) => (
                <label key={t.slug} style={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={draft.termScope.includes(t.slug)}
                    onChange={() => onChange({ ...draft, termScope: toggle(draft.termScope, t.slug) })}
                  />
                  {t.label}
                </label>
              ))}
            </div>
            <p style={styles.helpText}>
              Leave everything unchecked for access to every term, including future ones added later. Check
              specific terms to restrict this account to only those term dashboards.
            </p>
          </div>

          <div style={styles.formRow}>
            <label style={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={draft.canViewDeferments}
                onChange={(e) => onChange({ ...draft, canViewDeferments: e.target.checked })}
              />
              Can view the Deferments registrar review area
            </label>
          </div>
        </>
      )}
    </>
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
  createCard: { background: "#fff", border: `1px solid ${C.line}`, borderRadius: 10, padding: 20, marginTop: 12, marginBottom: 20, maxWidth: 460 },
  expandedPanel: { background: "#F5F7F2", border: `1px solid ${C.line}`, borderTop: "none", borderRadius: "0 0 8px 8px", padding: 18, marginBottom: 4 },
  formRow: { marginBottom: 14 },
  label: { display: "block", fontSize: 12, color: C.slate, fontWeight: 600, marginBottom: 4 },
  labelHint: { fontWeight: 400, textTransform: "none", letterSpacing: 0, color: C.teal },
  input: { width: "100%", boxSizing: "border-box", border: `1px solid ${C.line}`, borderRadius: 7, padding: "8px 10px", fontSize: 13.5 },
  checkboxList: { display: "flex", flexDirection: "column", gap: 4, maxHeight: 180, overflowY: "auto", border: `1px solid ${C.line}`, borderRadius: 7, padding: "8px 10px", background: "#fff" },
  checkboxRow: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" },
  helpText: { fontSize: 11.5, color: C.slate, margin: "6px 0 0", lineHeight: 1.5 },
  table: { marginTop: 20, border: `1px solid ${C.line}`, borderRadius: 10, overflow: "hidden", background: "#fff" },
  tableHeader: { display: "grid", gridTemplateColumns: "1.2fr 1fr 2fr 1fr 1.6fr", gap: 8, padding: "10px 14px", fontSize: 11, fontWeight: 700, color: C.slate, textTransform: "uppercase", letterSpacing: 0.5, borderBottom: `1px solid ${C.line}`, background: "#F5F7F2" },
  tableRow: { display: "grid", gridTemplateColumns: "1.2fr 1fr 2fr 1fr 1.6fr", gap: 8, padding: "10px 14px", fontSize: 13, alignItems: "center", borderBottom: `1px solid ${C.line}` },
  smallBtn: { border: `1px solid ${C.line}`, background: "#fff", borderRadius: 6, padding: "5px 9px", fontSize: 11.5, cursor: "pointer", whiteSpace: "nowrap" },
  statusPill: { fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 20 },
};
