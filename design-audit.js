// design-audit.js
// Run with: node design-audit.js <url>
// Audits: border-radius, colors, typography, spacing, components

const url = process.argv[2] || 'http://localhost:5174/';

async function audit(page) {
  await page.goto(url, { waitUntil: 'networkidle' });

  const results = await page.evaluate(() => {
    const get = (sel) => document.querySelector(sel);
    const getAll = (sel) => [...document.querySelectorAll(sel)];

    // ---- Colors ----
    const root = document.documentElement;
    const rootStyle = getComputedStyle(root);

    const cssVars = {};
    for (const [k, v] of Object.entries(rootStyle)) {
      if (k.startsWith('--')) cssVars[k] = v;
    }

    // All unique border-radii across all elements
    const allRadii = new Set();
    document.querySelectorAll('*').forEach(el => {
      const r = getComputedStyle(el).borderRadius;
      if (r && r !== '0px') allRadii.add(r);
    });

    // All unique border values
    const allBorders = new Set();
    document.querySelectorAll('*').forEach(el => {
      const b = getComputedStyle(el).border;
      if (b && b !== '0px none none') allBorders.add(b);
    });

    // Background / text colors used in body and direct children
    const bgColors = new Set();
    const textColors = new Set();
    document.querySelectorAll('*').forEach(el => {
      const cs = getComputedStyle(el);
      if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent') {
        bgColors.add(cs.backgroundColor);
      }
      if (cs.color && cs.color !== 'rgba(0, 0, 0, 0)') textColors.add(cs.color);
    });

    // ---- Typography ----
    const body = document.body;
    const bodyStyle = getComputedStyle(body);

    const headings = getAll('h1,h2,h3,h4,h5,h6').map(h => ({
      tag: h.tagName,
      fontSize: getComputedStyle(h).fontSize,
      fontWeight: getComputedStyle(h).fontWeight,
      fontFamily: getComputedStyle(h).fontFamily,
      lineHeight: getComputedStyle(h).lineHeight,
      color: getComputedStyle(h).color,
    }));

    const bodyText = {
      fontFamily: bodyStyle.fontFamily,
      fontSize: bodyStyle.fontSize,
      fontWeight: bodyStyle.fontWeight,
      lineHeight: bodyStyle.lineHeight,
      color: bodyStyle.color,
    };

    // ---- Buttons ----
    const buttons = getAll('button').map(b => ({
      text: b.innerText.trim().slice(0, 40),
      borderRadius: getComputedStyle(b).borderRadius,
      backgroundColor: getComputedStyle(b).backgroundColor,
      color: getComputedStyle(b).color,
      padding: getComputedStyle(b).padding,
      fontSize: getComputedStyle(b).fontSize,
      fontWeight: getComputedStyle(b).fontWeight,
    }));

    // ---- Inputs ----
    const inputs = getAll('input,textarea,select').map(i => ({
      type: i.type || i.tagName,
      borderRadius: getComputedStyle(i).borderRadius,
      border: getComputedStyle(i).border,
      padding: getComputedStyle(i).padding,
      fontSize: getComputedStyle(i).fontSize,
    }));

    // ---- Cards / Containers ----
    const cards = getAll('[class*="card"], .card, [class*="product"], article').map(c => ({
      tag: c.tagName,
      className: c.className,
      borderRadius: getComputedStyle(c).borderRadius,
      border: getComputedStyle(c).border,
      backgroundColor: getComputedStyle(c).backgroundColor,
      boxShadow: getComputedStyle(c).boxShadow,
      padding: getComputedStyle(c).padding,
    }));

    // ---- Nav ----
    const navs = getAll('nav, header').map(n => ({
      tag: n.tagName,
      borderRadius: getComputedStyle(n).borderRadius,
      backgroundColor: getComputedStyle(n).backgroundColor,
      padding: getComputedStyle(n).padding,
    }));

    // ---- Page title ----
    const title = document.title;
    const h1 = get('h1')?.innerText?.trim() || '';

    return {
      url: window.location.href,
      title,
      h1,
      bodyText,
      headings,
      buttons,
      inputs,
      cards,
      navs,
      radii: [...allRadii],
      borders: [...allBorders],
      bgColors: [...bgColors],
      textColors: [...textColors],
    };
  });

  return results;
}

module.exports = audit;
