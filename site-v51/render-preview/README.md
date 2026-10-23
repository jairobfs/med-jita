# MED JITA · Render Canary V56

Preview of the complete original frontend from ../source/. This is temporary validation, not a new production history database.

- Branch: canario/render-v56-isolado (isolated from main).
- Official Sites V52 frontend and its D1 / Craft data are untouched.
- No Craft credentials, production D1 bindings, real access codes or backend secrets are used.
- Render adapter implements only the profile API for UI exercise.
- Four demo profiles: JBFS, Barba, Tay, Igu. JBFS fictitious PIN: 0000.
- Demo notes are scoped to a browser cookie and saved only in Node process memory.
- Data can disappear after restart, free-tier suspension or redeploy; nothing syncs to Craft.
- Do not enter real grades or PINs. Password changes and production routes are disabled.
- Every response has noindex headers; home page has a clear persistent canary warning.
- Grade calculations, UI, motions, palettes, modules and illustrations are from the original source, not reimplemented.

## Commands

From site-v51:

- npm run qa
- node render-preview/test.mjs
- node render-preview/server.mjs (listens on 0.0.0.0:$PORT or 10000)

Render: Node runtime, free plan, branch canario/render-v56-isolado.
Build: cd site-v51 && npm run qa && node render-preview/test.mjs
Start: cd site-v51 && node render-preview/server.mjs
Manual deploys (autoDeploy=no) until verified.

## Production migration requirements

Separate durable storage, explicit history migration authorization, backup/restore verification, proper authentication, exact calculation parity, per-profile isolation, live Craft mirror (if authorized), and mobile-browser tests are prerequisites for replacing the existing Sites V52 app. A successful canary does not authorize any real-data migration.
