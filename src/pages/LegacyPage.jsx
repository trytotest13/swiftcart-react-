import { useEffect, useRef } from "react";

// Mounts verbatim legacy markup/CSS/JS: CSS as <style> on mount, markup via
// dangerouslySetInnerHTML, original script as <script> after markup is in DOM.
export default function LegacyPage({ css, bodyHtml, scriptSrc }) {
  const ranRef = useRef(false);

  useEffect(() => {
    const styleEl = document.createElement("style");
    styleEl.setAttribute("data-legacy-page", "true");
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    // Guard against React 18 StrictMode double-invocation in dev.
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

  return <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />;
}
