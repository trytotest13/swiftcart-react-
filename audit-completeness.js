// audit-completeness.js — page presence, links, buttons, forms, navigation
const TARGET_URL = 'http://localhost:5174/';

async function audit(page) {
  await page.goto(TARGET_URL, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(3000);

  const data = await page.evaluate(() => {
    const getCS = el => getComputedStyle(el);
    const all = sel => [...document.querySelectorAll(sel)];
    const one = sel => document.querySelector(sel);

    // ── 1. ALL NAVIGABLE Links (href, text, target) ──────────────────────────
    const allLinks = all('a[href]').map(a => ({
      href: a.href,
      text: a.innerText.trim().slice(0, 80),
      target: a.target,
      isHash: a.href === '#' || a.href.startsWith('#'),
      isMailto: a.href.startsWith('mailto:'),
      isTel: a.href.startsWith('tel:'),
    }));

    // ── 2. ALL Buttons (text, type, disabled, has handler hint) ───────────────
    const allButtons = all('button, [role="button"], a[href]').map(el => {
      const tag = el.tagName;
      const text = el.innerText.trim().slice(0, 80);
      const href = tag === 'A' ? el.href : null;
      const disabled = el.disabled || el.getAttribute('aria-disabled') === 'true' || el.getAttribute('disabled') !== null;
      const type = el.type || (tag === 'BUTTON' ? 'submit' : null);
      return { tag, text, href, disabled, type };
    });

    // ── 3. ALL Forms (id, action, method, inputs count, has submit) ──────────
    const forms = all('form').map(f => {
      const inputs = [...f.querySelectorAll('input, textarea, select')];
      const submitBtn = f.querySelector('[type="submit"], button[type="submit"], button:not([type])');
      const labels = inputs.map(i => ({ name: i.name, type: i.type || i.tagName, placeholder: i.placeholder, id: i.id }));
      return {
        id: f.id || f.className.slice(0, 60),
        action: f.action,
        method: f.method,
        inputCount: inputs.length,
        hasSubmit: !!submitBtn,
        submitText: submitBtn ? submitBtn.innerText.trim().slice(0, 60) : null,
        labels,
      };
    });

    // ── 4. Footer links ─────────────────────────────────────────────────────
    const footerLinks = all('footer a[href], [class*="footer"] a[href]').map(a => ({
      href: a.href,
      text: a.innerText.trim().slice(0, 80),
    }));

    // ── 5. Header/Nav links ─────────────────────────────────────────────────
    const navLinks = all('header a[href], nav a[href], [class*="header"] a[href]').map(a => ({
      href: a.href,
      text: a.innerText.trim().slice(0, 80),
    }));

    // ── 6. CTA buttons (prominent, large, or in hero) ─────────────────────────
    const ctas = all('button, a[href], [role="button"]').map(el => {
      const cs = getCS(el);
      const isLarge = parseInt(cs.fontSize) >= 16 || parseInt(cs.height) >= 44;
      return {
        text: el.innerText.trim().slice(0, 80),
        href: el.tagName === 'A' ? el.href : null,
        fontSize: cs.fontSize,
        height: cs.height,
        isLarge,
        disabled: el.disabled || el.getAttribute('aria-disabled') === 'true',
      };
    }).filter(c => c.isLarge || c.text.length > 0);

    // ── 7. Page title + h1 ─────────────────────────────────────────────────
    const pageTitle = document.title;
    const h1 = one('h1')?.innerText?.trim() || '';
    const h2s = all('h2').map(h => h.innerText.trim().slice(0, 80));

    // ── 8. Sitemap / nav menu items ─────────────────────────────────────────
    const navMenuItems = all('nav li a, [class*="nav"] li a, [class*="menu"] li a, [class*="sidebar"] a').map(a => ({
      href: a.href,
      text: a.innerText.trim().slice(0, 60),
    }));

    // ── 9. Social links ─────────────────────────────────────────────────────
    const socialLinks = all('a[href*="facebook"], a[href*="twitter"], a[href*="instagram"], a[href*="linkedin"], a[href*="youtube"]').map(a => ({
      href: a.href,
      text: a.innerText.trim().slice(0, 60),
    }));

    // ── 10. Placeholder / construction indicators ─────────────────────────────
    const placeholderLinks = allLinks.filter(l =>
      l.isHash || l.href === window.location.origin + '/' ||
      l.text.match(/coming soon|under construction|page not found|placeholder/i)
    );

    // ── 11. Auth pages check ─────────────────────────────────────────────────
    const authForms = forms.filter(f => f.id.match(/auth|login|signup|signin|register/i));

    // ── 12. Error/404 content on page ──────────────────────────────────────
    const notFoundElements = all('[class*="404"], [class*="not-found"], [class*="error-page"]').map(el => ({
      class: (el.className||'').toString().slice(0,80),
      text: el.innerText.trim().slice(0,80),
    }));

    return {
      url: window.location.href,
      pageTitle, h1, h2s,
      allLinks, allButtons, forms, footerLinks, navLinks,
      ctas, navMenuItems, socialLinks,
      placeholderLinks, authForms, notFoundElements,
      totalLinks: allLinks.length,
      totalButtons: allButtons.length,
      totalForms: forms.length,
    };
  });

  // ── Follow every non-hash, non-mailto link and record status ────────────────
  const linkResults = [];
  const seen = new Set();
  const linksToCheck = data.allLinks.filter(l =>
    !l.isHash && !l.isMailto && !l.isTel &&
    l.href.startsWith('http') &&
    !l.href.includes('fonts.gstatic') &&
    !l.href.includes('unsplash') &&
    !l.href.includes('razorpay') &&
    !l.href.includes('lumberjack')
  );

  for (const link of linksToCheck.slice(0, 30)) { // cap at 30 for speed
    if (seen.has(link.href)) continue;
    seen.add(link.href);
    try {
      const resp = await page.goto(link.href, { waitUntil: 'load', timeout: 10000 });
      const status = resp ? resp.status() : 'no-response';
      linkResults.push({ href: link.href, text: link.text, status, ok: status >= 200 && status < 400 });
      await page.goBack({ waitUntil: 'load' });
      await page.waitForTimeout(500);
    } catch (e) {
      linkResults.push({ href: link.href, text: link.text, status: 'error', ok: false, error: e.message.slice(0, 100) });
      try { await page.goBack({ waitUntil: 'load' }); await page.waitForTimeout(500); } catch(_) {}
    }
  }

  // ── Check internal page routes by visiting them directly ────────────────────
  const routes = [
    '/', '/about', '/contact', '/privacy', '/terms', '/faq', '/blog',
    '/login', '/signup', '/404', '/admin.html',
  ];
  const routeResults = [];
  for (const route of routes) {
    const url = route.startsWith('http') ? route : `http://localhost:5174${route}`;
    try {
      const resp = await page.goto(url, { waitUntil: 'load', timeout: 8000 });
      const status = resp ? resp.status() : 'no-response';
      const h1 = await page.evaluate(() => document.querySelector('h1')?.innerText?.trim() || '');
      const title = await page.evaluate(() => document.title);
      routeResults.push({ route, status, h1, title, ok: status < 500 });
      await page.goBack({ waitUntil: 'load' });
      await page.waitForTimeout(500);
    } catch (e) {
      routeResults.push({ route, status: 'error', h1: '', title: '', ok: false, error: e.message.slice(0,100) });
      try { await page.goBack({ waitUntil: 'load' }); await page.waitForTimeout(500); } catch(_) {}
    }
  }

  // ── Test form submission on login/signup page ──────────────────────────────
  let formSubmissionResult = null;
  try {
    await page.goto('http://localhost:5174/admin.html', { waitUntil: 'load', timeout: 10000 });
    await page.waitForTimeout(2000);
    const formsOnAdmin = await page.evaluate(() => {
      const forms = [...document.querySelectorAll('form')];
      return forms.map(f => ({ id: f.id || f.className.slice(0,60), inputs: [...f.querySelectorAll('input')].length }));
    });
    formSubmissionResult = { page: 'admin', forms: formsOnAdmin };
  } catch (e) {
    formSubmissionResult = { error: e.message.slice(0, 100) };
  }

  return {
    audit: data,
    linkResults,
    routeResults,
    formSubmissionResult,
  };
}

export default audit;
