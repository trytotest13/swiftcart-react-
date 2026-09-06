import { useEffect, useRef } from "react";

/**
 * LegacyPage renders a page that was originally a static HTML file
 * (exact markup + CSS) and then runs its original <script> exactly as
 * it ran before, once the markup is in the DOM.
 *
 * Why this approach: the task was "convert to React without changing
 * look, behavior, or transitions, and don't touch the backend." The
 * original pages are large, hand-tuned vanilla-JS apps that talk to
 * the existing Express API via relative fetch("/api/...") calls. The
 * safest way to guarantee zero visual/behavioral drift is to keep the
 * markup, CSS and script byte-for-byte identical and let React own
 * only the mounting lifecycle — instead of manually re-authoring
 * thousands of lines of DOM logic into components, which risks subtle
 * regressions (event timing, animation classes, focus handling, etc).
 *
 * - CSS is injected into <head> as a <style> tag scoped to this page's
 *   lifetime (added on mount, removed on unmount).
 * - Markup is set via dangerouslySetInnerHTML into a container div.
 * - The script is appended as a real <script> tag AFTER the markup is
 *   in the DOM, so every getElementById/querySelector call in the
 *   original code resolves exactly like it did in the static file.
 */
export default function LegacyPage({ css, bodyHtml, scriptSrc }) {
  const containerRef = useRef(null);
  const ranRef = useRef(false);

  useEffect(() => {
    const styleEl = document.createElement("style");
    styleEl.setAttribute("data-legacy-page", "true");
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    // Guard against double-invocation in React 18 StrictMode (dev only),
    // which would otherwise run the original init code twice.
    let scriptEl = null;
    if (!ranRef.current) {
      ranRef.current = true;
      scriptEl = document.createElement("script");
      scriptEl.text = scriptSrc;
      document.body.appendChild(scriptEl);
    }

    return () => {
      document.head.removeChild(styleEl);
      if (scriptEl && scriptEl.parentNode) {
        scriptEl.parentNode.removeChild(scriptEl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      dangerouslySetInnerHTML={{ __html: bodyHtml }}
    />
  );
}
