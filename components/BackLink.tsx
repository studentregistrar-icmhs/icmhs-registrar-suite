"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * A back control that returns to wherever you actually came from, rather
 * than a hardcoded destination.
 *
 * Most pages in this app used to link straight to "/" (or to a term
 * dashboard), which meant that after e.g. Reports -> student profile ->
 * Back, you'd be dropped somewhere you hadn't been instead of the page you
 * were just on. This walks the browser's own history instead.
 *
 * `fallbackHref` is used only when there's no in-app history to go back to
 * — someone opening a deep link directly, or arriving in a fresh tab. In
 * that case router.back() would either do nothing or leave the app
 * entirely, so a sensible in-app destination is better.
 */
export default function BackLink({
  fallbackHref = "/",
  label = "← Back",
  style,
}: {
  fallbackHref?: string;
  label?: string;
  style?: React.CSSProperties;
}) {
  const router = useRouter();
  // Rendered identically on the server and on the first client paint, then
  // corrected once mounted — reading window.history during render would
  // cause a hydration mismatch.
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    // history.length > 1 means there's *something* to go back to. It can't
    // tell us whether that entry belongs to this app, but combined with the
    // fallback below it's the best signal available without tracking our
    // own navigation stack.
    setCanGoBack(window.history.length > 1);
  }, []);

  return (
    <button
      type="button"
      onClick={() => {
        if (canGoBack) router.back();
        else router.push(fallbackHref);
      }}
      style={{ ...defaultStyle, ...style }}
    >
      {label}
    </button>
  );
}

const defaultStyle: React.CSSProperties = {
  fontFamily: "IBM Plex Mono, monospace",
  fontSize: 12,
  color: "#54625D",
  textDecoration: "none",
  display: "inline-block",
  marginBottom: 20,
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
};
