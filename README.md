# SwiftCart — React frontend

This is the same SwiftCart storefront + admin panel, now running as a
**React app**, wired to the **original, completely untouched Express
backend** (`api/`, `config/`, `middleware/`, `models/`, `routes/`,
`utils/`).

## What changed vs. what didn't

- **Backend: 100% untouched.** Every file under `api/`, `config/`,
  `middleware/`, `models/`, `routes/`, `utils/` is copied byte-for-byte
  from the original project. Same routes, same auth, same DB models,
  same Razorpay integration.
- **Frontend: converted to React, but pixel/behavior-identical.**
  `public/index.html` and `public/admin.html` are now rendered by
  React (`src/pages/StorefrontPage.jsx` / `AdminPage.jsx`), but the
  original CSS, markup, and vanilla-JS logic are kept fully intact
  (see `src/content/*`) and mounted as-is via `src/pages/LegacyPage.jsx`.
  Nothing about the look, animations/transitions, or behavior was
  rewritten — this guarantees no regressions while still making it a
  real React project (Vite + React build, `npm run dev`, `npm run build`).
- All API calls in the original code are relative (`fetch("/api/...")`),
  so they keep talking to the same backend without any changes.

## Project layout

```
index.html            ← Vite entry for the storefront ("/")
admin.html             ← Vite entry for the admin panel ("/admin.html")
src/
  main.jsx             ← mounts <StorefrontPage />
  admin-main.jsx        ← mounts <AdminPage />
  pages/
    LegacyPage.jsx      ← generic "mount original CSS+HTML+JS" wrapper
    StorefrontPage.jsx
    AdminPage.jsx
  content/
    storefrontStyle.js  ← original <style> block, verbatim
    storefrontBody.js    ← original <body> markup, verbatim
    storefrontScript.js  ← original <script> logic, verbatim
    adminStyle.js / adminBody.js / adminScript.js  (same, for admin.html)
api/, config/, middleware/, models/, routes/, utils/   ← unchanged backend
vercel.json            ← builds the Vite frontend + keeps the /api rewrite
```

## Run it locally

```bash
npm install

# Terminal 1 — backend (unchanged), needs your .env (MONGODB_URI etc.)
npm run dev:api

# Terminal 2 — React frontend, proxies /api/* to http://localhost:3000
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173) for the
storefront, and http://localhost:5173/admin.html for the admin panel.
The dev proxy (see `vite.config.js`) forwards `/api/*` requests to the
backend on port 3000, so nothing in the frontend code needed to change.

## Build / deploy

```bash
npm run build      # outputs the React app to dist/
```

`vercel.json` is set up to build with `vite build`, serve `dist/` as
static output, and keep routing every `/api/*` request to the same
serverless Express function as before — same deployment steps as the
original README (Atlas Mongo URI, Razorpay test keys, etc. — see the
env var table there).
