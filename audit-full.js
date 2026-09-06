// audit-full.js  — comprehensive design audit script
// Usage: node 'C:\path\to\browser.mjs' <url> --script 'C:\path\to\audit-full.js'

// ── CONFIG ──────────────────────────────────────────────────
const TARGET_URL = 'http://localhost:5174/';
// ─────────────────────────────────────────────────────────────

async function audit(page) {
  await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 20000 });

  const data = await page.evaluate(() => {
    const getCS = (el) => getComputedStyle(el);

    // ── Helpers ───────────────────────────────────────────────
    const all = (sel) => [...document.querySelectorAll(sel)];
    const one = (sel) => document.querySelector(sel);

    const isTransparent = (c) => ['rgba(0, 0, 0, 0)', 'transparent', 'rgba(0,0,0,0)'].includes(c);

    // ── Color collection ──────────────────────────────────────
    const bgColors = new Set();
    const textColors = new Set();
    const borderColors = new Set();
    const fillColors = new Set();

    all('*').forEach((el) => {
      const cs = getCS(el);
      if (!isTransparent(cs.backgroundColor)) bgColors.add(cs.backgroundColor);
      if (!isTransparent(cs.color)) textColors.add(cs.color);
      const b = cs.borderColor;
      if (!isTransparent(b)) borderColors.add(b);
      const f = cs.fill;
      if (f && !isTransparent(f)) fillColors.add(f);
    });

    // ── Border-radius palette ───────────────────────────────────
    const radii = new Set();
    all('*').forEach((el) => {
      const r = getCS(el).borderRadius;
      if (r && r !== '0px') radii.add(r);
    });

    // ── Shadow palette ─────────────────────────────────────────
    const shadows = new Set();
    all('*').forEach((el) => {
      const s = getCS(el).boxShadow;
      if (s && s !== 'none') shadows.add(s);
    });

    // ── Icon / SVG analysis ────────────────────────────────────
    const icons = all('svg, [class*="icon"], [class*="Icon"], img').map((el) => {
      const tag = el.tagName.toLowerCase();
      const cls = typeof el.className === 'string'
        ? el.className
        : (el.className?.baseVal || '');
      const isImg = tag === 'img';
      return {
        tag,
        class: cls.slice(0, 80),
        width: isImg ? el.naturalWidth || getCS(el).width : getCS(el).width,
        height: isImg ? el.naturalHeight || getCS(el).height : getCS(el).height,
        src: isImg ? el.src : null,
        alt: isImg ? el.alt : null,
        fill: !isImg ? getCS(el).fill : null,
        stroke: !isImg ? getCS(el).stroke : null,
      };
    });

    // ── Typography ─────────────────────────────────────────────
    const headings = all('h1,h2,h3,h4,h5,h6').map((h) => ({
      tag: h.tagName,
      text: h.innerText.trim().slice(0, 60),
      fontSize: getCS(h).fontSize,
      fontWeight: getCS(h).fontWeight,
      fontFamily: getCS(h).fontFamily,
      color: getCS(h).color,
      lineHeight: getCS(h).lineHeight,
      letterSpacing: getCS(h).letterSpacing,
    }));

    const bodyStyle = getCS(document.body);
    const bodyText = {
      fontFamily: bodyStyle.fontFamily,
      fontSize: bodyStyle.fontSize,
      fontWeight: bodyStyle.fontWeight,
      lineHeight: bodyStyle.lineHeight,
      color: bodyStyle.color,
    };

    // ── Button states (hover, focus, active, disabled) ─────────
    const buttons = all('button').map((b) => {
      const cs = getCS(b);
      // hover
      b.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      const hoverBg = getCS(b).backgroundColor;
      b.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
      // active
      b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      const activeBg = getCS(b).backgroundColor;
      b.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      // focus-visible
      const focusOutline = getCS(b).outline;
      const focusOutlineColor = getCS(b).outlineColor;
      // disabled
      const isDisabled = b.disabled || b.getAttribute('aria-disabled') === 'true';
      return {
        text: b.innerText.trim().slice(0, 40),
        defaultBg: cs.backgroundColor,
        hoverBg,
        activeBg,
        borderRadius: cs.borderRadius,
        color: cs.color,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        boxShadow: cs.boxShadow,
        focusOutline,
        focusOutlineColor,
        isDisabled,
      };
    });

    // ── Cards / containers ─────────────────────────────────────
    const cards = all('.card, [class*="card"], article, [class*="product-item"]').map((c) => ({
      class: c.className.slice(0, 80),
      tag: c.tagName,
      borderRadius: getCS(c).borderRadius,
      backgroundColor: getCS(c).backgroundColor,
      boxShadow: getCS(c).boxShadow,
      padding: getCS(c).padding,
      margin: getCS(c).margin,
    }));

    // ── Modal / dialog ─────────────────────────────────────────
    const modals = all('[role="dialog"], .modal, [class*="modal"], .overlay, [class*="overlay"]').map((m) => ({
      class: m.className.slice(0, 80),
      borderRadius: getCS(m).borderRadius,
      boxShadow: getCS(m).boxShadow,
      backgroundColor: getCS(m).backgroundColor,
      animation: getCS(m).animation,
      transition: getCS(m).transition,
    }));

    // ── Form elements ──────────────────────────────────────────
    const inputs = all('input:not([type="hidden"]), textarea, select').map((i) => ({
      type: i.type || i.tagName,
      placeholder: i.placeholder,
      borderRadius: getCS(i).borderRadius,
      border: getCS(i).border,
      padding: getCS(i).padding,
      fontSize: getCS(i).fontSize,
      backgroundColor: getCS(i).backgroundColor,
      // check focus style
    }));

    // Focus ring for inputs
    const inputFocusRings = all('input, textarea, select').map((i) => ({
      type: i.type || i.tagName,
      outline: getCS(i).outline,
      outlineColor: getCS(i).outlineColor,
      boxShadow: getCS(i).boxShadow,
    }));

    // ── Toast / notification / alerts ───────────────────────────
    const toasts = all('[class*="toast"], [class*="notification"], [class*="alert"], .alert, [role="alert"]').map((t) => ({
      class: t.className.slice(0, 80),
      borderRadius: getCS(t).borderRadius,
      backgroundColor: getCS(t).backgroundColor,
      color: getCS(t).color,
      boxShadow: getCS(t).boxShadow,
      animation: getCS(t).animation,
    }));

    // ── Spacing / whitespace rhythm (section padding) ──────────
    const sections = all('section, main, [class*="section"], [class*="container"], footer, header, nav').map((s) => ({
      class: s.className.slice(0, 80),
      tag: s.tagName,
      padding: getCS(s).padding,
      margin: getCS(s).margin,
    }));

    // ── Responsive breakpoints ───────────────────────────────────
    // Check if any @media rules exist
    const styleSheets = [...document.styleSheets];
    const mediaRules = [];
    styleSheets.forEach((ss) => {
      try {
        [...ss.cssRules].forEach((r) => {
          if (r.type === CSSRule.MEDIA_RULE) {
            mediaRules.push(r.conditionText);
          }
        });
      } catch (_) {}
    });

    // ── Dark mode ──────────────────────────────────────────────
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const rootBg = getCS(document.documentElement).backgroundColor;
    const rootColor = getCS(document.documentElement).color;

    // ── Contrast check (text over bg) ──────────────────────────
    // Simple WCAG luminance check
    function luminance(r, g, b) {
      const [rs, gs, bs] = [r, g, b].map((c) => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    }
    function parseRGB(str) {
      const m = str.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      return m ? [+m[1], +m[2], +m[3]] : null;
    }
    function contrastRatio(c1, c2) {
      const a = parseRGB(c1), b = parseRGB(c2);
      if (!a || !b) return null;
      const l1 = luminance(...a), l2 = luminance(...b);
      const lighter = Math.max(l1, l2), darker = Math.min(l1, l2);
      return ((lighter + 0.05) / (darker + 0.05)).toFixed(2);
    }

    const contrastIssues = [];
    all('p, span, a, li, td, th, h1,h2,h3,h4,h5,h6, label, button').forEach((el) => {
      const cs = getCS(el);
      const bg = cs.backgroundColor;
      const fg = cs.color;
      if (isTransparent(bg) || isTransparent(fg)) return;
      const ratio = contrastRatio(bg, fg);
      if (ratio !== null && parseFloat(ratio) < 4.5) {
        contrastIssues.push({ tag: el.tagName, text: el.innerText.trim().slice(0, 30), fg, bg, ratio });
      }
    });

    // ── Language / CTA consistency ─────────────────────────────
    const ctas = all('button, a[href], [role="button"]').map((el) => el.innerText.trim().slice(0, 60));

    // ── Empty / error states ───────────────────────────────────
    const emptyStates = all('.empty, [class*="empty"], .error, [class*="error"], .404, [class*="404"]').map((el) => ({
      class: el.className.slice(0, 80),
      text: el.innerText.trim().slice(0, 80),
      tag: el.tagName,
    }));

    // ── Favicon check ───────────────────────────────────────────
    const favicon = one('link[rel*="icon"]')?.href || null;

    return {
      url: window.location.href,
      title: document.title,
      h1: one('h1')?.innerText?.trim() || '',
      bodyText,
      headings,
      buttons,
      inputs,
      inputFocusRings,
      cards,
      modals,
      toasts,
      sections,
      icons,
      radii: [...radii],
      shadows: [...shadows],
      bgColors: [...bgColors],
      textColors: [...textColors],
      borderColors: [...borderColors],
      fillColors: [...fillColors],
      contrastIssues: contrastIssues.slice(0, 20),
      ctas,
      emptyStates,
      mediaRules: [...new Set(mediaRules)],
      prefersDark,
      rootBg,
      rootColor,
      favicon,
    };
  });

  return data;
}

export default audit;
