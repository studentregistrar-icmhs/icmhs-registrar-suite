"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const C = { ink: "#122A28", teal: "#0F7268" };

/**
 * The "Disciplinary" link in the top nav. AppNav is rendered from both
 * server and client pages, and access is checked live against the database
 * (not the login session), so the link asks the server once. Admins skip
 * the round trip. The page and its API routes enforce access on their own —
 * this only decides whether the link is drawn.
 */
export default function DisciplineNavLink({ isAdmin, isActive }: { isAdmin: boolean; isActive: boolean }) {
  const [show, setShow] = useState(isAdmin);

  useEffect(() => {
    if (isAdmin) return;
    let cancelled = false;
    fetch("/api/discipline/access", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (!cancelled && j?.ok && j.canView) setShow(true); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isAdmin]);

  if (!show) return null;
  return (
    <Link
      href="/discipline"
      style={{
        fontSize: 13, fontWeight: 600, textDecoration: "none",
        color: isActive ? C.ink : C.teal,
        borderBottom: isActive ? `2px solid ${C.teal}` : "2px solid transparent",
        paddingBottom: 2,
      }}
    >
      Disciplinary
    </Link>
  );
}
