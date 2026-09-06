// audit-storefront.js — full design audit for storefront
const TARGET_URL = 'http://localhost:5174/';
async function audit(page) {
  await page.goto(TARGET_URL, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(3000);

  const data = await page.evaluate(() => {
    const getCS = el => getComputedStyle(el);
    const all = sel => [...document.querySelectorAll(sel)];
    const one = sel => document.querySelector(sel);
    const isTrans = c => ['rgba(0, 0, 0, 0)', 'transparent', 'rgba(0,0,0,0)'].includes(c);

    const bgColors = new Set(), textColors = new Set(), borderColors = new Set();
    all('*').forEach(el => {
      const cs = getCS(el);
      if (!isTrans(cs.backgroundColor)) bgColors.add(cs.backgroundColor);
      if (!isTrans(cs.color)) textColors.add(cs.color);
      if (!isTrans(cs.borderColor)) borderColors.add(cs.borderColor);
    });

    const radii = new Set();
    all('*').forEach(el => { const r = getCS(el).borderRadius; if (r && r !== '0px') radii.add(r); });

    const shadows = new Set();
    all('*').forEach(el => { const s = getCS(el).boxShadow; if (s && s !== 'none') shadows.add(s); });

    const icons = all('svg, img, [class*="icon"]').map(el => {
      const tag = el.tagName.toLowerCase();
      const cls = typeof el.className === 'string' ? el.className : (el.className?.baseVal || '');
      const isImg = tag === 'img';
      return { tag, class: cls.slice(0,80), w: getCS(el).width, h: getCS(el).height,
               src: isImg ? el.src : null, alt: isImg ? el.alt : null,
               fill: !isImg ? getCS(el).fill : null, stroke: !isImg ? getCS(el).stroke : null };
    });

    const headings = all('h1,h2,h3,h4,h5,h6').map(h => ({
      tag: h.tagName, text: h.innerText.trim().slice(0,60),
      fontSize: getCS(h).fontSize, fontWeight: getCS(h).fontWeight,
      fontFamily: getCS(h).fontFamily, color: getCS(h).color,
    }));
    const bodyStyle = getCS(document.body);
    const bodyText = { fontFamily: bodyStyle.fontFamily, fontSize: bodyStyle.fontSize,
                        fontWeight: bodyStyle.fontWeight, color: bodyStyle.color };

    const buttons = all('button').map(b => {
      const cs = getCS(b);
      b.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      const hoverBg = getCS(b).backgroundColor;
      b.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
      b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      const activeBg = getCS(b).backgroundColor;
      b.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      return { text: b.innerText.trim().slice(0,40), defaultBg: cs.backgroundColor,
               hoverBg, activeBg, borderRadius: cs.borderRadius, color: cs.color,
               fontSize: cs.fontSize, fontWeight: cs.fontWeight, boxShadow: cs.boxShadow,
               outline: cs.outline, isDisabled: b.disabled || b.getAttribute('aria-disabled') === 'true' };
    });

    const cards = all('.card,[class*="card"],article,[class*="product"]').map(c => ({
      class: (c.className||'').toString().slice(0,80), tag: c.tagName,
      borderRadius: getCS(c).borderRadius, backgroundColor: getCS(c).backgroundColor,
      boxShadow: getCS(c).boxShadow, padding: getCS(c).padding, margin: getCS(c).margin,
    }));

    const modals = all('[role="dialog"],.modal,[class*="modal"],[class*="overlay"]').map(m => ({
      class: (m.className||'').toString().slice(0,80),
      borderRadius: getCS(m).borderRadius, boxShadow: getCS(m).boxShadow,
      backgroundColor: getCS(m).backgroundColor, animation: getCS(m).animation,
    }));

    const inputs = all('input:not([type="hidden"]),textarea,select').map(i => ({
      type: i.type || i.tagName, placeholder: i.placeholder,
      borderRadius: getCS(i).borderRadius, border: getCS(i).border, padding: getCS(i).padding,
    }));

    const inputFocus = all('input,textarea,select').map(i => ({
      type: i.type || i.tagName, outline: getCS(i).outline, outlineColor: getCS(i).outlineColor,
    }));

    const toasts = all('[class*="toast"],[class*="alert"],[role="alert"]').map(t => ({
      class: (t.className||'').toString().slice(0,80),
      borderRadius: getCS(t).borderRadius, backgroundColor: getCS(t).backgroundColor,
      color: getCS(t).color, boxShadow: getCS(t).boxShadow, animation: getCS(t).animation,
    }));

    const sections = all('section,main,[class*="section"],[class*="container"],footer,header,nav').map(s => ({
      class: (s.className||'').toString().slice(0,80), tag: s.tagName,
      padding: getCS(s).padding, margin: getCS(s).margin,
    }));

    const ctas = all('button,a[href],[role="button"]').map(el => el.innerText.trim().slice(0,60));

    function luminance(r,g,b) {
      const [rs,gs,bs] = [r,g,b].map(c => { c=c/255; return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4); });
      return 0.2126*rs+0.7152*gs+0.0722*bs;
    }
    function parseRGB(str) { const m = str.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/); return m?[+m[1],+m[2],+m[3]]:null; }
    function contrastRatio(c1,c2) {
      const a=parseRGB(c1),b=parseRGB(c2); if(!a||!b)return null;
      const l1=luminance(...a),l2=luminance(...b);
      return ((Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05)).toFixed(2);
    }
    const contrastIssues = [];
    all('p,span,a,li,td,th,h1,h2,h3,h4,h5,h6,label,button').forEach(el => {
      const cs = getCS(el);
      if (isTrans(cs.backgroundColor)||isTrans(cs.color)) return;
      const ratio = contrastRatio(cs.backgroundColor,cs.color);
      if (ratio !== null && parseFloat(ratio) < 4.5) contrastIssues.push({ tag: el.tagName, text: el.innerText.trim().slice(0,30), fg: cs.color, bg: cs.backgroundColor, ratio });
    });

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const mediaRules = [];
    try {
      document.styleSheets.forEach(ss => {
        try { [...ss.cssRules].forEach(r => { if (r.type === CSSRule.MEDIA_RULE) mediaRules.push(r.conditionText); }); } catch(_) {}
      });
    } catch(_) {}

    const emptyStates = all('.empty,[class*="empty"],.error,[class*="error"],[class*="404"]').map(el => ({
      class: (el.className||'').toString().slice(0,80), text: el.innerText.trim().slice(0,80),
    }));

    return {
      url: window.location.href, title: document.title,
      h1: one('h1')?.innerText?.trim()||'', bodyText, headings, buttons, inputs,
      inputFocus, cards, modals, toasts, sections, icons, ctas,
      radii: [...radii], shadows: [...shadows],
      bgColors: [...bgColors], textColors: [...textColors], borderColors: [...borderColors],
      contrastIssues: contrastIssues.slice(0,20),
      emptyStates, mediaRules: [...new Set(mediaRules)], prefersDark,
    };
  });

  return data;
}

export default audit;
