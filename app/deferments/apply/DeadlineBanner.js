"use client";

import { useEffect, useState } from "react";
import { formatDeadline } from "@/lib/deferments/deferment";

export default function DeadlineBanner({ deadline }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const diffMs = deadline.getTime() - now.getTime();
  if (diffMs <= 0) return null;

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diffMs / (1000 * 60)) % 60);
  const seconds = Math.floor((diffMs / 1000) % 60);

  return (
    <div className="deadline-banner">
      <div className="deadline-count">
        {days > 0 && <span>{days}d </span>}
        <span>{String(hours).padStart(2, "0")}h</span>{" "}
        <span>{String(minutes).padStart(2, "0")}m</span>{" "}
        <span>{String(seconds).padStart(2, "0")}s</span>
      </div>
      <div className="deadline-text">remaining to defer the <strong>current</strong> semester &mdash; deadline is {formatDeadline(deadline)}. Deferring a future semester is always available below.</div>
    </div>
  );
}
